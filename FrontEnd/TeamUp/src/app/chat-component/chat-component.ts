import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { ChatService } from '../services/chat-services/chat-service';
import { Auth } from '../services/auth/auth';
import { Observable } from 'rxjs';
import { DirectMessagesService } from '../services/direct-messages.service';

@Component({
  selector: 'app-chat-component',
  standalone: true,
  imports: [FormsModule, CommonModule, DatePipe],
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.css',
})
export class ChatComponent implements OnInit {
  @ViewChild('messageArea') messageAreaRef?: ElementRef<HTMLDivElement>;

  messages: any[] = [];
  currentChannelId = '';
  messageInput = '';
  workspacePublicId = '';

  channels: any[] = [];
  channel: any;

  unreadMap: any = {};
  currentUserId: string = '';

  typingUsers: any[] = [];
  typingTimeout: any;
  onlineUserIds = new Set<string>();

  isDarkMode$!: Observable<boolean>;

  constructor(
    private chat: ChatService,
    private route: ActivatedRoute,
    private router: Router,
    private auth: Auth,
    private dmService: DirectMessagesService
  ) {}

  ngOnInit() {
    this.currentUserId = this.auth.getUserId();
    this.isDarkMode$ = this.auth.darkMode$;
    this.dmService.startConnection().catch(() => {});
    this.dmService.onlineUserIds$.subscribe((ids: Set<string>) => {
      this.onlineUserIds = ids;
      const presenceReady = this.dmService.isPresenceReady();
      this.messages = this.messages.map(msg => {
        const senderId = msg.senderId ?? msg.SenderId;
        return {
          ...msg,
          sender: {
            ...msg.sender,
            isOnline: presenceReady
              ? ids.has(senderId)
              : (msg.sender?.isOnline === true || ids.has(senderId))
          }
        };
      });
    });

    this.route.parent?.parent?.paramMap.subscribe(params => {
      this.workspacePublicId = params.get('id') || '';
    });

    this.chat.startConnection().then(() => {

      this.chat.channels$.subscribe(ch => {
        this.channels = ch;
        if (this.currentChannelId) {
          this.channel = this.channels.find(c => c.publicId === this.currentChannelId);
        }
      });

      this.chat.unread$.subscribe(map => {
        this.unreadMap = map;
      });

      this.chat.typing$.subscribe(users => {
        this.typingUsers = users.filter(
          u => u.channelId === this.currentChannelId
        );
      });

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
        this.chat.resetUnread(this.currentChannelId);
        this.scrollToBottom();
      });

      this.route.params.subscribe(params => {
        const channelId = params['channelId'];
        if (channelId) this.loadChannel(channelId);
      });

    });
  }

  closeMobileChat(): void {
    if (!this.workspacePublicId) return;
    this.router.navigate(['/workspace', this.workspacePublicId, 'chat']);
  }

  onTyping() {
    this.chat.typing(this.currentChannelId);

    clearTimeout(this.typingTimeout);

    this.typingTimeout = setTimeout(() => {
      this.chat.stopTyping(this.currentChannelId);
    }, 1000);
  }

  loadChannel(channelId: string) {
    this.messages = [];
    this.currentChannelId = channelId;
    this.channel = this.channels.find(c => c.publicId === channelId);

    this.chat.joinChannel(channelId).finally(() => {
      this.chat.resetUnread(channelId);
    });

    this.chat.getMessages(channelId).subscribe((msgs: any) => {
      const cached = this.chat.getCachedMessages?.(channelId);

      this.messages = cached?.length ? cached : (msgs || []);

      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  sendMessage() {
    if (!this.messageInput.trim()) return;

    const content = this.messageInput;
    this.messageInput = '';

    this.chat.sendMessage(this.currentChannelId, content).finally(() => {
      this.chat.resetUnread(this.currentChannelId);
    });
  }

  scrollToBottom() {
    setTimeout(() => {
      const el = this.messageAreaRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  isSenderOnline(msg: any): boolean {
    const senderId = msg?.senderId ?? msg?.SenderId;
    return !!senderId && senderId !== this.currentUserId && this.onlineUserIds.has(senderId);
  }

  getLikeCount(msg: any): number {
    return msg.likes?.length ?? 0;
  }

  isMessageLikedByUser(msg: any): boolean {
    if (!msg.likes) return false;
    return msg.likes.some((like: any) => like.userId === this.currentUserId);
  }

  toggleLike(msg: any): void {
    if (!msg.publicId) return;

    const isLiked = this.isMessageLikedByUser(msg);

    if (isLiked) {
      this.chat.unlikeMessage(this.currentChannelId, msg.publicId).subscribe(() => {
        msg.likes = msg.likes.filter((like: any) => like.userId !== this.currentUserId);
      });
    } else {
      this.chat.likeMessage(this.currentChannelId, msg.publicId).subscribe((response: any) => {
        if (!msg.likes) msg.likes = [];
        msg.likes.push({ userId: this.currentUserId, userName: this.auth.getCurrentUser()?.userName });
      });
    }
  }

  toggleLikesList(msg: any): void {
    msg.showLikesList = !msg.showLikesList;
  }

  closeLikesList(msg: any): void {
    msg.showLikesList = false;
  }
}
