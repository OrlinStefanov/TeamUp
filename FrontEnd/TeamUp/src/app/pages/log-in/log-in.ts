import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginUser, RegisterUser } from '../../services/auth/auth-types';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';


@Component({
  selector: 'app-log-in',
  imports: [CommonModule, FormsModule, NgIf],
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
  isDarkMode: boolean = false;
  showConfirmReset = false;

  errorMessage : string = '';

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

  forgot_password() {
    if (!this.userData.emailOrUsername) {
      this.errorMessage = 'Please enter your email or username.';
      return;
    }

    this.auth.forgotPassword(this.userData.emailOrUsername).subscribe({
      next: (response) => {
        console.log('Password reset email sent:', response);
        this.closeResetConfirm();
      },
      error: (error) => {
        console.error('Password reset failed:', error);
        this.errorMessage = error.error || 'Password reset failed. Please try again.';
      }
    });
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

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  login() {
    this.auth.login(this.userData).subscribe({
      next: (response) => {
        console.log('Login successful:', response);
        window.location.href = '/dashboard';
      },
      error: (error) => {
        console.error('Login failed:', error);
        this.errorMessage = error.error || 'Login failed. Please try again.';
      }
    });
  }

  openResetConfirm() {
    this.showConfirmReset = true;
  }

  closeResetConfirm() {
    this.showConfirmReset = false;
  }

  sendResetEmail() {
    if (!this.userData.emailOrUsername) {
      this.errorMessage = 'Please enter your email or username.';
      return;
    }

    localStorage.setItem('resetEmail', this.userData.emailOrUsername);

    this.auth.forgotPassword(this.userData.emailOrUsername).subscribe({
      next: (response) => {
        console.log('Password reset email sent:', response);
        this.closeResetConfirm();
      }     ,
      error: (error) => {
        console.error('Password reset failed:', error);
        this.errorMessage = error.error || 'Password reset failed. Please try again.';
      }
    });
  }

}
