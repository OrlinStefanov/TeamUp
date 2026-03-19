import { Component, ElementRef, Renderer2, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { Workspace, WorkspaceMember } from '../../services/auth/auth-types';
import { CommonModule, NgFor, NgIf, NgIfContext } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [
    FormsModule,
    CommonModule,
    RouterModule,
    NgIf,
    NgFor
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements AfterViewInit {
  @ViewChild('pageDiv') pageDiv?: ElementRef;

  isDarkMode = false;
  showDropdown = false;
  showSettingsDropdown = false;
  showCreateWorkspace = false;
  timeout: any;

  suggestions: any[] = [];
  invitedMembers: WorkspaceMember[] = [];

  private searchTimeout: any;

  user$!: Observable<any>;
  workspaces$!: Observable<any[]>; // тук ще държим списъка с workspaces, който ще се зарежда от бекенда
    workspace: Workspace = {
      title: '',
      description: '',
      ownerId: '',
      members: []
    };
      inviteInput: string = '';
  newWorkspaceName = '';
  newWorkspaceDesc = '';
  newWorkspaceInvite = '';

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
    if (this.isDarkMode) {
      this.renderer.removeClass(this.pageDiv.nativeElement, 'light-mode');
      this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
    } else {
      this.renderer.removeClass(this.pageDiv.nativeElement, 'dark-mode');
      this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
    }
  }


  closeMenu() {
    this.timeout = setTimeout(() => {
      this.showDropdown = false;
    }, 90);
  }

  openCreateWorkspace() {
    this.showCreateWorkspace = true;
  }
  closeCreateWorkspace() {
    this.showCreateWorkspace = false;
  }

  closeSettingsMenu() {
    this.timeout = setTimeout(() => {
      this.showSettingsDropdown = false;
    }, 90);
  }

  signOut(){
    this.auth.logout().subscribe({
      next: () => {
        console.log('Logged out successfully');
        window.location.href = '/dashboard';
      },
      error: (error) => {
        console.error('Logout failed:', error);
      }
    });
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
      role: 0, // member role
      emailOrUsername: user.userName
    });

    this.inviteInput = '';
    this.suggestions = [];
  }


  removeMember(member: WorkspaceMember) {
    this.invitedMembers = this.invitedMembers.filter(m => m !== member);
  }
}