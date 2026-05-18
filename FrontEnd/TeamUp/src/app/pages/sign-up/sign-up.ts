import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterUser } from '../../services/auth/auth-types';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

type SignUpStep = 'email' | 'verify' | 'details';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sign-up.html',
  styleUrls: ['./sign-up.css'],
})

export class SignUp {

  @ViewChild('pageDiv') pageDiv!: ElementRef;
  signUpStep: SignUpStep = 'email';
  verificationCode = '';

  userData: RegisterUser = {
    userName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    birthDate: new Date(),
    phoneNumber: ''
  };

  showPassword = false;
  isDarkMode$!: Observable<boolean>;

  errorMessage = '';
  isLoading = false;

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

  toggleDarkMode() {
    this.auth.toggleDarkMode();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  continueWithEmail() {
    this.errorMessage = '';
    const email = this.userData.email.trim();

    if (!email) {
      this.errorMessage = 'Email is required';
      return;
    }

    this.isLoading = true;
    this.auth.requestEmailVerificationCode(email).subscribe({
      next: () => {
        this.userData.email = email;
        this.signUpStep = 'verify';
        this.verificationCode = '';
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = this.extractErrorMessage(error, 'Failed to send verification code');
        this.isLoading = false;
      }
    });
  }

  verifyCode() {
    this.errorMessage = '';
    const code = this.verificationCode.trim();

    if (!code) {
      this.errorMessage = 'Verification code is required';
      return;
    }

    this.isLoading = true;
    this.auth.verifyEmail(this.userData.email, code).subscribe({
      next: () => {
        this.signUpStep = 'details';
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = this.extractErrorMessage(error, 'Verification failed');
        this.isLoading = false;
      }
    });
  }

  resendCode() {
    this.verificationCode = '';
    this.continueWithEmail();
  }

  goBack() {
    this.errorMessage = '';
    if (this.signUpStep === 'verify') {
      this.signUpStep = 'email';
      this.verificationCode = '';
    } else if (this.signUpStep === 'details') {
      this.signUpStep = 'verify';
    }
  }

  register() {
    this.errorMessage = '';
    this.isLoading = true;

    this.auth.register(this.userData).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.errorMessage = this.extractErrorMessage(error, 'Registration failed. Please try again.');
        this.isLoading = false;
      }
    });
  }

  private extractErrorMessage(error: { error?: unknown }, fallback: string): string {
    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }
    return fallback;
  }
}
