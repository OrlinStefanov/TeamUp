import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { Auth } from '../services/auth/auth';
import { RouterLink } from "@angular/router";
import { Router } from '@angular/router';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-workspace-detail',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './workspace-detail.html',
  styleUrl: './workspace-detail.css',
})

export class WorkspaceDetail {
  worksapce_info : any = null;
  user_data : any = null;

  constructor(private auth : Auth, private route : Router) {}

  ngOnInit()
  {
    const workspaceId = window.location.pathname.split('/')[2];

    this.auth.getfullworkspaceInfo(workspaceId).subscribe((response: any) => {
      this.worksapce_info = response;
      console.log('Workspace Info:', this.worksapce_info);
    });

    this.user_data = this.auth.getCurrentUser();
  }
}
