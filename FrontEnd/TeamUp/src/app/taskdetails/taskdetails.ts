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

@Component({
  selector: 'app-taskdetails',
  imports: [DatePipe, RouterLink, CommonModule, FormsModule, DragDropModule],
  standalone: true,
  templateUrl: './taskdetails.html',
  styleUrl: './taskdetails.css',
})

export class Taskdetails {

  selectedRole: string = 'all';
  roleMenuOpen: boolean = false;
  filtersOpen: boolean = false;

  worksapce_info: any = null;
  tasks: any[] = [];
  user_data: any = null;
  isDarkMode = false;
  activeMenuTaskId: string | null = null;

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

  statusReverseMap: any = {
    ToDo: 0,
    InProgress: 1,
    Done: 2,
    Overdue: 3
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

  filters = {
    user: localStorage.getItem('taskFilter_user') || 'all',
    search: '',
    tags: JSON.parse(localStorage.getItem('taskFilter_tags') || '[]') as string[],
    difficulty: localStorage.getItem('taskFilter_difficulty') || 'all',
    status: 'all'
  };

  tagMenuOpen: boolean = false;
  difficultyMenuOpen: boolean = false;

  private boundCloseDropdown!: () => void;

  constructor(private auth: Auth, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(params => {
      const workspaceId = params.get('id');
      if (!workspaceId) return;

      this.auth.getWorkspaceInfo(workspaceId).subscribe((res: any) => {
        this.worksapce_info = res;
      });

      this.auth.getWorkspaceTasks(workspaceId).subscribe((res: any) => {
        this.tasks = res;

        console.log('Fetched tasks:', this.tasks);

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

    // Close dropdowns and menus when clicking outside
    this.boundCloseDropdown = () => {
      this.roleMenuOpen = false;
      this.tagMenuOpen = false;
      this.difficultyMenuOpen = false;
      this.activeMenuTaskId = null;
    };
    document.addEventListener('click', this.boundCloseDropdown);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.boundCloseDropdown);
  }

  // FILTER TASKS
  filterTasksStatus() {
    this.tasksToDo = [];
    this.tasksInProgress = [];
    this.tasksCompleted = [];
    this.tasksOverdue = [];

    const filtered = this.applyFilters();

    filtered.forEach(task => {

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
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      return;
    }

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    const movedTask = event.container.data[event.currentIndex];

    movedTask.status = newStatusIndex;

    if (this.isOverdue(movedTask)) {
      movedTask.status = 'Overdue';
    }

    const index = this.tasks.findIndex(t => t.id === movedTask.id);
    if (index !== -1) {
      this.tasks[index] = movedTask;
    }

    console.log('Moved task:', movedTask.status);

    this.auth.updateTaskStatus(movedTask.publicId, movedTask.status)
      .subscribe({
        next: () => console.log('Status updated'),
        error: (err) => {
          console.error('Update failed', err);
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

    this.auth.createTask(payload).subscribe((res: any) => {
      this.tasks.push(res);
      this.filterTasksStatus();

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
    });
  }

  // UI HELPERS
  setStatus(status: number) {
    this.newTask.status = status;
  }

  setDifficulty(level: number) {
    this.newTask.difficulty = level;
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

  moveTask(task: any, status: string) {
    task.status = status;

    const index = this.tasks.findIndex(t => t.id === task.id);
    if (index !== -1) {
      this.tasks[index] = task;
    }

    this.filterTasksStatus();

    this.auth.updateTaskStatus(task.publicId, this.statusReverseMap[status])
      .subscribe({
        next: () => console.log('Task moved'),
        error: (err) => {
          console.error(err);
          this.filterTasksStatus();
        }
      });

    this.activeMenuTaskId = null;
  }

  toggleMenu(event: MouseEvent, taskId: string) {
    event.stopPropagation();
    this.activeMenuTaskId = this.activeMenuTaskId === taskId ? null : taskId;
  }

  toggleRoleMenu(event: Event): void {
    event.stopPropagation();
    this.roleMenuOpen = !this.roleMenuOpen;
    this.tagMenuOpen = false;
    this.difficultyMenuOpen = false;
  }

  setRoleFilter(role: string, event?: Event): void {
    event?.stopPropagation();
    this.filters.user = role;
    localStorage.setItem('taskFilter_user', role);
    this.roleMenuOpen = false;
    this.filterTasksStatus();
  }

  onSearch(value: string) {
    this.filters.search = value;
    this.filterTasksStatus();
  }

  get activeFilterLabel(): string {
    if (this.filters.user === 'all') return 'All Members';
    return this.filters.user;
  }

  isFilterActive(userName: string): boolean {
    return this.filters.user === userName;
  }

  get sortedUsers() {
    if (!this.worksapce_info) return [];

    const currentUserId = this.user_data?.id;
    const owner = this.worksapce_info.owner;
    const members = this.worksapce_info.members || [];

    const currentUser =
      members.find((u: any) => u.id === currentUserId) ||
      (owner?.id === currentUserId ? owner : null);

    const otherMembers = members.filter(
      (u: any) => u.id !== currentUserId
    );

    const includeOwner =
      owner && owner.id !== currentUserId &&
      !otherMembers.some((u: any) => u.id === owner.id);

    const result: any[] = [];

    if (currentUser) result.push(currentUser);
    result.push(...otherMembers);
    if (includeOwner) result.push(owner);

    return result;
  }

  toggleTagFilter(tagName: string): void {
    const idx = this.filters.tags.indexOf(tagName);
    if (idx > -1) {
      this.filters.tags.splice(idx, 1);
    } else {
      this.filters.tags.push(tagName);
    }
    localStorage.setItem('taskFilter_tags', JSON.stringify(this.filters.tags));
    this.filterTasksStatus();
  }

  isTagFilterActive(tagName: string): boolean {
    return this.filters.tags.includes(tagName);
  }

  setDifficultyFilter(level: string, event?: Event): void {
    event?.stopPropagation();
    this.filters.difficulty = level;
    localStorage.setItem('taskFilter_difficulty', level);
    this.difficultyMenuOpen = false;
    this.filterTasksStatus();
  }

  get activeDifficultyLabel(): string {
    const map: any = { 'all': 'All Difficulties', '0': 'Easy', '1': 'Medium', '2': 'Hard', '3': 'Very Hard' };
    return map[this.filters.difficulty] || 'All Difficulties';
  }

  toggleTagMenu(event: Event): void {
    event.stopPropagation();
    this.tagMenuOpen = !this.tagMenuOpen;
    this.difficultyMenuOpen = false;
  }

  toggleDifficultyMenu(event: Event): void {
    event.stopPropagation();
    this.difficultyMenuOpen = !this.difficultyMenuOpen;
    this.tagMenuOpen = false;
  }

  applyFilters(): any[] {
    return this.tasks.filter(task => {

      // USER FILTER — assignedUsers have no id, filter by userName
      if (this.filters.user !== 'all') {
        const assigned = task.assignedUsers?.some(
          (u: any) => u.userName === this.filters.user
        );
        if (!assigned) return false;
      }

      // SEARCH FILTER
      if (this.filters.search) {
        const text = (task.title + ' ' + task.description).toLowerCase();
        if (!text.includes(this.filters.search.toLowerCase())) {
          return false;
        }
      }

      // TAG FILTER
      if (this.filters.tags.length > 0) {
        const hasTag = task.tags?.some((t: any) =>
          this.filters.tags.includes(t.name)
        );
        if (!hasTag) return false;
      }

      // DIFFICULTY FILTER
      if (this.filters.difficulty !== 'all') {
        if (String(task.difficulty) !== String(this.filters.difficulty)) return false;
      }

      // STATUS FILTER
      if (this.filters.status !== 'all') {
        if (task.status !== this.filters.status) return false;
      }

      return true;
    });
  }

  openFilterModal() {
    this.filtersOpen = !this.filtersOpen;
  }

  clearAllFilters(): void {
    this.filters.user = 'all';
    this.filters.difficulty = 'all';
    this.filters.tags = [];
    localStorage.setItem('taskFilter_user', 'all');
    localStorage.setItem('taskFilter_difficulty', 'all');
    localStorage.setItem('taskFilter_tags', '[]');
    this.roleMenuOpen = false;
    this.filterTasksStatus();
  }
}