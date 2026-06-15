import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { Auth } from '../../services/auth/auth';
import { DirectMessagesService, DmConversation, DmMessage, UserSearchResult } from '../../services/direct-messages.service';
import { Router } from '@angular/router';

type ChatView = {
  publicId?: string;
  name: string;
  handle: string;
  preview: string;
  time: string;
  initials: string;
  status: 'online' | 'away' | 'offline';
  accent: string;
  isGroup: boolean;
};

@Component({
  selector: 'app-personal-dms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personal-dms.html',
  styleUrl: './personal-dms.css',
})
export class PersonalDms implements OnInit, OnDestroy {
  @ViewChild('personSearchInput') personSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('messageArea') messageAreaRef?: ElementRef<HTMLDivElement>;

  isDarkMode$: Observable<boolean>;
  unread$!: Observable<Record<string, number>>;
  filterText = '';

  searchText = '';
  searchResults: UserSearchResult[] = [];
  selectedUser: UserSearchResult | null = null;
  selectedGroupMembers: UserSearchResult[] = [];
  isSearching = false;

  newMessageMode: 'direct' | 'group' = 'direct';
  groupTitle = '';

  messageText = '';
  isNewMessageOpen = false;
  isAddMemberOpen = false;
  isMobileChatOpen = false;
  selectedConversationId: string | null = null;
  conversations: DmConversation[] = [];
  messages: DmMessage[] = [];
  hasMoreMessages = false;
  isLoadingOlderMessages = false;

  typingUsers: string[] = [];

  private subscription = new Subscription();
  private currentConversationId: string | null = null;
  private typingTimeout: any;
  private typingSub?: Subscription;
  private oldestMessageId: string | null = null;
  private searchTimeout: any;

  constructor(
    public auth: Auth,
    private dmService: DirectMessagesService,
    private router: Router
  ) {
    this.isDarkMode$ = this.auth.darkMode$;
    this.unread$ = this.dmService.unread$;
  }

  ngOnInit() {
    this.dmService.startConnection().catch(() => {
      this.router.navigate(['/dashboard']);
    });

    this.loadConversations();

    this.subscription.add(
      this.dmService.incomingMessage$.subscribe((message) => {
        if (!message?.conversationId) return;

        this.updateConversationPreview(message);

        if (message.conversationId !== this.selectedConversationId) {
          return;
        }

        if (message.senderId === this.auth.getUserId()) {
          return;
        }

        this.messages = [...this.messages, message];
        this.scrollToBottom();
      })
    );
  }

  onTyping() {
    if (!this.selectedConversationId) return;

    this.dmService.typing(this.selectedConversationId);

    clearTimeout(this.typingTimeout);

    this.typingTimeout = setTimeout(() => {
      this.dmService.stopTyping(this.selectedConversationId!);
    }, 1200);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.typingSub?.unsubscribe();

    if (this.currentConversationId) {
      this.dmService.leaveConversation(this.currentConversationId).catch(() => {});
    }
  }

  get filteredChats(): ChatView[] {
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

  get selectedChat(): ChatView {
    const conversation = this.conversations.find(c => c.publicId === this.selectedConversationId);

    if (!conversation) {
      return {
        name: 'No conversation selected',
        handle: '@direct',
        preview: 'Select a conversation from the list',
        time: '',
        initials: 'DM',
        status: 'offline',
        accent: '#888888',
        isGroup: false,
      };
    }

    return this.buildChatView(conversation);
  }

  get selectedConversation(): DmConversation | undefined {
    return this.conversations.find(c => c.publicId === this.selectedConversationId);
  }

  private buildChatView(conversation: DmConversation): ChatView {
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
      status: 'online',
      accent: this.colorFromId(conversation.publicId),
      isGroup: conversation.isGroup,
    };
  }

  onSearchChange() {
    const query = this.searchText.trim();

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!query) {
      this.searchResults = [];
      this.isSearching = false;
      return;
    }

    if (this.isAddMemberOpen && query.length < 3) {
      this.searchResults = [];
      this.isSearching = false;
      return;
    }

    if (!this.isAddMemberOpen && query.length < 2) {
      this.searchResults = [];
      this.isSearching = false;
      return;
    }

    this.isSearching = true;

