import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Auth } from '../services/auth/auth';
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FormsModule } from '@angular/forms';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import { Taskhub } from '../services/taskhub';

@Component({
  selector: 'app-taskdetails',
  imports: [DatePipe, RouterLink, CommonModule, FormsModule, DragDropModule],
  standalone: true,
  templateUrl: './taskdetails.html',
  styleUrl: './taskdetails.css',
})

export class Taskdetails {

  worksapce_info: any = null;
  tasks: any[] = [];
  user_data: any = null;
  isDarkMode = false;

  tasksToDo: any[] = [];
  tasksInProgress: any[] = [];
  tasksCompleted: any[] = [];
  tasksOverdue: any[] = [];

  selectedUsers: any[] = [];
  availableTags: any[] = [];
  newTag: string = '';

  statusMap: any = {
    0: 'ToDo',
    1: 'InProgress',
    2: 'Done',
    3: 'Overdue'
  };

  newTask: any = {
    title: '',
    description: '',
    dueDate: '',
    startDate: '',
    status: 0,
    difficulty: 0,
    points: 0,
    assignedUserIds: [] as string[],
    tagIds: [] as number[],
    newTags: [] as string[],
    workspaceId: 0
  };

  constructor(private auth: Auth, private route: ActivatedRoute, private realtime : Taskhub) {}

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(params => {
      const workspaceId = params.get('id');
      if (!workspaceId) return;

      this.auth.getWorkspaceInfo(workspaceId).subscribe((res: any) => {
        this.worksapce_info = res;
      });

      this.auth.getWorkspaceTasks(workspaceId).subscribe((res: any) => {
        
        this.realtime.setInitialTasks(workspaceId, res);
      
        //connect to hub
        const token = this.auth.getToken()!;
        this.realtime.connect(workspaceId, token);
      });
      
      //listen for realtime updates
      this.realtime.tasks$.subscribe(tasks => {
        this.tasks = tasks;
      
        this.availableTags = this.tasks.reduce((acc: any[], task) => {
          task.tags?.forEach((tag: any) => {
            if (!acc.find(t => t.name === tag.name)) {
              acc.push(tag);
            }
          });
          return acc;
        }, []);
      
        this.filterTasksStatus();
      });
    });

    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      this.isDarkMode = savedMode === 'true';
    }

    this.user_data = this.auth.getCurrentUser();
  }

  ngOnDestroy() {
    this.realtime.disconnect();
  }

  // FILTER TASKS
  filterTasksStatus() {
    this.tasksToDo = [];
    this.tasksInProgress = [];
    this.tasksCompleted = [];
    this.tasksOverdue = [];

    this.tasks.forEach(task => {

      if (this.isOverdue(task)) {
        this.tasksOverdue.push(task);
        return;
      }

      switch (task.status) {
        case 'ToDo':
          this.tasksToDo.push(task);
          break;
        case 'InProgress':
          this.tasksInProgress.push(task);
          break;
        case 'Done':
          this.tasksCompleted.push(task);
          break;
        case 'Overdue':
          this.tasksOverdue.push(task);
          break;
      }
    });
  }

  // TAGS
  toggleTag(tag: any) {

    if (tag.id) {
      const exists = this.newTask.tagIds.includes(tag.id);

      if (exists) {
        this.newTask.tagIds = this.newTask.tagIds.filter((id: number) => id !== tag.id);
      } else {
        this.newTask.tagIds.push(tag.id);
      }

    } else {
      const exists = this.newTask.newTags.includes(tag.name);

      if (exists) {
        this.newTask.newTags = this.newTask.newTags.filter((t: string) => t !== tag.name);
      } else {
        this.newTask.newTags.push(tag.name);
      }
    }
  }

  getSelectedTags() {
    return this.availableTags.filter(tag =>
      (tag.id && this.newTask.tagIds.includes(tag.id)) ||
      (!tag.id && this.newTask.newTags.includes(tag.name))
    );
  }

  addTag() {
    if (this.newTag.trim() === '') return;

    const trimmed = this.newTag.trim();

    const existing = this.availableTags.find(
      t => t.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      this.toggleTag(existing);
    } else {
      this.newTask.newTags.push(trimmed);
      this.availableTags.push({ name: trimmed });
    }

    this.newTag = '';
  }

  removeTag(tag: any) {

    if (tag.id) {
      this.newTask.tagIds = this.newTask.tagIds.filter((id: number) => id !== tag.id);
    } else {
      this.newTask.newTags = this.newTask.newTags.filter((t: string) => t !== tag.name);
    }

    this.availableTags = this.availableTags.filter(t => t.name !== tag.name);
  }

  // DRAG & DROP
  drop(event: CdkDragDrop<any[]>, newStatusIndex: number) {
    const movedTask = event.previousContainer.data[event.previousIndex];
  
    if (!movedTask) return;
  
    if (!this.canMoveTask(movedTask) || this.isOverdue(movedTask)) {
      return;
    }
  
    if (newStatusIndex === 3) return;
  
    const oldStatus = movedTask.status;
  
    movedTask.status = this.statusMap[newStatusIndex];
  
    this.filterTasksStatus();
  
    this.auth.updateTaskStatus(movedTask.publicId, newStatusIndex)
      .subscribe({
        next: () => {
          console.log('Synced with backend');
        },
        error: (err) => {
          console.error('Failed, reverting...', err);
  
          movedTask.status = oldStatus;
          this.filterTasksStatus();
        }
      });
  }

  // OVERDUE
  isOverdue(task: any): boolean {
    return new Date(task.dueDate) < new Date() && task.status !== 'Done';
  }

  // CREATE TASK 
  createTask() {
    this.newTask.workspaceId = this.worksapce_info.id;
  
    const payload = {
      title: this.newTask.title,
      description: this.newTask.description,
      dueDate: this.newTask.dueDate,
      startDate: this.newTask.startDate,
      status: this.newTask.status,
      difficulty: this.newTask.difficulty,
      points: this.newTask.points,
      assignedUserIds: this.selectedUsers.map(u => String(u.id)),
      tagIds: this.newTask.tagIds,
      newTags: this.newTask.newTags,
      workspaceId: this.newTask.workspaceId
    };
  
    this.auth.createTask(payload).subscribe({
      next: () => {
      },
      error: err => console.error(err)
    });
  
    this.newTask = {
      title: '',
      description: '',
      dueDate: '',
      startDate: '',
      status: 0,
      difficulty: 0,
      points: 0,
      assignedUserIds: [],
      tagIds: [],
      newTags: [],
      workspaceId: 0
    };
  
    this.selectedUsers = [];
  }

  // UI HELPERS
  setStatus(status: number) {
    this.newTask.status = status;
  }

  setDifficulty(level: number) {
    this.newTask.difficulty = level;
  }

  canMoveTask(task: any): boolean {
    if (!task) return false;
    if (this.isOverdue(task)) return false;
    if (this.isOwnerOrAdmin()) return true;
    return this.isTaskAssignedToCurrentUser(task);
  }

  private isOwnerOrAdmin(): boolean {
    const currentUserId = this.getEntityId(this.user_data);
    if (!currentUserId || !this.worksapce_info) {
      return false;
    }

    const ownerId = this.getEntityId(this.worksapce_info.owner);
    if (ownerId && ownerId === currentUserId) {
      return true;
    }

    const matchedMember = this.worksapce_info.members?.find((m: any) => this.getEntityId(m) === currentUserId);
    return matchedMember?.role === 1 || matchedMember?.role === 2;
  }

  private isTaskAssignedToCurrentUser(task: any): boolean {
    const currentUserId = this.getEntityId(this.user_data);
    if (!currentUserId) return false;

    return task?.assignedUsers?.some((u: any) => this.getEntityId(u) === currentUserId) ?? false;
  }

  private getEntityId(entity: any): string {
    return String(entity?.id ?? entity?.userId ?? entity?.publicId ?? '');
  }

  toggleUser(user: any) {
    const exists = this.selectedUsers.find(u => u.id === user.id);

    if (exists) {
      this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
    } else {
      this.selectedUsers.push(user);
    }
  }

  openTaskModal() {
    const modal = new (window as any).bootstrap.Modal(
      document.getElementById('createTaskModal')
    );
    modal.show();
  }
}
