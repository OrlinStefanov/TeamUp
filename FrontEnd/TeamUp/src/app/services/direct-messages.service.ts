import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';

export interface UserSearchResult {
  id: string;
  userName: string;
  email?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
}

export type DmMemberRole = 'Member' | 'Admin' | 'Owner';

export interface DmMember {
  userId: string;
  userName?: string;
  nickname?: string | null;
  displayName?: string;
  role?: DmMemberRole;
  profilePictureUrl?: string;
  isOnline?: boolean;
  joinedAt?: string;
}

export interface DmConversation {
  publicId: string;
  title: string | null;
  isGroup: boolean;
  lastMessageAt: string | null;
  members: DmMember[];
  unreadCount: number;
  lastMessage: {
    content: string;
    sentAt: string;
    senderName: string;
  } | null;
  currentUserRole?: DmMemberRole;
  canManage?: boolean;
  canChangeRoles?: boolean;
  createdByUserId?: string;
}

export interface DmMessage {
  publicId: string;
  content: string;
  sentAt: string;
  senderId: string;
  conversationId?: string;
  sender: {
    userName: string;
    displayName?: string;
    profilePictureUrl?: string;
    isOnline?: boolean;
  };
}

export interface DmMemberAddedEvent {
  conversationId: string;
  member: DmMember;
}

export interface DmMemberRemovedEvent {
  conversationId: string;
  userId: string;
  removedByUserId?: string;
}

export interface DmConversationUpdatedEvent {
  conversationId: string;
  title: string | null;
}

export interface DmMemberUpdatedEvent {
  conversationId: string;
  userId: string;
  nickname?: string | null;
  role?: DmMemberRole;
  displayName?: string;
}

@Injectable({ providedIn: 'root' })

export class DirectMessagesService {
  private apiUrl = environment.apiUrl;
  private hubConnection!: signalR.HubConnection;

  private messageCache = new Map<string, DmMessage[]>();
  private messageRequests = new Map<string, Observable<DmMessage[]>>();
  private typingUserIdMap = new Map<string, Map<string, string>>();

  private incomingMessageSubject = new BehaviorSubject<DmMessage | null>(null);
  incomingMessage$ = this.incomingMessageSubject.asObservable();

  private unreadSubject = new BehaviorSubject<Record<string, number>>({});
  unread$ = this.unreadSubject.asObservable();

  private totalUnreadSubject = new BehaviorSubject<number>(0);
  totalUnread$ = this.totalUnreadSubject.asObservable();

  private typingUsersSubject = new BehaviorSubject<Record<string, string[]>>({});
  typingUsers$ = this.typingUsersSubject.asObservable();

  private onlineUserIdsSubject = new BehaviorSubject<Set<string>>(new Set<string>());
  onlineUserIds$ = this.onlineUserIdsSubject.asObservable();

  private memberAddedSubject = new Subject<DmMemberAddedEvent>();
  memberAdded$ = this.memberAddedSubject.asObservable();

  private memberRemovedSubject = new Subject<DmMemberRemovedEvent>();
  memberRemoved$ = this.memberRemovedSubject.asObservable();

  private conversationUpdatedSubject = new Subject<DmConversationUpdatedEvent>();
  conversationUpdated$ = this.conversationUpdatedSubject.asObservable();

  private memberUpdatedSubject = new Subject<DmMemberUpdatedEvent>();
  memberUpdated$ = this.memberUpdatedSubject.asObservable();

  private connectionPromise: Promise<void> | null = null;
  private joinedConversationIds = new Set<string>();
  private presenceReady = false;

  constructor(private http: HttpClient) {}

  isPresenceReady(): boolean {
    return this.presenceReady;
  }

  private refreshOnlineUserIds(): Promise<void> {
    if (!this.hubConnection) {
      return Promise.resolve();
    }

    return this.hubConnection.invoke<string[]>('GetOnlineUserIds')
      .then(ids => {
        this.onlineUserIdsSubject.next(new Set(ids || []));
        this.presenceReady = true;
      })
      .catch(() => {});
  }

  getConversations(): Observable<DmConversation[]> {
    return this.http.get<DmConversation[]>(`${this.apiUrl}/api/direct-messages/conversations`, {
      withCredentials: true
    }).pipe(
      tap(conversations => {
        const counts: Record<string, number> = {};
        let total = 0;
        conversations.forEach(c => {
          counts[c.publicId] = c.unreadCount || 0;
          total += c.unreadCount || 0;
        });
        this.unreadSubject.next(counts);
        this.totalUnreadSubject.next(total);
      })
    );
  }

