import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgIf, NgFor, DatePipe } from '@angular/common';
import { ChatService } from '../services/chat-services/chat-service';
import { Auth } from '../services/auth/auth';

@Component({
  selector: 'app-chat-component',
  standalone: true,
  imports: [FormsModule, CommonModule, NgIf, NgFor, DatePipe],
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.css',
})
export class ChatComponent {

  messages: any[] = [];
  currentChannelId = '';
  messageInput = '';

  channels: any[] = [];
  channel: any;

  unreadMap: any = {};
  currentUserId: string = '';

  typingUsers: any[] = [];
  typingTimeout: any;

  isDarkMode: boolean = false;
  
  constructor(
    private chat: ChatService,
    private route: ActivatedRoute,
    private auth: Auth
  ) {}

  ngOnInit() {
    this.currentUserId = this.auth.getUserId();
    this.chat.startConnection().then(() => {

      // CHANNELS
      this.chat.channels$.subscribe(ch => {
        this.channels = ch;
      });

      // UNREAD
      this.chat.unread$.subscribe(map => {
        this.unreadMap = map;
      });

      this.chat.typing$.subscribe(users => {
        this.typingUsers = users.filter(
          u => u.channelId === this.currentChannelId
        );
      });

      // INCOMING MESSAGES
      this.chat.incomingMessage$.subscribe((msg: any) => {
        if (!msg) return;

        if (msg.senderId === this.currentUserId) {
          this.messages.push(msg);
          this.scrollToBottom();
          return;
        }

        if (msg.channelId !== this.currentChannelId) {
          this.chat.increaseUnread(msg.channelId);
          return;
        }

        this.messages.push(msg);
        this.scrollToBottom();
      });

      // ROUTE
      this.route.params.subscribe(params => {
        const channelId = params['channelId'];
        if (channelId) this.loadChannel(channelId);
      });

    });

    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      this.isDarkMode = savedMode === 'true';
    }
  }

  onTyping() {
    this.chat.typing(this.currentChannelId);

    clearTimeout(this.typingTimeout);

    this.typingTimeout = setTimeout(() => {
      this.chat.stopTyping(this.currentChannelId);
    }, 1000);
  }

  // =========================
  // LOAD CHANNEL
  // =========================

  loadChannel(channelId: string) {

    this.messages = [];
    this.currentChannelId = channelId;

    this.chat.joinChannel(channelId);

    // reset unread
    this.chat.resetUnread(channelId);

    // set channel
    this.channel = this.channels.find(c => c.publicId === channelId);

    // load messages (cached)
    this.chat.getMessages(channelId).subscribe((msgs: any) => {
      const cached = this.chat.getCachedMessages?.(channelId);

      this.messages = cached?.length ? cached : (msgs || []);

      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  // =========================
  // SEND MESSAGE
  // =========================

  sendMessage() {
    if (!this.messageInput.trim()) return;

    this.chat.sendMessage(this.currentChannelId, this.messageInput);
    this.messageInput = '';
  }

  // =========================
  // UI HELPERS
  // =========================

  scrollToBottom() {
    const el = document.querySelector('.chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }
}