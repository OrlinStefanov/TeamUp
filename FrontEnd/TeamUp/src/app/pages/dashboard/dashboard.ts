import { Component, ElementRef, Renderer2, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { Workspace, WorkspaceMember } from '../../services/auth/auth-types';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true, // Assuming standalone based on your imports
  imports: [
    FormsModule,
    CommonModule,
    RouterModule
],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, AfterViewInit {
  @ViewChild('pageDiv') pageDiv?: ElementRef;
  @ViewChild('joinWorkspaceModal') joinWorkspaceModal?: ElementRef;
  @ViewChild('createWorkspaceModal') createWorkspaceModal?: ElementRef;

  isDarkMode = false;
  showDropdown = false;
  showSettingsDropdown = false;
  showCreateWorkspace = false;
  showJoinWorkspace = false; // Added for Join Modal
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

  constructor(private renderer: Renderer2, private auth: Auth) {}

  ngOnInit() {
    this.user$ = this.auth.user$;
    this.workspaces$ = this.auth.workspaces$;

    this.auth.getWorkspaces().subscribe();
    const savedMode = localStorage.getItem('darkMode');
    this.isDarkMode = savedMode === 'true';
  }

  ngAfterViewInit() {
    this.applyTheme();
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', String(this.isDarkMode));
    this.applyTheme();
  }

  applyTheme() {
    if (!this.pageDiv) return;
    if (!this.joinWorkspaceModal) return;
    if (!this.createWorkspaceModal) return;
    if (this.isDarkMode) {
      this.renderer.removeClass(this.pageDiv.nativeElement, 'light-mode');
      this.renderer.removeClass(this.joinWorkspaceModal.nativeElement, 'light-mode');
      this.renderer.removeClass(this.createWorkspaceModal.nativeElement, 'light-mode');
      this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
      this.renderer.addClass(this.joinWorkspaceModal.nativeElement, 'dark-mode');
      this.renderer.addClass(this.createWorkspaceModal.nativeElement, 'dark-mode');
    } else {
      this.renderer.removeClass(this.pageDiv.nativeElement, 'dark-mode');
      this.renderer.removeClass(this.joinWorkspaceModal.nativeElement, 'dark-mode');
      this.renderer.removeClass(this.createWorkspaceModal.nativeElement, 'dark-mode');
      this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
      this.renderer.addClass(this.joinWorkspaceModal.nativeElement, 'light-mode');
      this.renderer.addClass(this.createWorkspaceModal.nativeElement, 'light-mode');
    }
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