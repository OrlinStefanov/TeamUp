import { Component, OnInit } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Auth } from '../services/auth/auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workspace-detail',
  imports: [RouterModule, RouterOutlet, RouterLink, CommonModule],
  templateUrl: './workspace-detail.html',
  styleUrl: './workspace-detail.css',
  standalone: true
})
export class WorkspaceDetail implements OnInit {
  workspace_info: any = null;
  user_data: any = null;
  workspaceId: string = '';
  isDarkMode = false;
  activeLink: string = '';

  constructor(
    private auth: Auth,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.workspaceId = id;

        // Try cached short workspace first
        this.workspace_info = this.auth.getCachedWorkspaceById(id);

        // If more details needed, fetch full workspace info
        if (!this.workspace_info) {
          this.auth.getWorkspaceInfo(id).subscribe(ws => {
            this.workspace_info = ws;
          });
        }

        console.log('Workspace: ', this.workspace_info);
      }
    });

    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      this.isDarkMode = savedMode === 'true';
    }

    this.user_data = this.auth.getCurrentUser();
  }

  setActive(link: string) {
    this.activeLink = link;
  }

  isActive(route: string): boolean {
    return this.router.url.endsWith(route);
  }
}