import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { Auth } from '../../services/auth/auth';
import { DirectMessagesService, DmConversation, DmMessage } from '../../services/direct-messages.service';

@Component({
  selector: 'app-personal-dms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personal-dms.html',
  styleUrl: './personal-dms.css',
})
export class PersonalDms implements OnInit, OnDestroy {
  @ViewChild('personSearchInput') personSearchInput?: ElementRef<HTMLInputElement>;

  isDarkMode$: Observable<boolean>;
  filterText = '';
  searchText = '';
  messageText = '';
  isNewMessageOpen = false;
  isMobileChatOpen = false;
  selectedConversationId: string | null = null;
  conversations: DmConversation[] = [];
  messages: DmMessage[] = [];

  private subscription = new Subscription();
  private currentConversationId: string | null = null;

  constructor(
    public auth: Auth,
    private dmService: DirectMessagesService
  ) {
    this.isDarkMode$ = this.auth.darkMode$;
  }

  ngOnInit() {
    this.dmService.startConnection().catch(() => {
      // connection may fail if user is not authenticated yet
    });

    this.loadConversations();

    this.subscription.add(
      this.dmService.incomingMessage$.subscribe((message) => {
        if (!message || message.conversationId !== this.selectedConversationId) {
          return;
        }

        this.messages = [...this.messages, message];
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.currentConversationId) {
      this.dmService.leaveConversation(this.currentConversationId).catch(() => {});
    }
  }

  get filteredChats() {
    const query = this.filterText.trim().toLowerCase();
    const views = this.conversations.map(conversation => this.buildChatView(conversation));

    if (!query) {
      return views;
    }

    return views.filter((chat) =>
      [chat.name, chat.handle, chat.preview]
        .some(value => value.toLowerCase().includes(query))
    );
  }

  get selectedChat() {
    const conversation = this.conversations.find(c => c.publicId === this.selectedConversationId)
      ?? this.conversations[0];

    if (!conversation) {
      return {
        name: 'No conversation selected',
        handle: '@direct',
        preview: 'Select a conversation from the list',
        time: '',
        initials: 'DM',
        status: 'offline' as 'online' | 'away' | 'offline',
        accent: '#888888',
      };
    }

    return this.buildChatView(conversation);
  }

  private buildChatView(conversation: DmConversation) {
    const otherMember = conversation.members.find(m => m.userId !== this.auth.getUserId());
    const name = conversation.isGroup
      ? conversation.title ?? 'Group conversation'
      : otherMember?.userName ?? 'Direct message';

    const handle = conversation.isGroup
      ? '@group'
      : otherMember?.userName ? `@${otherMember.userName}` : '@direct';

    const preview = conversation.lastMessage?.content ?? 'No messages yet';
    const time = conversation.lastMessageAt ? this.formatDate(conversation.lastMessageAt) : '';
    const initials = conversation.isGroup
      ? (conversation.title ? this.buildInitials(conversation.title) : 'GR')
      : this.buildInitials(otherMember?.userName ?? 'DM');

    return {
      publicId: conversation.publicId,
      name,
      handle,
      preview,
      time,
      initials,
      status: 'online' as 'online' | 'away' | 'offline',
      accent: this.colorFromId(conversation.publicId),
    };
  }

  openNewMessage() {
    this.isNewMessageOpen = true;
    this.searchText = '';

    setTimeout(() => this.personSearchInput?.nativeElement.focus(), 0);
  }

  closeNewMessage() {
    this.isNewMessageOpen = false;
    this.searchText = '';
  }

  selectChat(conversationId: string) {
    if (this.currentConversationId && this.currentConversationId !== conversationId) {
      this.dmService.leaveConversation(this.currentConversationId).catch(() => {});
    }

    this.selectedConversationId = conversationId;
    this.currentConversationId = conversationId;
    this.isMobileChatOpen = true;

    this.dmService.startConnection()
      .then(() => this.dmService.joinConversation(conversationId))
      .catch(() => null);

    this.loadMessages(conversationId);
    this.dmService.markAsRead(conversationId).catch(() => {});
  }

  closeMobileChat() {
    this.isMobileChatOpen = false;
  }

  sendMessage() {
    const text = this.messageText.trim();
    if (!text || !this.selectedConversationId) {
      return;
    }

    this.dmService.sendMessage(this.selectedConversationId, text)
      .then(() => {
        this.messageText = '';
      })
      .catch(() => {
        // silently ignore send failure for now
      });
  }

  startConversation() {
    const identifier = this.searchText.trim();
    if (!identifier) {
      return;
    }

    this.dmService.startDirectMessage([identifier], null, false)
      .subscribe(conversation => {
        this.isNewMessageOpen = false;
        this.searchText = '';

        if (!this.conversations.some(c => c.publicId === conversation.publicId)) {
          this.conversations = [conversation, ...this.conversations];
        }

        this.selectChat(conversation.publicId);
      });
  }

  private loadConversations() {
    this.dmService.getConversations()
      .subscribe(conversations => {
        this.conversations = conversations;
        if (!this.selectedConversationId && conversations.length > 0) {
          this.selectChat(conversations[0].publicId);
        }
      });
  }

  private loadMessages(conversationId: string) {
    this.dmService.getMessages(conversationId)
      .subscribe(response => {
        this.messages = response.messages.map(msg => ({
          ...msg,
          conversationId: response.conversationId
        }));
      });
  }

  private formatDate(value: string) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private buildInitials(value: string) {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0].toUpperCase())
      .join('')
      .slice(0, 2);
  }

  private getConversationLabel(conversation: DmConversation) {
    return conversation.title ?? conversation.members.map(m => m.userName).filter(Boolean).join(', ');
  }

  private colorFromId(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    const color = `hsl(${hash % 360}, 62%, 45%)`;
    return color;
  }
}
