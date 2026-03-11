import { Component } from '@angular/core';
import { ElementRef, Renderer2, ViewChild } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgIf } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, CommonModule, NgIf],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
    @ViewChild('pageDiv') pageDiv!: ElementRef;

    isDarkMode: boolean = false;

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
}
