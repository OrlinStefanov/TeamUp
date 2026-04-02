import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

import { Auth } from '../services/auth/auth';
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-taskdetails',
  imports: [DatePipe, RouterLink, CommonModule, FormsModule],
  standalone : true,
  templateUrl: './taskdetails.html',
  styleUrl: './taskdetails.css',
})
export class Taskdetails {
  worksapce_info : any = null;
  tasks : any[] = [];
  user_data : any = null;
   isDarkMode = false;

  //different status for task
  tasksToDo : any[] = [];
  tasksInProgress : any[] = [];
  tasksCompleted : any[] = [];
  tasksOverdue : any[] = [];

  selectedUsers: any[] = [];

  newTask : any = {
    title: '',
    description: '',
    dueDate: '',
    startDate: '',
    status: 0, //0-ToDo 1-InProgress 2-Done
    difficulty: 0, //0-Easy 1-Medium 2-Hard 3-veryHard
    points: 0,
    assignedUserIds : [],
    workspaceId: 0 // number
  };

  constructor(private auth : Auth, private route : ActivatedRoute) {}

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(params => {
        const workspaceId = params.get('id');
        console.log('Workspace ID:', workspaceId);

        if (!workspaceId) return;

        // Load workspace info
        this.auth.getWorkspaceInfo(workspaceId).subscribe((response: any) => {
          this.worksapce_info = response;
          console.log('Workspace Info:', this.worksapce_info);
        });

        // Load tasks
        this.auth.getWorkspaceTasks(workspaceId).subscribe((response: any) => {
          this.tasks = response;
          console.log('Tasks:', this.tasks);
          this.filterTasksStatus();
        });
      });

      // Keep the rest as-is (runs once, which is fine)
      const savedMode = localStorage.getItem('darkMode');
      if (savedMode !== null) {
        this.isDarkMode = savedMode === 'true';
      }

      this.user_data = this.auth.getCurrentUser();
  }

  openTaskModal() {
    const modal = new (window as any).bootstrap.Modal(
      document.getElementById('createTaskModal')
    );
    modal.show();
  }

  filterTasksStatus()
  {
      this.tasksToDo = this.tasks.filter(t => t.status == 'ToDo');
      this.tasksInProgress = this.tasks.filter(t => t.status == 'In Progress');
      this.tasksCompleted = this.tasks.filter(t => t.status == 'Done');
      this.tasksOverdue = this.tasks.filter(t => t.status == 'Overdue');
  }

  createTask()
  {
    this.newTask.workspaceId = this.worksapce_info.id;

    this.auth.createTask(this.newTask).subscribe((res : any) =>
    {
      console.log(res);

      this.tasks.push(res);
    
      this.filterTasksStatus();
      
      this.newTask = {
        title: '',
        description: '',
        dueDate: '',
        startDate: '',
        status: 0, //0-ToDo 1-InProgress 2-Done
        difficulty: 0, //0-Easy 1-Medium 2-Hard 3-veryHard
        points: 0,
        assignedUserIds : [],
        workspaceId: 0 // number
      }
    });
  }

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

    this.newTask.assignedUsers = this.selectedUsers.map(u => u.id);
  }
}