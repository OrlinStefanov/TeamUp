import { Component, OnInit } from '@angular/core';

import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Auth } from '../services/auth/auth';

@Component({
  selector: 'app-workspace-detail',
  imports: [RouterModule, RouterOutlet, RouterLink],
  templateUrl: './workspace-detail.html',
  styleUrl: './workspace-detail.css',
  standalone: true
})
export class WorkspaceDetail implements OnInit {
  workspace_info: any = null;
  user_data: any = null;
  workspaceId: string = '';

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
      }
    });

    this.user_data = this.auth.getCurrentUser();
  }
}