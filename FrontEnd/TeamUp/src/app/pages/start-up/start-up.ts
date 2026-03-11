import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Renderer2 } from '@angular/core';

@Component({
  selector: 'app-start-up',
  imports: [CommonModule],
  templateUrl: './start-up.html',
  styleUrl: './start-up.css',
})
export class StartUp {
  @ViewChild('pageDiv') pageDiv!: any;
  showStartup = true;
  isDarkMode: boolean = false;

  constructor(private router: Router, private renderer: Renderer2) { }

  ngOnInit(): void {
    setTimeout(() => {
      this.showStartup = false; 
      this.router.navigate(['/dashboard']);
    }, 3000); 
  }

  ngAfterViewInit() {
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
}
