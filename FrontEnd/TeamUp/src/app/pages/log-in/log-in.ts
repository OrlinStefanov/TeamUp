import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginUser, RegisterUser } from '../../services/auth/auth-types';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-log-in',
  imports: [CommonModule, FormsModule],
  templateUrl: './log-in.html',
  styleUrl: './log-in.css',
})
export class LogIn {

  @ViewChild('pageDiv') pageDiv!: ElementRef;
  userData: LoginUser = {
    emailOrUsername: '',
    password: ''
  };

  showPassword = false;
  isDarkMode = false;

  constructor(private renderer: Renderer2, private auth: Auth) {}

  ngOnInit() {
    this.auth.me();
  }

  ngAfterViewInit() {
    this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;

    if (this.isDarkMode) {
      this.renderer.removeClass(this.pageDiv.nativeElement, 'light-mode');
      this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
    } else {
      this.renderer.removeClass(this.pageDiv.nativeElement, 'dark-mode');
      this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

}
