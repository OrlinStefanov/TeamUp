import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgFor } from '@angular/common';
import { Auth } from '../services/auth/auth';
import { RouterLink } from "@angular/router";

@Component({
  selector: 'app-taskdetails',
  imports: [DatePipe, NgFor, RouterLink],
  templateUrl: './taskdetails.html',
  styleUrl: './taskdetails.css',
})
export class Taskdetails {
  worksapce_info : any = null;
  tasks : any[] = [];
  user_data : any = null;

  constructor(private auth : Auth) {}

  ngOnInit() {
    const workspaceId = window.location.pathname.split('/')[2]; // assuming URL is /workspace/{id}/tasks
    
    this.auth.getfullworkspaceInfo(workspaceId).subscribe((response: any) => {
      this.worksapce_info = response;
      console.log('Workspace Info:', this.worksapce_info);
    });

    this.auth.getWorkspaceTasks(workspaceId).subscribe((response: any) => {
      this.tasks = response;
      console.log('Tasks:', this.tasks);
    });

    this.user_data = this.auth.getCurrentUser();
  }
}
