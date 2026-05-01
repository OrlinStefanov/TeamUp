import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterUser } from '../../services/auth/auth-types';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sign-up.html',
  styleUrls: ['./sign-up.css'],
})

export class SignUp {

  @ViewChild('pageDiv') pageDiv!: ElementRef;
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

  toggleDarkMode() {
    this.auth.toggleDarkMode();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  register() {
    this.auth.register(this.userData).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.error('Registration failed:', error);
        this.errorMessage = error.error || 'Registration failed. Please try again.';
      }
    });
  }
}
