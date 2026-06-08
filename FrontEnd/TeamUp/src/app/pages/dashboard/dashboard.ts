import { Component, OnInit } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { Workspace, WorkspaceMember } from '../../services/auth/auth-types';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { map, Observable } from 'rxjs';
import { CdkDragPlaceholder } from "@angular/cdk/drag-drop";
import { InboxService } from '../../services/inbox.service';

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
export class Dashboard implements OnInit {
  showDropdown = false;
  showSettingsDropdown = false;
  showCreateWorkspace = false;
  showJoinWorkspace = false;
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
  
  //inbox messages
  inboxUnreadCounts = new Map<string, number>(); 

  constructor(private auth: Auth, private inboxService: InboxService) {}

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

  this.auth.getWorkspaces().subscribe(workspaces => {
      if (!workspaces) return;

      for (const workspace of workspaces) {
        this.inboxService.setWorkspace(workspace.publicId);
        this.inboxService.getInboxMessages(1).subscribe(response => {
          this.inboxUnreadCounts.set(workspace.publicId, response.unreadCount);
        });
      }
    });      
  }

  inboxUnreadCount(workspace: any): number {
    return this.inboxUnreadCounts.get(workspace.publicId) ?? 0;
  }

  updateWorkspace() {
    this.selectedWorkspace.members = this.editMembers.filter(m => m.id !== this.selectedWorkspace.ownerId);
    console.log('update', this.selectedWorkspace);
    this.auth.editWorkspace(this.selectedWorkspace).subscribe();
    
    this.showEditWorkspace = false;
  }

  deleteWorkspace() {
    this.auth.deleteWorkspace(this.selectedWorkspace.publicId).subscribe(() => {
      this.auth.getWorkspaces(true).subscribe();
    });
    console.log('delete', this.selectedWorkspace);

    this.showDeleteWorkspace = false;
  }

  onEditInputChange(value: string) {
    // call your API (same as create modal)
    console.log('search user', value);
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
    const exists = this.editMembers.some(m => m.id === user.id);
    if (!exists) {
      this.editMembers.push(user);
    }

    this.editInviteInput = '';
    this.editSuggestions = [];
  }

  removeEditMember(member: any) {
    this.editMembers = this.editMembers.filter(m => m.id !== member.id);
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
    this.selectedWorkspace = { ...workspace};

    this.showSettings = true;
    console.log(this.selectedWorkspace);

    setTimeout(() => {
      const modalEl = document.getElementById('settingsModal');
      const modal = new (window as any).bootstrap.Modal(modalEl);
      modal.show();
    });
  }

  closeSettings()
  {
    this.showSettings = false;
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
  }
  
  closeCreateWorkspace() {
    this.showCreateWorkspace = false;
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
    this.showJoinWorkspace = true;
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

    this.closeJoinWorkspace();
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

  signOut(){
    this.auth.logout().subscribe({
      next: () => {
        window.location.href = '/dashboard';
      }
    });
  }
}
