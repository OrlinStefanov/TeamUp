import { Component } from '@angular/core';
import { Auth } from '../services/auth/auth';
import { RouterOutlet, RouterLinkWithHref } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLinkWithHref, CommonModule],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  userProfile: any = null;
  isSidebarOpen = false;
  isDesktopSidebarCollapsed = false;
  isDarkMode = false;

  workspaces : any[] = [{ id: 1, name: 'Team Up' },
  { id: 2, name: 'School Project' },
  { id: 3, name: 'Startup' }];

  constructor(private auth: Auth) {}

  ngOnInit() {
    this.userProfile = this.auth.getCurrentUser();

    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      this.isDarkMode = savedMode === 'true';
    }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
    console.log('Sidebar open:', this.isSidebarOpen);
  }

  toggleDesktopSidebar() {
    this.isDesktopSidebarCollapsed = !this.isDesktopSidebarCollapsed;
  }

  getWorkspaces() {
    this.auth.getWorkspaces().subscribe((response: any) => {
      this.workspaces = response;
      console.log('Workspaces:', this.workspaces);
    });
  }
}
