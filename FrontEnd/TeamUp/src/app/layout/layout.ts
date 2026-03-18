import { Component } from '@angular/core';
import { Auth } from '../services/auth/auth';
import { RouterOutlet, RouterLinkWithHref } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
  activeLink: string = '';

  workspaces : any[] = [];

  constructor(private auth: Auth, private router: Router) {}

  ngOnInit() {
    this.userProfile = this.auth.getCurrentUser();

    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      this.isDarkMode = savedMode === 'true';
    }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
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

  setActive(link: string) {
    this.activeLink = link;
  }

  isActive(url: string) {
    return this.router.url === url;
  }
}
