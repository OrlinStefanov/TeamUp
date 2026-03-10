import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterUser } from '../../services/auth/auth-types';
import { Auth } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  providers: [Auth],
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
  isDarkMode = false;

  constructor(private renderer: Renderer2, private auth: Auth) {}

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

  register() {
    this.auth.register(this.userData);
  }
}