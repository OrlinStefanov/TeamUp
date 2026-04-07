import { Component, OnInit } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth/auth';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-members',
  imports: [ CommonModule, RouterModule, RouterOutlet, RouterLink],
  templateUrl: './members.html',
  styleUrl: './members.css',
})

export class Members implements OnInit {
  constructor(private auth: Auth, private route: ActivatedRoute) {}

  members: any[] = [];
  invitations: any[] = [];

  activeTab: string = 'members';

  ngOnInit() {
    this.route.parent?.paramMap.subscribe(params => {
      const id = params.get('id');

      console.log('Workspace ID from route: ', id);

      if (id) {
        const workspace_info = this.auth.getCachedWorkspaceById(id);
        console.log('Cached Workspace: ', workspace_info);

        if (workspace_info) {
          this.members = workspace_info.members;
          this.invitations = workspace_info.invitations;

          this.members.push(workspace_info.owner);
        }

        // If more details needed, fetch full workspace info
        if (!workspace_info) {
          this.auth.getWorkspaceInfo(id).subscribe(ws => {
            this.members = ws.members;
            this.invitations = ws.invitations;

            this.members.push(ws.owner);

            console.log('Fetched Workspace: ', ws);
          });
        }
      }
    });
  }

  returnRoleName(role: number): string {
    switch (role) { 
      case 0: return 'Member';
      case 1: return 'Admin';
      case 2: return 'Owner';
      default: return 'Unknown';
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }
}