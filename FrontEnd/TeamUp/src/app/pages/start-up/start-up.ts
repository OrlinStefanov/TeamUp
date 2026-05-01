import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Renderer2 } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-start-up',
  imports: [CommonModule],
  templateUrl: './start-up.html',
  styleUrl: './start-up.css',
})
export class StartUp {
  @ViewChild('pageDiv') pageDiv!: any;
  showStartup = true;
  isDarkMode$!: Observable<boolean>;

  constructor(private router: Router, private renderer: Renderer2, private auth: Auth) { }

  ngOnInit(): void {
    this.isDarkMode$ = this.auth.darkMode$;

    setTimeout(() => {
      this.showStartup = false; 
      this.router.navigate(['/dashboard']);
      console.log('Navigating to dashboard...');
    }, 3000); 
  }

  ngAfterViewInit() {
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
}
