import { Component, HostListener, OnInit } from '@angular/core';
import { Auth } from '../services/auth/auth';
import { RouterOutlet, RouterLinkWithHref, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { Workspace, WorkspaceMember } from '../services/auth/auth-types';
import { DirectMessagesService } from '../services/direct-messages.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLinkWithHref, CommonModule, FormsModule],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout implements OnInit {
  isSidebarOpen = false;
  isDesktopSidebarCollapsed = false;
  isSettingsOpen = false;
  isMyWorkspacesOpen = true;
  isSharedWorkspacesOpen = true;
  activeLink: string = '';

  workspaces: any[] = [];

  showCreateWorkspace = false;
  showJoinWorkspace = false;
  createModalMode: 'create' | 'join' = 'create';

  workspace: Workspace = {
    title: '',
    description: '',
    ownerId: '',
    members: [],
  };

  joinInput = {
    inviteCode: '',
    workspaceLink: '',
  };

  inviteInput = '';
  suggestions: any[] = [];
  invitedMembers: WorkspaceMember[] = [];
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(private auth: Auth, private router: Router, private dmService: DirectMessagesService) {}

  user$!: Observable<any>;
  workspaces$!: Observable<any[]>;
  myWorkspaces$!: Observable<any[]>;
  sharedWorkspaces$!: Observable<any[]>;
  isDarkMode$!: Observable<boolean>;
  totalDmUnread$!: Observable<number>;
  currentUserId = '';

  ngOnInit() {
    this.user$ = this.auth.user$;
    this.workspaces$ = this.auth.workspaces$;
    this.isDarkMode$ = this.auth.darkMode$;
    this.currentUserId = this.auth.getUserId();
    this.myWorkspaces$ = this.workspaces$.pipe(
      map(workspaces => (workspaces || []).filter(w => w.ownerId === this.currentUserId))
    );
    this.sharedWorkspaces$ = this.workspaces$.pipe(
      map(workspaces => (workspaces || []).filter(w => w.ownerId !== this.currentUserId))
    );

    this.auth.getWorkspaces().subscribe();
    this.totalDmUnread$ = this.dmService.totalUnread$;
    this.dmService.startConnection()
      .then(() => {
        this.dmService.getConversations().subscribe(conversations => {
          conversations.forEach(c => this.dmService.joinConversation(c.publicId).catch(() => {}));
        });
      })
      .catch(() => this.dmService.getConversations().subscribe());
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleDesktopSidebar() {
    this.isDesktopSidebarCollapsed = !this.isDesktopSidebarCollapsed;
  }

  toggleMyWorkspaces() {
    this.isMyWorkspacesOpen = !this.isMyWorkspacesOpen;
  }

  toggleSharedWorkspaces() {
    this.isSharedWorkspacesOpen = !this.isSharedWorkspacesOpen;
  }

  openWorkspace(id: string) {
    this.router.navigate(['/workspace', id, 'tasks']);
  }

  setActive(link: string) {
    this.activeLink = link;
  }

  isActive(url: string) {
    return this.router.url === url;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.settings-wrapper')) {
      this.isSettingsOpen = false;
    }
  }

  toggleSettings() {
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  toggleTheme() {
    this.auth.toggleDarkMode();
  }

  async logout() {
    await this.dmService.stopConnection();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
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
    this.suggestions = [];
  }

  createWorkspace() {
    if (!this.workspace.title.trim()) {
      console.log('Workspace name is required');
      return;
    }

    this.workspace.members = [...this.invitedMembers];

    this.auth.createWorkspace(this.workspace).subscribe({
      next: () => {
        this.auth.getWorkspaces(true).subscribe();

        this.workspace = { title: '', description: '', ownerId: '', members: [] };
        this.invitedMembers = [];
        this.inviteInput = '';
        this.suggestions = [];
        this.showCreateWorkspace = false;
      },
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

  joinWorkspace() {
    const code = this.joinInput.inviteCode?.trim();
    const link = this.joinInput.workspaceLink?.trim();

    if (!code && !link) return;

    if (code) {
      this.auth.joinWorkspaceByCode(code).subscribe({
        next: () => this.afterJoinSuccess(),
        error: (err) => console.error(err),
      });
      return;
    }

    if (link) {
      const publicId = this.extractPublicIdFromLink(link);

      if (!publicId) {
        console.error('Invalid link');
        return;
      }

      this.auth.joinWorkspaceByLink(publicId).subscribe({
        next: () => this.afterJoinSuccess(),
        error: (err) => console.error(err),
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
      workspaceLink: '',
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
          this.suggestions = res.filter(
            (u: any) =>
              !this.invitedMembers.some((m) => m.emailOrUsername === u.userName)
          );
        },
        error: () => {
          this.suggestions = [];
        },
      });
    }, 300);
  }

  selectUser(user: any) {
    this.invitedMembers.push({
      role: 0,
      emailOrUsername: user.userName,
    });
    this.inviteInput = '';
    this.suggestions = [];
  }

  removeMember(member: WorkspaceMember) {
    this.invitedMembers = this.invitedMembers.filter((m) => m !== member);
  }
}
