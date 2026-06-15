import { Injectable } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { HttpClient } from '@angular/common/http';
import { tap, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatService {

  private hubConnection!: signalR.HubConnection;

  private apiUrl = 'https://localhost:7094';

  // =========================
  // STATE
  // =========================

  private channelsSubject = new BehaviorSubject<any[]>([]);
  channels$ = this.channelsSubject.asObservable();

  private unreadSubject = new BehaviorSubject<{ [channelId: string]: number }>({});
  unread$ = this.unreadSubject.asObservable();

  private incomingMessageSubject = new BehaviorSubject<any>(null);
  incomingMessage$ = this.incomingMessageSubject.asObservable();

  // =========================
  // CACHE
  // =========================

  private messagesCache = new Map<string, any[]>();
  private messageRequests = new Map<string, any>();

  private isConnected = false;

  private typingSubject = new BehaviorSubject<any[]>([]);
  
  typing$ = this.typingSubject.asObservable();

  constructor(private http: HttpClient) {}

  // =========================
  // SIGNALR
  // =========================

  startConnection() {
    if (this.isConnected) return Promise.resolve();

    const token = localStorage.getItem('token');
    if (!token) return Promise.reject('No token');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/chatHub`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveMessage', (msg: any) => {
      const channelId = msg.channelId;

      if (this.messagesCache.has(channelId)) {
        const current = this.messagesCache.get(channelId)!;
        this.messagesCache.set(channelId, [...current, msg]);
      }

      this.incomingMessageSubject.next(msg);
    });

    this.hubConnection.on('UserTyping', (data: any) => {
      const current = this.typingSubject.value;

      this.typingSubject.next([
        ...current.filter(x => x.userId !== data.userId),
        data
      ]);
    });

    this.hubConnection.on('UserStopTyping', (data: any) => {
      const current = this.typingSubject.value;

      this.typingSubject.next(
        current.filter(x => x.userId !== data.userId)
      );
    });

    this.hubConnection.on('IncrementUnread', (data: { channelId: string }) => {
      if (data?.channelId) {
        this.increaseUnread(data.channelId);
      }
    });

    this.isConnected = true;

    return this.hubConnection.start();
  }

  // =========================
  // UNREAD LOGIC
  // =========================

  increaseUnread(channelId: string) {
    const current = this.unreadSubject.value;

    this.unreadSubject.next({
      ...current,
      [channelId]: (current[channelId] || 0) + 1
    });
  }

  resetUnread(channelId: string) {
    const current = this.unreadSubject.value;

    this.unreadSubject.next({
      ...current,
      [channelId]: 0
    });

    if (!this.isConnected || !this.hubConnection) return;

    this.hubConnection.invoke('MarkAsRead', channelId).catch(() => {
      // Hub may still be connecting; JoinChannel also updates LastSeen.
    });
  }

  // =========================
  // SIGNALR ACTIONS
  // =========================

  joinChannel(channelId: string) {
    if (!this.isConnected || !this.hubConnection) {
      return Promise.resolve();
    }

    return this.hubConnection.invoke('JoinChannel', channelId);
  }

  sendMessage(channelId: string, message: string) {
    return this.hubConnection.invoke('SendMessage', channelId, message);
  }

  // =========================
  // CHANNELS
  // =========================

  loadChannels(workspaceId: string) {
    this.http.get<any[]>(`${this.apiUrl}/workspace/${workspaceId}/get/channels`, {
      withCredentials: true
    }).subscribe(res => {
      this.channelsSubject.next(res);

      const counts: { [channelId: string]: number } = {};
      res.forEach(channel => {
        counts[channel.publicId] = channel.unreadCount || 0;
      });
      this.unreadSubject.next(counts);
    });
  }

  getTotalUnread(): number {
    return Object.values(this.unreadSubject.value).reduce((sum, count) => sum + count, 0);
  }

  // =========================
  // MESSAGES (CACHE)
  // =========================

  getMessages(channelId: string) {
    if (this.messagesCache.has(channelId)) {
      return of(this.messagesCache.get(channelId));
    }

    if (this.messageRequests.has(channelId)) {
      return this.messageRequests.get(channelId);
    }

    const request$ = this.http
      .get<any[]>(`${this.apiUrl}/channels/${channelId}/messages`, {
        withCredentials: true
      })
      .pipe(
        tap(msgs => this.messagesCache.set(channelId, msgs)),
        shareReplay(1)
      );

    this.messageRequests.set(channelId, request$);

    return request$;
  }

  //==========================
  //TYPING
  //==========================
  typing(channelId: string) {
    this.hubConnection.invoke('Typing', channelId);
  }

  stopTyping(channelId: string) {
    this.hubConnection.invoke('StopTyping', channelId);
  }

  // =========================
  // HELPERS
  // =========================

  getUnreadSnapshot() {
    return this.unreadSubject.value;
  }

  getCachedMessages(channelId: string) {
    return this.messagesCache.get(channelId);
  }
}