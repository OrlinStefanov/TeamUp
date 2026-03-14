import { Component } from '@angular/core';
import { ElementRef, Renderer2, ViewChild } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
    @ViewChild('pageDiv') pageDiv!: ElementRef;

    isDarkMode: boolean = false;
    showDropdown = false;
    showSettingsDropdown = false;
    showCreateWorkspace = false;
    timeout: any;

    workspaces = [
      { name: 'Design Team' },
      { name: 'Marketing' },
      { name: 'Development' }
    ];

    constructor(private renderer: Renderer2, private auth: Auth) {}

    ngOnInit() {
    this.auth.me();

    const savedMode = localStorage.getItem('darkMode');

    if (savedMode !== null) {
      this.isDarkMode = savedMode === 'true';
    }

    if (this.isDarkMode) {
      this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
    } else {
      this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
    }
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;

    localStorage.setItem('darkMode', String(this.isDarkMode));

    if (this.isDarkMode) {
      this.renderer.removeClass(this.pageDiv.nativeElement, 'light-mode');
      this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
    } else {
      this.renderer.removeClass(this.pageDiv.nativeElement, 'dark-mode');
      this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
    }
  }

  showDropDown() {
    this.showDropdown = !this.showDropdown;
  }

  showSettingsDropDown() {
    this.showSettingsDropdown = !this.showSettingsDropdown;
  }

  openCreateWorkspace(){
    this.showCreateWorkspace = true;
  }

  closeCreateWorkspace(){
    this.showCreateWorkspace = false;
  }

  closeMenu() {
    this.timeout = setTimeout(() => {
      this.showDropdown = false;
    }, 90);
  }

  closeSettingsMenu() {
    this.timeout = setTimeout(() => {
      this.showSettingsDropdown = false;
    }, 90);
  }

  signOut(){
    this.auth.logout();
  }
  
  createWorkspace(){
    const input = document.getElementsByName("workspaceName")[0] as HTMLInputElement;

    if (!input) return; // ако няма input, спираме

    const value: string = input.value.trim();

    if (value) {
      this.workspaces.push({ name: value }); // добавяме новия workspace
      input.value = ''; // чистим input
      console.log(this.workspaces);
      this.showCreateWorkspace = false;
    }

    
  }

}
