import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';

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

  private incomingMessageSubject = new BehaviorSubject<DmMessage | null>(null);
  incomingMessage$ = this.incomingMessageSubject.asObservable();

  private unreadSubject = new BehaviorSubject<Record<string, number>>({});
  unread$ = this.unreadSubject.asObservable();

<<<<<<< Updated upstream
=======
  private totalUnreadSubject = new BehaviorSubject<number>(0);
  totalUnread$ = this.totalUnreadSubject.asObservable();

  private typingUsersSubject = new BehaviorSubject<Record<string, string[]>>({});
  typingUsers$ = this.typingUsersSubject.asObservable();

  private connectionPromise: Promise<void> | null = null;
  private joinedConversationIds = new Set<string>();

>>>>>>> Stashed changes
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

  resetConversationUnread(conversationId: string) {
    const current = this.unreadSubject.value;
    const count = current[conversationId] || 0;
    if (count === 0) return;
    this.unreadSubject.next({ ...current, [conversationId]: 0 });
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

  addMember(conversationPublicId: string, identifier: string) {
    return this.http.post<any>(`${this.apiUrl}/api/direct-messages/${conversationPublicId}/add-member`, { identifier }, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    });
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

    this.hubConnection.on('DmUserTyping', () => {});
    this.hubConnection.on('DmUserStopTyping', () => {});

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
