import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Auth } from '../services/auth/auth';
import { CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InboxService } from '../services/inbox.service';
import { InboxDrawerComponent } from '../components/inbox-drawer/inbox-drawer.component';

@Component({
  selector: 'app-workspace-detail',
  imports: [RouterModule, RouterOutlet, RouterLink, CommonModule, InboxDrawerComponent],
  templateUrl: './workspace-detail.html',
  styleUrl: './workspace-detail.css',
  standalone: true
})
export class WorkspaceDetail implements OnInit, OnDestroy {
  workspace_info: any = null;
  user_data: any = null;
  workspaceId: string = '';
  isDarkMode$!: Observable<boolean>;
  activeLink: string = '';
  isInboxOpen = false;
  inboxUnreadCount = 0;
  pendingInvitationsCount = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private auth: Auth,
    private router: Router,
    private route: ActivatedRoute,
    private inboxService: InboxService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.workspaceId = id;
        this.inboxService.setWorkspace(id);

        // Try cached workspace for instant display
        this.workspace_info = this.auth.getCachedWorkspaceById(id);

        // Always fetch full info — only owner receives the invitations array
        this.auth.getWorkspaceInfo(id).subscribe(ws => {
          this.workspace_info = ws;
          this.pendingInvitationsCount = ws.invitations?.length ?? 0;
        });

        // Load initial inbox messages
        this.inboxService.getInboxMessages(1).subscribe();
        this.inboxService.startPolling();

        console.log('Workspace: ', this.workspace_info);
      }
    });

    this.isDarkMode$ = this.auth.darkMode$;
    this.user_data = this.auth.getCurrentUser();

    // Subscribe to inbox state for unread count
    this.inboxService.inboxState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.inboxUnreadCount = state.unreadCount;
      });
  }

  ngOnDestroy(): void {
    this.inboxService.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActive(link: string) {
    this.activeLink = link;
  }

  isActive(route: string): boolean {
    return this.router.url.endsWith(route);
  }

  openInbox(): void {
    this.isInboxOpen = true;
    // Auto-mark as read when opening
    this.inboxService.markInboxAsRead().subscribe();
  }

  closeInbox(): void {
    this.isInboxOpen = false;
  }
}