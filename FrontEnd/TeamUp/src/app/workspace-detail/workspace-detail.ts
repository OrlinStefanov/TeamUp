import { Component, OnInit, OnDestroy, HostBinding } from '@angular/core';
import { RouterModule, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Auth } from '../services/auth/auth';
import { CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { InboxService } from '../services/inbox.service';
import { InboxDrawerComponent } from '../components/inbox-drawer/inbox-drawer.component';
import { ChatService } from '../services/chat-services/chat-service';
import { Taskhub } from '../services/taskhub';

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
  isInboxOpen = false;
  inboxUnreadCount = 0;
  pendingInvitationsCount = 0;

  showTasksDot = false;
  showLeaderboardDot = false;
  showChatDot = false;
  showMembersDot = false;

  private taskUnreadCount = 0;
  private memberInboxUnreadCount = 0;
  private totalChatUnread = 0;

  @HostBinding('class.workspace-chat-route')
  isChatRoute = false;

  private destroy$ = new Subject<void>();

  constructor(
    private auth: Auth,
    private router: Router,
    private route: ActivatedRoute,
    private inboxService: InboxService,
    private chatService: ChatService,
    private taskhub: Taskhub
  ) {}

  ngOnInit() {
    this.isDarkMode$ = this.auth.darkMode$;
    this.user_data = this.auth.getCurrentUser();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.updateRouteState();
        this.handleTabAcknowledgment();
      });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      if (!id) return;

      this.workspaceId = id;
      this.inboxService.setWorkspace(id);

      const token = this.auth.getToken();
      if (token) {
        this.taskhub.connect(id, token);
      }

      this.workspace_info = this.auth.getCachedWorkspaceById(id);
      this.initChatForWorkspace(id);

      this.auth.getWorkspaceInfo(id).subscribe(ws => {
        this.workspace_info = ws;
        this.pendingInvitationsCount = ws.invitations?.length ?? 0;
        this.initChatForWorkspace(id, ws.id);
        this.updateNotificationDots();
      });

      this.inboxService.getInboxMessages(1).subscribe();
      this.inboxService.startPolling();
      this.updateRouteState();
      this.handleTabAcknowledgment();
    });

    this.inboxService.inboxState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.inboxUnreadCount = state.unreadCount;
        this.taskUnreadCount = state.taskUnreadCount;
        this.memberInboxUnreadCount = state.memberUnreadCount;
        this.updateNotificationDots();
        this.persistTabReadsIfNeeded();
      });

    this.chatService.unread$
      .pipe(takeUntil(this.destroy$))
      .subscribe(unreadMap => {
        this.totalChatUnread = Object.values(unreadMap).reduce((sum, count) => sum + count, 0);
        this.updateNotificationDots();
      });
  }

  ngOnDestroy(): void {
    this.inboxService.stopPolling();
    this.taskhub.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initChatForWorkspace(publicId: string, numericId?: number): void {
    const workspaceId = numericId ?? this.auth.getCachedWorkspaceById(publicId)?.id;
    if (!workspaceId) return;

    this.chatService.startConnection().then(() => {
      this.chatService.loadChannels(workspaceId.toString());
    }).catch(() => {
      this.chatService.loadChannels(workspaceId.toString());
    });
  }

  private updateRouteState(): void {
    const url = this.router.url;
    this.isChatRoute = /\/workspace\/[^/]+\/chat(\/|$)/.test(url);
  }

  private handleTabAcknowledgment(): void {
    this.persistTabReadsIfNeeded();
  }

  private persistTabReadsIfNeeded(): void {
    const url = this.router.url;

    if ((/\/tasks(\/|$)/.test(url) || /\/leaderboard(\/|$)/.test(url)) && this.taskUnreadCount > 0) {
      this.inboxService.markTaskInboxAsRead().subscribe();
    }

    if (/\/members(\/|$)/.test(url) && this.memberInboxUnreadCount > 0) {
      this.inboxService.markMemberInboxAsRead().subscribe();
    }
  }

  private updateNotificationDots(): void {
    this.showTasksDot = this.taskUnreadCount > 0;
    this.showLeaderboardDot = this.taskUnreadCount > 0;
    this.showChatDot = this.totalChatUnread > 0;
    this.showMembersDot =
      this.pendingInvitationsCount > 0 ||
      this.memberInboxUnreadCount > 0;
  }

  openInbox(): void {
    this.isInboxOpen = true;
    this.inboxService.markInboxAsRead().subscribe();
  }

  closeInbox(): void {
    this.isInboxOpen = false;
  }
}
