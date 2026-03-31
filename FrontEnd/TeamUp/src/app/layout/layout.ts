import { Component } from '@angular/core';
import { Auth } from '../services/auth/auth';
import { RouterOutlet, RouterLinkWithHref, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { HostListener } from '@angular/core';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLinkWithHref, CommonModule],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  isSidebarOpen = false;
  isDesktopSidebarCollapsed = false;
  isDarkMode = false;
  isSettingsOpen = false;
  activeLink: string = '';

  workspaces : any[] = [];

  constructor(private auth: Auth, private router: Router) {}
  
  user$!: Observable<any>;
  workspaces$!: Observable<any[]>;


  ngOnInit() {
    this.user$ = this.auth.user$;
    this.workspaces$ = this.auth.workspaces$;

    this.auth.getWorkspaces().subscribe();

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
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode.toString());

    console.log('Dark mode set to:', this.isDarkMode);
  }

  logout() {
    this.auth.logout(); 
    this.router.navigate(['/login']);
  }

}
