import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { Auth } from '../../services/auth/auth';
import { DirectMessagesService, DmConversation, DmMember, DmMemberRole, DmMessage, UserSearchResult } from '../../services/direct-messages.service';
import { Router } from '@angular/router';

type ChatView = {
  publicId: string;
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
  isGroupSettingsOpen = false;
  isMobileChatOpen = false;
  selectedConversationId: string | null = null;
  conversations: DmConversation[] = [];
  messages: DmMessage[] = [];
  hasMoreMessages = false;
  isLoadingOlderMessages = false;

  typingUsers: string[] = [];
  onlineUserIds = new Set<string>();

  editGroupTitle = '';
  myNickname = '';
  nicknameEditMember: DmMember | null = null;
  nicknameEditValue = '';

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
    this.dmService.startConnection()
      .then(() => this.loadConversations())
      .catch(() => this.router.navigate(['/dashboard']));

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

    this.subscription.add(
      this.dmService.memberAdded$.subscribe(event => this.handleMemberAdded(event))
    );
    this.subscription.add(
      this.dmService.memberRemoved$.subscribe(event => this.handleMemberRemoved(event))
    );
    this.subscription.add(
      this.dmService.conversationUpdated$.subscribe(event => this.handleConversationUpdated(event))
    );
    this.subscription.add(
      this.dmService.memberUpdated$.subscribe(event => this.handleMemberUpdated(event))
    );
    this.subscription.add(
      this.dmService.onlineUserIds$.subscribe((ids: Set<string>) => {
        this.onlineUserIds = ids;
        this.patchMemberOnlineStates();
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
        publicId: '',
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

  get canManageGroup(): boolean {
    return !!this.selectedConversation?.canManage;
  }

  get canChangeRoles(): boolean {
    return !!this.selectedConversation?.canChangeRoles;
  }

  get currentUserRole(): DmMemberRole | undefined {
    return this.selectedConversation?.currentUserRole;
  }

  get sortedGroupMembers(): DmMember[] {
    const members = this.selectedConversation?.members ?? [];
    const roleOrder: Record<string, number> = { Owner: 0, Admin: 1, Member: 2 };
    return [...members].sort((a, b) => {
      const ra = roleOrder[a.role ?? 'Member'] ?? 2;
      const rb = roleOrder[b.role ?? 'Member'] ?? 2;
      if (ra !== rb) return ra - rb;
      return (a.displayName ?? a.userName ?? '').localeCompare(b.displayName ?? b.userName ?? '');
    });
  }

  canKickMember(member: DmMember): boolean {
    if (!this.canManageGroup || member.userId === this.auth.getUserId()) return false;
    if (member.role === 'Owner') return false;
    if (this.currentUserRole === 'Admin' && member.role === 'Admin') return false;
    return true;
  }

  getMessageSenderLabel(message: DmMessage): string {
    if (message.senderId === this.auth.getUserId()) return '';
    return message.sender?.displayName ?? message.sender?.userName ?? '';
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

    const status = this.isConversationOnline(conversation) ? 'online' : 'offline';

    return {
      publicId: conversation.publicId,
      name,
      handle,
      preview,
      time,
      initials,
      status,
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
    this.isGroupSettingsOpen = false;
    this.searchText = '';
    this.searchResults = [];
    this.selectedUser = null;
    setTimeout(() => this.personSearchInput?.nativeElement.focus(), 0);
  }

  openGroupSettings() {
    const conversation = this.selectedConversation;
    if (!conversation?.isGroup) return;

    this.isGroupSettingsOpen = true;
    this.isNewMessageOpen = false;
    this.isAddMemberOpen = false;
    this.editGroupTitle = conversation.title ?? '';
    const me = conversation.members.find(m => m.userId === this.auth.getUserId());
    this.myNickname = me?.nickname ?? '';

    this.dmService.getConversation(conversation.publicId).subscribe({
      next: detail => this.patchConversation(detail),
      error: () => {}
    });
  }

  closeGroupSettings() {
    this.isGroupSettingsOpen = false;
    this.nicknameEditMember = null;
    this.nicknameEditValue = '';
  }

  saveGroupTitle() {
    if (!this.selectedConversationId || !this.editGroupTitle.trim()) return;

    this.dmService.updateConversationTitle(this.selectedConversationId, this.editGroupTitle.trim())
      .subscribe({
        next: () => {
          const conversation = this.conversations.find(c => c.publicId === this.selectedConversationId);
          if (conversation) {
            conversation.title = this.editGroupTitle.trim();
          }
        }
      });
  }

  saveMyNickname() {
    if (!this.selectedConversationId) return;

    const nickname = this.myNickname.trim() || null;
    this.dmService.updateMyNickname(this.selectedConversationId, nickname).subscribe({
      next: member => {
        const conversation = this.conversations.find(c => c.publicId === this.selectedConversationId);
        const me = conversation?.members.find(m => m.userId === this.auth.getUserId());
        if (me) {
          me.nickname = member.nickname;
          me.displayName = member.displayName;
        }
      }
    });
  }

  openNicknameEdit(member: DmMember) {
    this.nicknameEditMember = member;
    this.nicknameEditValue = member.nickname ?? '';
  }

  saveMemberNickname() {
    if (!this.selectedConversationId || !this.nicknameEditMember) return;

    const nickname = this.nicknameEditValue.trim() || null;
    const targetId = this.nicknameEditMember.userId;
    const isSelf = targetId === this.auth.getUserId();

    const request = isSelf
      ? this.dmService.updateMyNickname(this.selectedConversationId, nickname)
      : this.dmService.updateMemberNickname(this.selectedConversationId, targetId, nickname);

    request.subscribe({
      next: member => {
        const conversation = this.conversations.find(c => c.publicId === this.selectedConversationId);
        const target = conversation?.members.find(m => m.userId === targetId);
        if (target) {
          target.nickname = member.nickname;
          target.displayName = member.displayName;
        }
        if (isSelf) this.myNickname = member.nickname ?? '';
        this.nicknameEditMember = null;
        this.nicknameEditValue = '';
      }
    });
  }

  kickMember(member: DmMember) {
    if (!this.selectedConversationId || !confirm(`Remove ${member.displayName ?? member.userName} from the group?`)) {
      return;
    }

    this.dmService.removeMember(this.selectedConversationId, member.userId).subscribe({
      next: () => this.removeMemberFromLocal(member.userId)
    });
  }

  promoteToAdmin(member: DmMember) {
    if (!this.selectedConversationId) return;
    this.dmService.updateMemberRole(this.selectedConversationId, member.userId, 'Admin').subscribe();
  }

  demoteToMember(member: DmMember) {
    if (!this.selectedConversationId) return;
    this.dmService.updateMemberRole(this.selectedConversationId, member.userId, 'Member').subscribe();
  }

  transferOwnership(member: DmMember) {
    if (!this.selectedConversationId) return;
    if (!confirm(`Transfer ownership to ${member.displayName ?? member.userName}?`)) return;
    this.dmService.updateMemberRole(this.selectedConversationId, member.userId, 'Owner').subscribe();
  }

  closeNewMessage() {
    this.isNewMessageOpen = false;
    this.isAddMemberOpen = false;
    this.isGroupSettingsOpen = false;
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
    this.isGroupSettingsOpen = false;
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
        next: (res: any) => {
          const added = res?.addedUser ?? res?.AddedUser;
          const conversation = this.conversations.find(
            c => c.publicId === this.selectedConversationId
          );

          if (conversation && added) {
            conversation.members.push({
              userId: added.userId ?? added.id ?? added.Id,
              userName: added.userName ?? added.UserName,
              nickname: added.nickname ?? added.Nickname,
              displayName: added.displayName ?? added.DisplayName ?? added.userName ?? added.UserName,
              role: added.role ?? added.Role ?? 'Member',
              profilePictureUrl: added.profilePictureUrl ?? added.ProfilePictureUrl
            });
            this.conversations = [...this.conversations];
          }

          this.closeNewMessage();
        }
      });
  }

  leaveConversation() {
    if (!this.selectedConversationId) return;

    const conversationId = this.selectedConversationId;
    this.dmService.leaveConversationApi(conversationId).subscribe({
      next: () => this.afterLeftConversation(conversationId)
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

    const normalized = this.normalizeConversation(conversation);

    if (!this.conversations.some(c => c.publicId === normalized.publicId)) {
      this.conversations = [normalized, ...this.conversations];
    }

    this.selectChat(normalized.publicId);
  }

  private loadConversations() {
    this.dmService.getConversations()
      .subscribe({
        next: conversations => {
          this.conversations = conversations
            .map(c => this.normalizeConversation(c))
            .sort((a, b) => this.getConversationSortTime(b) - this.getConversationSortTime(a));

          if (!this.selectedConversationId && this.conversations.length > 0) {
            this.selectChat(this.conversations[0].publicId);
          }
        },
        error: () => {
          this.conversations = [];
        }
      });
  }

  private normalizeConversation(raw: any): DmConversation {
    const members = (raw?.members ?? raw?.Members ?? []).map((m: any) => ({
      userId: m.userId ?? m.UserId,
      userName: m.userName ?? m.UserName,
      nickname: m.nickname ?? m.Nickname,
      displayName: m.displayName ?? m.DisplayName,
      role: m.role ?? m.Role,
      profilePictureUrl: m.profilePictureUrl ?? m.ProfilePictureUrl,
      isOnline: m.isOnline ?? m.IsOnline ?? this.onlineUserIds.has(m.userId ?? m.UserId),
      joinedAt: m.joinedAt ?? m.JoinedAt,
    }));

    const lastMessage = raw?.lastMessage ?? raw?.LastMessage;

    return {
      publicId: raw?.publicId ?? raw?.PublicId,
      title: raw?.title ?? raw?.Title ?? null,
      isGroup: raw?.isGroup === true || raw?.IsGroup === true,
      lastMessageAt: raw?.lastMessageAt ?? raw?.LastMessageAt ?? null,
      members,
      unreadCount: raw?.unreadCount ?? raw?.UnreadCount ?? 0,
      lastMessage: lastMessage
        ? {
            content: lastMessage.content ?? lastMessage.Content ?? '',
            sentAt: lastMessage.sentAt ?? lastMessage.SentAt ?? '',
            senderName: lastMessage.senderName ?? lastMessage.SenderName ?? '',
          }
        : null,
      currentUserRole: raw?.currentUserRole ?? raw?.CurrentUserRole,
      canManage: raw?.canManage ?? raw?.CanManage ?? false,
      canChangeRoles: raw?.canChangeRoles ?? raw?.CanChangeRoles ?? false,
      createdByUserId: raw?.createdByUserId ?? raw?.CreatedByUserId,
    };
  }

  private getConversationSortTime(conversation: DmConversation): number {
    if (conversation.lastMessageAt) {
      return new Date(conversation.lastMessageAt).getTime();
    }
    return 0;
  }

  private loadMessages(conversationId: string) {
    this.dmService.getMessages(conversationId)
      .subscribe(response => {
        this.messages = response.messages.map(msg =>
          this.normalizeMessage(msg, response.conversationId)
        );

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
          const olderMessages = response.messages.map(msg =>
            this.normalizeMessage(msg, response.conversationId)
          );

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

  private patchConversation(detail: DmConversation) {
    detail.members = detail.members.map(member => ({
      ...member,
      isOnline: member.isOnline || this.onlineUserIds.has(member.userId)
    }));

    const index = this.conversations.findIndex(c => c.publicId === detail.publicId);
    if (index === -1) {
      this.conversations = [detail, ...this.conversations];
      return;
    }
    const existing = this.conversations[index];
    this.conversations[index] = { ...existing, ...detail, members: detail.members };
    this.conversations = [...this.conversations];
  }

  private handleMemberAdded(event: { conversationId: string; member: DmMember }) {
    const conversation = this.conversations.find(c => c.publicId === event.conversationId);
    if (!conversation) return;
    if (!conversation.members.some(m => m.userId === event.member.userId)) {
      conversation.members = [
        ...conversation.members,
        { ...event.member, isOnline: event.member.isOnline || this.onlineUserIds.has(event.member.userId) }
      ];
      this.conversations = [...this.conversations];
    }
  }

  private handleMemberRemoved(event: { conversationId: string; userId: string }) {
    if (event.userId === this.auth.getUserId()) {
      this.afterLeftConversation(event.conversationId);
      return;
    }
    this.removeMemberFromLocal(event.userId, event.conversationId);
  }

  private handleConversationUpdated(event: { conversationId: string; title: string | null }) {
    const conversation = this.conversations.find(c => c.publicId === event.conversationId);
    if (conversation) {
      conversation.title = event.title;
      if (this.isGroupSettingsOpen && this.selectedConversationId === event.conversationId) {
        this.editGroupTitle = event.title ?? '';
      }
      this.conversations = [...this.conversations];
    }
  }

  private handleMemberUpdated(event: {
    conversationId: string;
    userId: string;
    nickname?: string | null;
    role?: DmMemberRole;
    displayName?: string;
  }) {
    const conversation = this.conversations.find(c => c.publicId === event.conversationId);
    const member = conversation?.members.find(m => m.userId === event.userId);
    if (!member) return;

    if (event.nickname !== undefined) member.nickname = event.nickname;
    if (event.role) member.role = event.role;
    if (event.displayName) member.displayName = event.displayName;

    if (event.userId === this.auth.getUserId()) {
      if (event.role) {
        conversation!.currentUserRole = event.role;
        conversation!.canManage = event.role === 'Owner' || event.role === 'Admin';
        conversation!.canChangeRoles = event.role === 'Owner';
      }
      if (event.nickname !== undefined) this.myNickname = event.nickname ?? '';
    }

    if (event.role === 'Owner' && event.userId !== this.auth.getUserId()) {
      const me = conversation!.members.find(m => m.userId === this.auth.getUserId());
      if (me?.role === 'Owner') {
        me.role = 'Admin';
        conversation!.currentUserRole = 'Admin';
        conversation!.canChangeRoles = false;
      }
      conversation!.members.forEach(m => {
        if (m.userId !== event.userId && m.role === 'Owner') m.role = 'Admin';
      });
    }

    this.conversations = [...this.conversations];
  }

  isSenderOnline(message: DmMessage): boolean {
    if (!message.senderId || message.senderId === this.auth.getUserId()) return false;
    return message.sender?.isOnline === true || this.onlineUserIds.has(message.senderId);
  }

  private isConversationOnline(conversation: DmConversation): boolean {
    return conversation.members.some(member =>
      member.userId !== this.auth.getUserId() &&
      (member.isOnline === true || this.onlineUserIds.has(member.userId))
    );
  }

  private normalizeMessage(raw: any, conversationId: string): DmMessage {
    const senderId = raw.senderId ?? raw.SenderId ?? '';
    const senderRaw = raw.sender ?? raw.Sender ?? {};

    return {
      publicId: raw.publicId ?? raw.PublicId,
      content: raw.content ?? raw.Content ?? '',
      sentAt: raw.sentAt ?? raw.SentAt ?? '',
      senderId,
      conversationId,
      sender: {
        userName: senderRaw.userName ?? senderRaw.UserName ?? '',
        displayName: senderRaw.displayName ?? senderRaw.DisplayName,
        profilePictureUrl: senderRaw.profilePictureUrl ?? senderRaw.ProfilePictureUrl,
        isOnline: senderRaw.isOnline ?? senderRaw.IsOnline ?? this.onlineUserIds.has(senderId),
      },
    };
  }

  private patchMemberOnlineStates() {
    const presenceReady = this.dmService.isPresenceReady();

    this.conversations = this.conversations.map(conversation => ({
      ...conversation,
      members: conversation.members.map(member => ({
        ...member,
        isOnline: presenceReady
          ? this.onlineUserIds.has(member.userId)
          : (member.isOnline === true || this.onlineUserIds.has(member.userId))
      }))
    }));

    this.messages = this.messages.map(message => ({
      ...message,
      sender: {
        ...message.sender,
        isOnline: presenceReady
          ? this.onlineUserIds.has(message.senderId)
          : (message.sender?.isOnline === true || this.onlineUserIds.has(message.senderId))
      }
    }));
  }

  private removeMemberFromLocal(userId: string, conversationId?: string) {
    const id = conversationId ?? this.selectedConversationId;
    const conversation = this.conversations.find(c => c.publicId === id);
    if (!conversation) return;
    conversation.members = conversation.members.filter(m => m.userId !== userId);
    this.conversations = [...this.conversations];
  }

  private afterLeftConversation(conversationId: string) {
    this.conversations = this.conversations.filter(c => c.publicId !== conversationId);
    this.dmService.leaveConversation(conversationId).catch(() => {});
    this.isGroupSettingsOpen = false;
    this.selectedConversationId = null;
    this.currentConversationId = null;
    this.messages = [];
    this.isMobileChatOpen = false;

    if (this.conversations.length > 0) {
      this.selectChat(this.conversations[0].publicId);
    }
  }

  getLikeCount(message: DmMessage): number {
    return (message as any).likes?.length ?? 0;
  }

  isMessageLikedByUser(message: DmMessage): boolean {
    const likes = (message as any).likes;
    if (!likes) return false;
    return likes.some((like: any) => like.userId === this.auth.getUserId());
  }

  toggleLike(message: DmMessage, event?: Event): void {
    if (event) event.preventDefault();
    if (!message.publicId || !this.selectedConversationId) return;

    const isLiked = this.isMessageLikedByUser(message);

    if (isLiked) {
      this.dmService.unlikeMessage(this.selectedConversationId, message.publicId).subscribe(() => {
        const likes = (message as any).likes || [];
        (message as any).likes = likes.filter((like: any) => like.userId !== this.auth.getUserId());
      });
    } else {
      this.dmService.likeMessage(this.selectedConversationId, message.publicId).subscribe(() => {
        if (!(message as any).likes) {
          (message as any).likes = [];
        }
        (message as any).likes.push({
          userId: this.auth.getUserId(),
          userName: this.auth.getCurrentUser()?.userName
        });
      });
    }
  }

  toggleLikesList(message: DmMessage): void {
    (message as any).showLikesList = !(message as any).showLikesList;
  }

  closeLikesList(message: DmMessage): void {
    (message as any).showLikesList = false;
  }
}