  getConversation(conversationPublicId: string): Observable<DmConversation> {
    return this.http.get<DmConversation>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}`,
      { withCredentials: true }
    );
  }

  resetConversationUnread(conversationPublicId: string) {
    const current = this.unreadSubject.value;
    const count = current[conversationPublicId] || 0;
    if (count === 0) return;
    this.unreadSubject.next({ ...current, [conversationPublicId]: 0 });
    this.totalUnreadSubject.next(Math.max(0, this.totalUnreadSubject.value - count));
  }

  startDirectMessage(identifiers: string[], title?: string | null, isGroup?: boolean) {
    const payload = { identifiers, title, isGroup };
    return this.http.post<DmConversation>(`${this.apiUrl}/api/direct-messages/start`, payload, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  updateConversationTitle(conversationPublicId: string, title: string) {
    return this.http.patch<{ publicId: string; title: string }>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}`,
      { title },
      { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
    );
  }

  getMessages(conversationPublicId: string, before?: string): Observable<{ conversationId: string; messages: DmMessage[]; hasMore: boolean; }> {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    return this.http.get<{ conversationId: string; messages: DmMessage[]; hasMore: boolean; }>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/messages${query}`,
      { withCredentials: true }
    );
  }

  addMember(conversationPublicId: string, userId: string) {
    return this.http.post<any>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/add-member`,
      { userId },
      {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  removeMember(conversationPublicId: string, userId: string) {
    return this.http.delete<any>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/members/${userId}`,
      { withCredentials: true }
    );
  }

  updateMyNickname(conversationPublicId: string, nickname: string | null) {
    return this.http.patch<DmMember>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/members/me`,
      { nickname },
      { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
    );
  }

  updateMemberNickname(conversationPublicId: string, userId: string, nickname: string | null) {
    return this.http.patch<DmMember>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/members/${userId}/nickname`,
      { nickname },
      { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
    );
  }

  updateMemberRole(conversationPublicId: string, userId: string, role: DmMemberRole) {
    return this.http.patch<DmMember>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/members/${userId}/role`,
      { role },
      { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
    );
  }

  searchUsersInConversation(
    conversationPublicId: string,
    query: string
  ): Observable<UserSearchResult[]> {
    if (!query.trim() || query.trim().length < 3) {
      return of([]);
    }

    return this.http.get<UserSearchResult[]>(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/search-users`,
      {
        params: { q: query },
        withCredentials: true
      }
    );
  }

  leaveConversationApi(conversationPublicId: string) {
    return this.http.delete<any>(`${this.apiUrl}/api/direct-messages/${conversationPublicId}/leave`, {
      withCredentials: true
    });
  }

  startConnection(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return Promise.reject('No auth token available');
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/dmhub`, {
        accessTokenFactory: () => localStorage.getItem('token') ?? ''
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveDm', (msg: any) => {
      const message: DmMessage = {
        publicId: msg.publicId,
        content: msg.content,
        sentAt: msg.sentAt,
        senderId: msg.senderId,
        conversationId: msg.conversationId,
        sender: {
          userName: msg.sender?.userName,
          displayName: msg.sender?.displayName ?? msg.sender?.userName,
          profilePictureUrl: msg.sender?.profilePictureUrl,
          isOnline: msg.sender?.isOnline ?? this.isUserOnline(msg.senderId),
        }
      };

      const cached = this.messageCache.get(msg.conversationId) ?? [];
      this.messageCache.set(msg.conversationId, [...cached, message]);
      this.incomingMessageSubject.next(message);
    });

    this.hubConnection.on('IncrementDmUnread', (data: any) => {
      const current = this.unreadSubject.value;
      this.unreadSubject.next({
        ...current,
        [data.conversationId]: (current[data.conversationId] || 0) + 1
      });
      this.totalUnreadSubject.next(this.totalUnreadSubject.value + 1);
    });

    this.hubConnection.on('DmUserTyping', (data: any) => {
      if (!this.typingUserIdMap.has(data.conversationId)) {
        this.typingUserIdMap.set(data.conversationId, new Map());
      }
      const label = data.displayName ?? data.userName ?? 'Someone';
      this.typingUserIdMap.get(data.conversationId)!.set(data.userId, label);
      const names = Array.from(this.typingUserIdMap.get(data.conversationId)!.values());
      this.typingUsersSubject.next({ ...this.typingUsersSubject.value, [data.conversationId]: names });
    });

    this.hubConnection.on('DmUserStopTyping', (data: any) => {
      const map = this.typingUserIdMap.get(data.conversationId);
      if (map) {
        map.delete(data.userId);
        const names = Array.from(map.values());
        this.typingUsersSubject.next({ ...this.typingUsersSubject.value, [data.conversationId]: names });
      }
    });

    this.hubConnection.on('DmMemberAdded', (data: DmMemberAddedEvent) => {
      this.memberAddedSubject.next(data);
    });

    this.hubConnection.on('DmMemberRemoved', (data: DmMemberRemovedEvent) => {
      this.memberRemovedSubject.next(data);
    });

    this.hubConnection.on('DmConversationUpdated', (data: DmConversationUpdatedEvent) => {
      this.conversationUpdatedSubject.next(data);
    });

    this.hubConnection.on('DmMemberUpdated', (data: DmMemberUpdatedEvent) => {
      this.memberUpdatedSubject.next(data);
    });

    this.hubConnection.on('DmPresenceChanged', (data: any) => {
      const userId = data?.userId ?? data?.UserId;
      if (!userId) return;

      const next = new Set(this.onlineUserIdsSubject.value);
      const isOnline = data.isOnline ?? data.IsOnline;
      if (isOnline) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      this.onlineUserIdsSubject.next(next);
    });

    this.hubConnection.onreconnecting(() => {
      this.presenceReady = false;
    });

    this.hubConnection.onreconnected(() => {
      this.refreshOnlineUserIds().then(() => {
        this.joinedConversationIds.forEach(id =>
          this.hubConnection.invoke('JoinConversation', id).catch(() => {})
        );
      });
    });

    this.connectionPromise = this.hubConnection.start().then(() => this.refreshOnlineUserIds()).catch(err => {
      this.connectionPromise = null;
      throw err;
    });
    return this.connectionPromise;
  }

  stopConnection(): Promise<void> {
    this.connectionPromise = null;
    this.presenceReady = false;
    this.joinedConversationIds.clear();
    this.typingUserIdMap.clear();
    this.typingUsersSubject.next({});
    this.onlineUserIdsSubject.next(new Set<string>());

    if (!this.hubConnection) {
      return Promise.resolve();
    }

    return this.hubConnection.stop().catch(() => {});
  }

  isUserOnline(userId?: string | null): boolean {
    return !!userId && this.onlineUserIdsSubject.value.has(userId);
  }

  getTypingUsers(conversationId: string): string[] {
    return this.typingUsersSubject.value[conversationId] ?? [];
  }

  joinConversation(conversationPublicId: string) {
    this.joinedConversationIds.add(conversationPublicId);
    return this.hubConnection.invoke('JoinConversation', conversationPublicId);
  }

  leaveConversation(conversationPublicId: string) {
    this.joinedConversationIds.delete(conversationPublicId);
    return this.hubConnection.invoke('LeaveConversation', conversationPublicId);
  }

  sendMessage(conversationPublicId: string, content: string) {
    return this.hubConnection.invoke('SendDm', conversationPublicId, content);
  }

  markAsRead(conversationPublicId: string) {
    return this.hubConnection.invoke('MarkAsRead', conversationPublicId);
  }

  typing(conversationPublicId: string) {
    return this.hubConnection.invoke('Typing', conversationPublicId);
  }

  stopTyping(conversationPublicId: string) {
    return this.hubConnection.invoke('StopTyping', conversationPublicId);
  }

  getCachedMessages(conversationPublicId: string) {
    return this.messageCache.get(conversationPublicId);
  }

  likeMessage(conversationPublicId: string, messagePublicId: string) {
    return this.http.post(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/messages/${messagePublicId}/like`,
      {},
      { withCredentials: true }
    );
  }

  unlikeMessage(conversationPublicId: string, messagePublicId: string) {
    return this.http.delete(
      `${this.apiUrl}/api/direct-messages/${conversationPublicId}/messages/${messagePublicId}/like`,
      { withCredentials: true }
    );
  }
}
