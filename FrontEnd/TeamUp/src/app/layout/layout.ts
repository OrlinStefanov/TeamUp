import { Component } from '@angular/core';
import { Auth } from '../services/auth/auth';
import { RouterOutlet, RouterLinkWithHref } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLinkWithHref],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  userProfile : any = null;
  constructor(private auth: Auth) {}

  ngOnInit() {
    this.userProfile = this.auth.getCurrentUser();
  }
}
