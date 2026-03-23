import { Component } from '@angular/core';
import { ChatService } from '../services/chat-services/chat-service';
import { FormsModule } from '@angular/forms';
import { Auth } from '../services/auth/auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chatdetails',
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './chatdetails.html',
  styleUrl: './chatdetails.css',
})

export class Chatdetails {
  messages: any[] = [];
  currentChannelId: string = '';
  messageInput: string = '';
  
  channels: any[] = [];
  selectedWorkspaceId: string = '';

  constructor(private chat: ChatService, private auth: Auth) {}

  ngOnInit() {
    this.chat.startConnection().then(() => {

      this.chat.onMessage((msg) => {
        this.messages.push(msg);
      });

    });
  }

  loadChannels(publicId: string) {
    this.selectedWorkspaceId = publicId;
    this.auth.getChannels(publicId).subscribe({
      next: (res) => {
        this.channels = res;
      },
      error: (err) => {
        console.error('Failed to load channels:', err);
      }
    });
  }

  selectChannel(channelId: string) {
    this.currentChannelId = channelId;

    this.chat.joinChannel(channelId);

    this.chat.getMessages(channelId).subscribe((msgs: any) => {
      this.messages = msgs;
    });
  }

  sendMessage() {
    if (!this.messageInput.trim()) return;

    this.chat.sendMessage(this.currentChannelId, this.messageInput);
    this.messageInput = '';
  }
}