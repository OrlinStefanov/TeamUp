import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginUser, RegisterUser } from '../../services/auth/auth-types';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';


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
  isDarkMode$!: Observable<boolean>;
  showConfirmReset = false;

  errorMessage : string = '';

  constructor(private renderer: Renderer2, private auth: Auth, private router: Router) {}

  ngOnInit() {
    this.auth.me();
    this.isDarkMode$ = this.auth.darkMode$;

    const savedMode = this.auth.getCurrentDarkMode();
    if (savedMode) {
      this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
    } else {
      this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
    }

    this.isDarkMode$.subscribe(isDark => {
      if (isDark) {
        this.renderer.removeClass(this.pageDiv.nativeElement, 'light-mode');
        this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
      } else {
        this.renderer.removeClass(this.pageDiv.nativeElement, 'dark-mode');
        this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
      }
    });
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
    this.auth.toggleDarkMode();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  login() {
    this.auth.login(this.userData).subscribe({
      next: (response) => {
        console.log('Login successful:', response);
        localStorage.setItem('token', response.token);
        this.router.navigate(['/dashboard']);
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
