import { Component } from '@angular/core';
import { ChatService } from '../services/chat-services/chat-service';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Auth } from '../services/auth/auth';

@Component({
  selector: 'app-chat-component',
  imports: [FormsModule, DatePipe, NgIf, NgFor, CommonModule],
  standalone: true,
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.css',
})
export class ChatComponent {

  messages: any[] = [];
  currentChannelId: string = '';
  messageInput: string = '';
  currentUserId : string = '';

  channels : any;
  channel : any;

  constructor(
    private chat: ChatService,
    private route: ActivatedRoute,
    private auth: Auth
  ) {}

 ngOnInit() {
  this.currentUserId = this.auth.getUserId();

  this.chat.startConnection()
    .then(() => {
      console.log('SignalR connected');

      this.chat.onMessage((msg: any) => {
        console.log('Received message:', msg);
        this.messages.push(msg); 
        this.scrollToBottom();
      });

      this.channels = this.chat.channels$;

      this.route.params.subscribe(params => {
        const channelId = params['channelId'];

        if (channelId) {
          this.loadChannel(channelId);

          this.chat.channels$.subscribe((channels: any[]) => {
            this.channels = channels;

            this.channel = this.channels.find(
              (c: any) => c.publicId === this.currentChannelId
            );
          });
        }
      });
    })
    .catch(err => console.error('SignalR connection error:', err));
  }
  loadChannel(channelId: string) {

    this.messages = [];

    this.currentChannelId = channelId;

    this.chat.joinChannel(channelId);

    this.chat.getMessage(channelId).subscribe((msgs: any) => {
      this.messages = msgs;
      console.log(this.messages);
      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  sendMessage() {
    if (!this.messageInput.trim()) return;

    this.chat.sendMessage(this.currentChannelId, this.messageInput);

    this.messageInput = '';
  }

  scrollToBottom() {
    const el = document.querySelector('.chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }
}