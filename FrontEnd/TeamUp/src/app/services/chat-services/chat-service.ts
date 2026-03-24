import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ChatService {

  private hubConnection!: signalR.HubConnection;

  private channelsSubject = new BehaviorSubject<any[]>([]);
  channels$ = this.channelsSubject.asObservable();

  private messagesSubject = new BehaviorSubject<any[]>([]);
  messages$ = this.messagesSubject.asObservable();

  private apiUrl = 'https://localhost:7094';
  constructor(private http: HttpClient) {}

  // SIGNALR
  startConnection() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No JWT token found');
      return Promise.reject('No JWT token found');
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('https://localhost:7094/chatHub', {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    return this.hubConnection.start();
  }

  onMessage(p0: (msg: any) => void) {
    this.hubConnection.on('ReceiveMessage', (msg) => {
      const current = this.messagesSubject.value;
      this.messagesSubject.next([...current, msg]);
      p0(msg); // optional callback
    });
  }

  joinChannel(channelId: string) {
    return this.hubConnection.invoke('JoinChannel', channelId);
  }

  sendMessage(channelId: string, message: string) {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      console.error('Hub not connected');
      return;
    }

    return this.hubConnection.invoke('SendMessage', channelId, message)
      .catch(err => console.error('SendMessage failed:', err));
  }

  // CHANNELS
  loadChannels(workspaceId: string) {
    if (this.channelsSubject.value.length > 0) return;

    this.http.get<any[]>(`${this.apiUrl}/workspace/${workspaceId}/get/channels`)
      .subscribe(channels => this.channelsSubject.next(channels));
  }

  addChannel(channel: any) {
    const current = this.channelsSubject.value;
    this.channelsSubject.next([...current, channel]);
  }

  // MESSAGES
  loadMessages(channelId: string) {
    if (this.messagesSubject.value.length > 0) return;

    this.http.get<any[]>(`${this.apiUrl}/channels/${channelId}/messages`)
      .subscribe(msgs => this.messagesSubject.next(msgs));
  }

  clearMessages() {
    this.messagesSubject.next([]);
  }

  getMessage(publicId : string)
  {
    return this.http.get(`${this.apiUrl}/channels/${publicId}/messages`, {
      withCredentials: true
    })
  }
}