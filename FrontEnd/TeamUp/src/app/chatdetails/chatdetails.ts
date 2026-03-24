import { Component } from '@angular/core';
import { ChatService } from '../services/chat-services/chat-service';
import { FormsModule } from '@angular/forms';
import { Auth } from '../services/auth/auth';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-chatdetails',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterOutlet
],
  templateUrl: './chatdetails.html',
  styleUrl: './chatdetails.css',
})

export class Chatdetails {  
  channels: any[] = [];
  selectedWorkspaceId: number = 0;
  workspaceId : string = '';

  constructor(private chat: ChatService, private auth: Auth) {}

  ngOnInit() {
    this.workspaceId = window.location.pathname.split('/')[2]; // Assuming the workspace ID is in the URL path
    this.auth.getWorkspaceInfo(this.workspaceId).subscribe({
        next: (workspace) => {
          this.selectedWorkspaceId = workspace.id;
          this.loadChannels(this.selectedWorkspaceId)
        }
      }
    );
  }

  loadChannels(publicId: number) {
    this.selectedWorkspaceId = publicId;
    this.auth.getChannels(publicId).subscribe({
      next: (res) => {
        this.channels = res;
        console.log(this.channels);
      },
      error: (err) => {
        console.error('Failed to load channels:', err);
      }
    });
  }


  createChannel() {
    this.auth.createChannel(this.selectedWorkspaceId).subscribe({
      next: (res : any) =>
      {
        this.channels.push(res);
      }
    });
  }
}