    this.searchTimeout = setTimeout(() => {
      if (this.isAddMemberOpen && this.selectedConversationId) {
        this.dmService.searchUsersInConversation(this.selectedConversationId, query).subscribe({
          next: results => {
            this.searchResults = (results || []).map(user => this.normalizeSearchUser(user));
            this.isSearching = false;
          },
          error: () => {
            this.searchResults = [];
            this.isSearching = false;
          }
        });
        return;
      }

      this.auth.searchUsers(query).subscribe({
        next: (res: any) => {
          const users = (Array.isArray(res) ? res : []).map((user: any) => this.normalizeSearchUser(user));
          this.searchResults = users.filter(user =>
            user.userName &&
            !this.selectedGroupMembers.some(member => member.userName === user.userName)
          );
          this.isSearching = false;
        },
        error: () => {
          this.searchResults = [];
          this.isSearching = false;
        }
      });
    }, 300);
  }

  getUserTrackKey(user: UserSearchResult): string {
    return user.id || user.userName || user.email || '';
  }

  isSelectedUser(user: UserSearchResult): boolean {
    if (!this.selectedUser) return false;
    return this.getUserTrackKey(this.selectedUser) === this.getUserTrackKey(user);
  }

  private normalizeSearchUser(user: any): UserSearchResult {
    const userName = user?.userName ?? user?.UserName ?? '';
    const email = user?.email ?? user?.Email ?? undefined;
    const id = user?.id ?? user?.Id ?? user?.userId ?? (userName || email || '');

    return {
      id,
      userName,
      email,
      phoneNumber: user?.phoneNumber ?? user?.PhoneNumber,
      profilePictureUrl: user?.profilePictureUrl ?? user?.ProfilePictureUrl,
    };
  }

  selectUser(user: UserSearchResult) {
    if (this.newMessageMode === 'group' && this.isNewMessageOpen) {
      if (!this.selectedGroupMembers.some(member => member.userName === user.userName)) {
        this.selectedGroupMembers = [...this.selectedGroupMembers, user];
      }
      this.searchText = '';
      this.searchResults = [];
      return;
    }

    this.selectedUser = user;
  }

  removeGroupMember(user: UserSearchResult) {
    this.selectedGroupMembers = this.selectedGroupMembers.filter(member => member.id !== user.id);
  }

  setNewMessageMode(mode: 'direct' | 'group') {
    this.newMessageMode = mode;
    this.selectedUser = null;
    this.selectedGroupMembers = [];
    this.groupTitle = '';
    this.searchText = '';
    this.searchResults = [];
  }

  openNewMessage() {
    this.isNewMessageOpen = true;
    this.isAddMemberOpen = false;
    this.newMessageMode = 'direct';
    this.searchText = '';
    this.searchResults = [];
    this.selectedUser = null;
    this.selectedGroupMembers = [];
    this.groupTitle = '';
    setTimeout(() => this.personSearchInput?.nativeElement.focus(), 0);
  }

  openAddMember() {
    this.isAddMemberOpen = true;
    this.isNewMessageOpen = false;
    this.searchText = '';
    this.searchResults = [];
    this.selectedUser = null;
    setTimeout(() => this.personSearchInput?.nativeElement.focus(), 0);
  }

  closeNewMessage() {
    this.isNewMessageOpen = false;
    this.isAddMemberOpen = false;
    this.searchText = '';
    this.searchResults = [];
    this.selectedUser = null;
    this.selectedGroupMembers = [];
    this.groupTitle = '';
    this.newMessageMode = 'direct';
  }

  selectChat(conversationId: string) {
    if (this.currentConversationId && this.currentConversationId !== conversationId) {
      this.dmService.leaveConversation(this.currentConversationId).catch(() => {});
    }

    this.selectedConversationId = conversationId;
    this.currentConversationId = conversationId;
    this.isMobileChatOpen = true;
    this.hasMoreMessages = false;
    this.oldestMessageId = null;

    this.dmService.startConnection()
      .then(() => this.dmService.joinConversation(conversationId))
      .catch(() => null);

    this.typingSub?.unsubscribe();

    this.typingSub = this.dmService.typingUsers$
      .subscribe(state => {
        this.typingUsers = state[conversationId] ?? [];
      });

    this.loadMessages(conversationId);
    this.dmService.markAsRead(conversationId).catch(() => {});
    this.dmService.resetConversationUnread(conversationId);
  }

  closeMobileChat() {
    this.isMobileChatOpen = false;
  }

  sendMessage() {
    const text = this.messageText.trim();
    if (!text || !this.selectedConversationId) return;

    this.messageText = '';

    const optimistic: DmMessage = {
      publicId: `pending-${Date.now()}`,
      content: text,
      sentAt: new Date().toISOString(),
      senderId: this.auth.getUserId(),
      conversationId: this.selectedConversationId,
      sender: { userName: '' },
    };
    this.messages = [...this.messages, optimistic];
    this.updateConversationPreview(optimistic);
    this.scrollToBottom();

    this.dmService.sendMessage(this.selectedConversationId, text).catch(() => {
      this.messages = this.messages.filter(m => m !== optimistic);
      this.messageText = text;
    });
  }

  startConversation() {
    if (this.newMessageMode === 'group') {
      if (!this.groupTitle.trim() || this.selectedGroupMembers.length < 2) {
        return;
      }

      const identifiers = this.selectedGroupMembers.map(member => member.userName);
      this.dmService
        .startDirectMessage(identifiers, this.groupTitle.trim(), true)
        .subscribe(conversation => this.afterConversationStarted(conversation));
      return;
    }

    if (!this.selectedUser) {
      return;
    }

    this.dmService
      .startDirectMessage([this.selectedUser.userName], null, false)
      .subscribe(conversation => this.afterConversationStarted(conversation));
  }

  addMemberToGroup() {
    if (!this.selectedConversationId || !this.selectedUser) {
      return;
    }

    this.dmService
      .addMember(this.selectedConversationId, this.selectedUser.id)
      .subscribe({
        next: () => {
          const conversation = this.conversations.find(
            c => c.publicId === this.selectedConversationId
          );

          if (conversation) {
            conversation.members.push({
              userId: this.selectedUser!.id,
              userName: this.selectedUser!.userName,
              profilePictureUrl: this.selectedUser!.profilePictureUrl
            });
          }

          this.closeNewMessage();
        }
      });
  }

  leaveConversation() {
    if (!this.selectedConversationId) return;

    const conversationId = this.selectedConversationId;
    this.dmService.leaveConversationApi(conversationId).subscribe({
      next: () => {
        this.conversations = this.conversations.filter(c => c.publicId !== conversationId);
        this.dmService.leaveConversation(conversationId).catch(() => {});
        this.selectedConversationId = null;
        this.currentConversationId = null;
        this.messages = [];
        this.isMobileChatOpen = false;

        if (this.conversations.length > 0) {
          this.selectChat(this.conversations[0].publicId);
        }
      }
    });
  }

  onMessageAreaScroll() {
    const el = this.messageAreaRef?.nativeElement;
    if (!el || this.isLoadingOlderMessages || !this.hasMoreMessages || !this.selectedConversationId) {
      return;
    }

    if (el.scrollTop <= 48) {
      this.loadOlderMessages();
    }
  }

  private afterConversationStarted(conversation: DmConversation) {
    this.closeNewMessage();

    if (!this.conversations.some(c => c.publicId === conversation.publicId)) {
      this.conversations = [conversation, ...this.conversations];
    }

    this.selectChat(conversation.publicId);
  }

  private loadConversations() {
    this.dmService.getConversations()
      .subscribe(conversations => {
        this.conversations = conversations;

        this.conversations = this.conversations.filter(c => c.lastMessageAt).sort((a, b) => new Date(b.lastMessageAt!).getTime() - new Date(a.lastMessageAt!).getTime());
       
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

        this.hasMoreMessages = response.hasMore;
        this.oldestMessageId = this.messages[0]?.publicId ?? null;
        this.scrollToBottom();
      });
  }

  private loadOlderMessages() {
    if (!this.selectedConversationId || !this.oldestMessageId || this.isLoadingOlderMessages) {
      return;
    }

    const el = this.messageAreaRef?.nativeElement;
    const previousHeight = el?.scrollHeight ?? 0;

    this.isLoadingOlderMessages = true;

    this.dmService.getMessages(this.selectedConversationId, this.oldestMessageId)
      .subscribe({
        next: response => {
          const olderMessages = response.messages.map(msg => ({
            ...msg,
            conversationId: response.conversationId
          }));

          this.messages = [...olderMessages, ...this.messages];
          this.hasMoreMessages = response.hasMore;
          this.oldestMessageId = this.messages[0]?.publicId ?? null;
          this.isLoadingOlderMessages = false;

          setTimeout(() => {
            if (el) {
              el.scrollTop = el.scrollHeight - previousHeight;
            }
          }, 0);
        },
        error: () => {
          this.isLoadingOlderMessages = false;
        }
      });
  }

  private updateConversationPreview(message: DmMessage) {
    const conversationId = message.conversationId;
    if (!conversationId) return;

    const index = this.conversations.findIndex(c => c.publicId === conversationId);
    if (index === -1) return;

    const conversation = { ...this.conversations[index] };
    conversation.lastMessage = {
      content: message.content,
      sentAt: message.sentAt,
      senderName: message.sender?.userName ?? '',
    };
    conversation.lastMessageAt = message.sentAt;

    if (conversationId !== this.selectedConversationId && message.senderId !== this.auth.getUserId()) {
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    }

    const updated = [...this.conversations];
    updated.splice(index, 1);
    updated.unshift(conversation);
    this.conversations = updated;
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = this.messageAreaRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
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

  private colorFromId(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    return `hsl(${hash % 360}, 62%, 45%)`;
  }
}
