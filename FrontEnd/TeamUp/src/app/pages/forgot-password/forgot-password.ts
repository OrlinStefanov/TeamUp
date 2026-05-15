import { Component } from '@angular/core';
import { ElementRef, Renderer2, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, NgClass } from '@angular/common';
import { Auth } from '../../services/auth/auth';
import { ActivatedRoute } from '@angular/router';
import { ResetUser } from '../../services/auth/auth-types';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, NgClass, AsyncPipe],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  @ViewChild('pageDiv') pageDiv!: ElementRef;
  email: string = '';
  token: string = '';

  isDarkMode$!: Observable<boolean>;
  showPassword = false;
  
  constructor(private renderer: Renderer2, private auth : Auth, private route: ActivatedRoute) {}

  ngOnInit() {
    this.isDarkMode$ = this.auth.darkMode$;

    const savedMode = this.auth.getCurrentDarkMode();
    if (savedMode) {
      this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
    } else {
      this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
    }

    this.email = this.route.snapshot.queryParamMap.get('email') || '';
    this.token = this.route.snapshot.queryParamMap.get('token') || '';

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

  resetPassword() {
      const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
      const confirmPasswordInput = document.querySelector('input[name="confirm-password"]') as HTMLInputElement;

      if (passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordInput.setCustomValidity("Passwords do not match");
        confirmPasswordInput.reportValidity();
        return;
      }

      const user_reset: ResetUser = {
        emailOrUsername: this.email || '',
        token: this.token || '',
        newPassword: (document.querySelector('input[name="password"]') as HTMLInputElement).value
      }

      this.auth.resetPassword(user_reset).subscribe({
        next: (response) => {
          console.log('Password reset email sent:', response);
        },
        error: (error) => {
          console.error('Password reset failed:', error);
        }
      });
  }

  checkPasswordsMatch() {
    const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
    const confirmPasswordInput = document.querySelector('input[name="confirm-password"]') as HTMLInputElement;

    if (passwordInput.value !== confirmPasswordInput.value) {
      confirmPasswordInput.setCustomValidity("Passwords do not match");
    } else {
      confirmPasswordInput.setCustomValidity("");
    }
  }
}
