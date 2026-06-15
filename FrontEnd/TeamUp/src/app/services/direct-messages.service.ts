import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';

export interface UserSearchResult {
  id: string;
  userName: string;
  email?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
}

export interface DmMember {
  userId: string;
  userName?: string;
  profilePictureUrl?: string;
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
}

export interface DmMessage {
  publicId: string;
  content: string;
  sentAt: string;
  senderId: string;
  conversationId?: string;
  sender: {
    userName: string;
    profilePictureUrl?: string;
  };
}

@Injectable({ providedIn: 'root' })

export class DirectMessagesService {
  private apiUrl = 'https://localhost:7094';
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

  private connectionPromise: Promise<void> | null = null;
  private joinedConversationIds = new Set<string>();

  constructor(private http: HttpClient) {}

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
        accessTokenFactory: () => token
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
          profilePictureUrl: msg.sender?.profilePictureUrl,
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
      this.typingUserIdMap.get(data.conversationId)!.set(data.userId, data.userName);
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

    this.hubConnection.onreconnected(() => {
      this.joinedConversationIds.forEach(id =>
        this.hubConnection.invoke('JoinConversation', id).catch(() => {})
      );
    });

    this.connectionPromise = this.hubConnection.start().catch(err => {
      this.connectionPromise = null;
      throw err;
    });
    return this.connectionPromise;
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
}
