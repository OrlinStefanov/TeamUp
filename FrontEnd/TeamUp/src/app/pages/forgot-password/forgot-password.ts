import { Component } from '@angular/core';
import { ElementRef, Renderer2, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgClass } from '@angular/common';
import { Auth } from '../../services/auth/auth';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, NgIf, NgClass],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  @ViewChild('pageDiv') pageDiv!: ElementRef;
  email: string = '';
  token: string = '';

  isDarkMode: boolean = false;
  showPassword = false;
  
  constructor(private renderer: Renderer2, private auth : Auth, private route: ActivatedRoute) {}

  ngOnInit() {
    const savedMode = localStorage.getItem('darkMode');

    if (savedMode !== null) {
      this.isDarkMode = savedMode === 'true';
    }

    if (this.isDarkMode) {
      this.renderer.addClass(this.pageDiv.nativeElement, 'dark-mode');
    } else {
      this.renderer.addClass(this.pageDiv.nativeElement, 'light-mode');
    }

    this.route.queryParams.subscribe(params => {
      this.email = params['email'];
      this.token = params['token'];
    });
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    
    localStorage.setItem('darkMode', String(this.isDarkMode));

    if(this.isDarkMode){
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

  resetPassword() {
      this.auth.resetPassword(localStorage.getItem('resetEmail') || '').subscribe({
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