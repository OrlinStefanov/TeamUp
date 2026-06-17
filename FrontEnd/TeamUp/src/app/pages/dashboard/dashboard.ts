import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { Workspace, WorkspaceMember } from '../../services/auth/auth-types';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, map, Observable, Subscription } from 'rxjs';
import { InboxService } from '../../services/inbox.service';
import { DirectMessagesService } from '../../services/direct-messages.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    RouterModule,
],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  showDropdown = false;
  showSettingsDropdown = false;
  showCreateWorkspace = false;
  showJoinWorkspace = false;
  createModalMode: 'create' | 'join' = 'create';
  copied = false;
  timeout: any;

  suggestions: any[] = [];
  invitedMembers: WorkspaceMember[] = [];

  private searchTimeout: any;

  user$!: Observable<any>;
  workspaces$!: Observable<any[]>;
  
  workspace: Workspace = {
    title: '',
    description: '',
    ownerId: '',
    members: []
  };

  // Added for Join Workspace form data
  joinInput = {
    inviteCode: '',
    workspaceLink: ''
  };
 
  inviteInput: string = '';

  showEditWorkspace = false;
  showDeleteWorkspace = false;
  showSettings = false;

  selectedWorkspace: any = null;

  editSuggestions: any[] = [];
  editInviteInput = '';
  editMembers: any[] = [];
  
  inboxUnreadCounts: Record<string, number> = {};
  onlineUserIds = new Set<string>();
  private presenceSub?: Subscription;

  constructor(
    private auth: Auth,
    private inboxService: InboxService,
    private dmService: DirectMessagesService,
    private cdr: ChangeDetectorRef
  ) {}

  myWorkspaces$!: Observable<any[]>;
  otherWorkspaces$!: Observable<any[]>;

  currentUserId!: string;
  isDarkMode$!: Observable<boolean>;

  ngOnInit() {

    this.isDarkMode$ = this.auth.darkMode$;
    this.user$ = this.auth.user$;
    this.workspaces$ = this.auth.workspaces$;

    this.currentUserId = this.auth.getUserId();

    this.myWorkspaces$ = this.workspaces$.pipe(
      map(workspaces => (workspaces || []).filter(w => w.ownerId === this.currentUserId))
    );

    this.otherWorkspaces$ = this.workspaces$.pipe(
      map(workspaces => (workspaces || []).filter(w => w.ownerId !== this.currentUserId))
    );

    this.auth.getWorkspaces(true).subscribe(workspaces => {
      if (!workspaces?.length) return;
      this.loadInboxUnreadCounts(workspaces);
    });

    this.dmService.startConnection().catch(() => {});
    this.presenceSub = this.dmService.onlineUserIds$.subscribe(ids => {
      this.onlineUserIds = ids;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    this.presenceSub?.unsubscribe();
  } 

  private loadInboxUnreadCounts(workspaces: any[]) {
    const requests = workspaces.map(workspace =>
      this.inboxService.getInboxMessagesForWorkspace(workspace.publicId, 1).pipe(
        map(response => ({ publicId: workspace.publicId, unreadCount: response.unreadCount }))
      )
    );

    forkJoin(requests).subscribe(results => {
      const counts: Record<string, number> = {};
      results.forEach(result => {
        counts[result.publicId] = result.unreadCount;
      });
      this.inboxUnreadCounts = counts;
      this.cdr.markForCheck();
    });
  }

  inboxUnreadCount(workspace: any): number {
    return this.inboxUnreadCounts[workspace.publicId] ?? 0;
  }

  totalUnreadCount(workspaces: any[]): number {
    return (workspaces || []).reduce((total, workspace) => total + this.inboxUnreadCount(workspace), 0);
  }

  activeMemberCount(workspace: any): number {
    return (workspace?.members || []).filter((member: any) => {
      const userId = member.userId ?? member.UserId;
      const isOnline = member.isOnline ?? member.IsOnline;
      return isOnline === true || (userId && this.onlineUserIds.has(userId));
    }).length;
  }

  workspaceMemberCount(workspace: any): number {
    return workspace?.membersCount ?? workspace?.members?.length ?? 0;
  }

  workspaceHandle(workspace: any): string {
    return `@${(workspace?.title || 'workspace').toLowerCase().trim().replace(/\s+/g, '-')}`;
  }

  workspaceAccent(workspace: any): string {
    const id = workspace?.publicId || workspace?.title || 'workspace';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    const accents = [
      'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      'linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)',
      'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
      'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
      'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
    ];

    return accents[Math.abs(hash) % accents.length];
  }

  ownedWorkspaceCount(workspaces: any[]): number {
    return (workspaces || []).filter(workspace => workspace.ownerId === this.currentUserId).length;
  }

  sharedWorkspaceCount(workspaces: any[]): number {
    return (workspaces || []).filter(workspace => workspace.ownerId !== this.currentUserId).length;
  }

  updateWorkspace() {
    const members = this.editMembers
      .filter(m => (m.userId || m.id) !== this.selectedWorkspace.ownerId)
      .map(m => ({
        emailOrUsername: m.emailOrUsername || m.userName || m.email,
        role: m.role ?? 0
      }))
      .filter(m => !!m.emailOrUsername);

    this.auth.editWorkspace({
      ...this.selectedWorkspace,
      members
    }).subscribe({
      next: () => {
        this.auth.getWorkspaces(true).subscribe();
        this.showEditWorkspace = false;
      }
    });
  }

  deleteWorkspace() {
    this.auth.deleteWorkspace(this.selectedWorkspace.publicId).subscribe(() => {
      this.auth.getWorkspaces(true).subscribe();
    });
    console.log('delete', this.selectedWorkspace);

    this.showDeleteWorkspace = false;
  }

  onEditInputChange(value: string) {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    this.searchTimeout = setTimeout(() => {
      if (value.trim().length < 2) {
        this.editSuggestions = [];
        return;
      }

      this.auth.searchUsers(value).subscribe({
        next: (res: any) => {
          this.editSuggestions = res.filter((u: any) =>
            !this.editMembers.some(m =>
              (m.emailOrUsername || m.userName || m.email) === u.userName ||
              (m.emailOrUsername || m.userName || m.email) === u.email
            )
          );
        },
        error: () => {
          this.editSuggestions = [];
        }
      });
    }, 300);
  }

  copyJoinCode() {
    const code = this.selectedWorkspace?.joinCode;
    if (!code) return;
  
    navigator.clipboard.writeText(code).then(() => {
      this.copied = true;
  
      setTimeout(() => {
        this.copied = false;
      }, 1500);
    });
  }

  addMember(user: any) {
    const identifier = user.userName || user.email;
    const exists = this.editMembers.some(m =>
      (m.emailOrUsername || m.userName || m.email) === identifier ||
      (m.emailOrUsername || m.userName || m.email) === user.email
    );

    if (!exists) {
      this.editMembers.push({
        ...user,
        emailOrUsername: identifier,
        role: 0
      });
    }

    this.editInviteInput = '';
    this.editSuggestions = [];
  }

  removeEditMember(member: any) {
    this.editMembers = this.editMembers.filter(m => m !== member);
  }

  openEditWorkspace(workspace: any) {
    this.selectedWorkspace = { ...workspace }; // clone
    this.editMembers = [...workspace.members];

    console.log('edit', this.selectedWorkspace);
    this.showEditWorkspace = true;
  }

  closeEditWorkspace() {
    this.showEditWorkspace = false;
  }

  openDeleteWorkspace(workspace: any) {
    this.selectedWorkspace = workspace;
    this.showDeleteWorkspace = true;
  }

  closeDeleteWorkspace() {
    this.showDeleteWorkspace = false;
  }

  openSettings(workspace: any)
  {
    this.selectedWorkspace = { ...workspace };
    this.copied = false;
    this.showSettings = true;

    setTimeout(() => {
      const modalEl = document.getElementById('settingsModal');
      if (!modalEl) return;
      const modal = (window as any).bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    });
  }

  closeSettings()
  {
    this.showSettings = false;
    this.copied = false;
  }

  get UserRoleFromSelectedWorkspace(): string {
    if (!this.selectedWorkspace) return '';
  
    if (this.selectedWorkspace.ownerId === this.currentUserId) {
      return 'Owner';
    }
  
    const member = this.selectedWorkspace.members
      ?.find((u: { userId: string; }) => u.userId === this.currentUserId);
  
    return member?.role === 1 ? 'Admin' : 'Member';
  }

  toggleDarkMode() {
    this.auth.toggleDarkMode();
  }

  openCreateWorkspace() {
    this.showCreateWorkspace = true;
    this.createModalMode = 'create';
  }
  
  closeCreateWorkspace() {
    this.showCreateWorkspace = false;
    this.createModalMode = 'create';
    this.workspace = { title: '', description: '', ownerId: '', members: [] };
    this.invitedMembers = [];
    this.inviteInput = '';
  }

  createWorkspace() {
    if (!this.workspace.title.trim()) {
      console.log("Workspace name is required");
      return;
    }

    this.workspace.members = [...this.invitedMembers];

    console.log('Creating workspace:', this.workspace);

    this.auth.createWorkspace(this.workspace).subscribe({
      next: () => {
        this.auth.getWorkspaces(true).subscribe();

        this.workspace = { title: '', description: '', ownerId: '', members: [] };
        this.invitedMembers = [];
        this.inviteInput = '';
        this.suggestions = [];
        this.showCreateWorkspace = false;
      }
    });
  }

  openJoinWorkspace() {
    this.showCreateWorkspace = true;
    this.createModalMode = 'join';
  }

  closeJoinWorkspace() {
    this.showJoinWorkspace = false;
    this.joinInput = { inviteCode: '', workspaceLink: '' };
  }

  //pipam
  joinWorkspace() {
    const code = this.joinInput.inviteCode?.trim();
    const link = this.joinInput.workspaceLink?.trim();

    if (!code && !link) return;

    if (code) {
      this.auth.joinWorkspaceByCode(code).subscribe({
        next: () => this.afterJoinSuccess(),
        error: err => console.error(err)
      });
      return;
    }

    if (link) {
      const publicId = this.extractPublicIdFromLink(link);

      if (!publicId) {
        console.error("Invalid link");
        return;
      }

      this.auth.joinWorkspaceByLink(publicId).subscribe({
        next: () => this.afterJoinSuccess(),
        error: err => console.error(err)
      });
    }
  }

  extractPublicIdFromLink(link: string): string | null {
    try {
      const url = new URL(link);
      const parts = url.pathname.split('/');

      return parts[parts.length - 1];
    } catch {
      return null;
    }
  }

  afterJoinSuccess() {
    this.auth.getWorkspaces(true).subscribe();

    this.joinInput = {
      inviteCode: '',
      workspaceLink: ''
    };

    this.closeCreateWorkspace();
  }

  onInviteInputChange(value: string) {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    this.searchTimeout = setTimeout(() => {
      if (value.length < 2) {
        this.suggestions = [];
        return;
      }

      this.auth.searchUsers(value).subscribe({
        next: (res: any) => {
          this.suggestions = res.filter((u: any) =>
            !this.invitedMembers.some(m => m.emailOrUsername === u.userName)
          );
        },
        error: () => {
          this.suggestions = [];
        }
      });
    }, 300);
  }

  selectUser(user: any) {
    this.invitedMembers.push({
      role: 0, 
      emailOrUsername: user.userName
    });
    this.inviteInput = '';
    this.suggestions = [];
  }

  removeMember(member: WorkspaceMember) {
    this.invitedMembers = this.invitedMembers.filter(m => m !== member);
  }

  async signOut(){
    await this.dmService.stopConnection();
    this.auth.logout().subscribe({
      next: () => {
        window.location.href = '/dashboard';
      }
    });
  }

  getTimeGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }
}
