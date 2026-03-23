import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private hubConnection!: signalR.HubConnection;

  constructor(private http: HttpClient) {}

  startConnection() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('https://localhost:7094/chatHub', {
        withCredentials: true
      })
      .withAutomaticReconnect()
      .build();

    return this.hubConnection.start()
      .then(() => console.log('SignalR connected'))
      .catch(err => console.error(err));
  }

  joinChannel(channelId: string) {
    return this.hubConnection.invoke('JoinChannel', channelId);
  }

  sendMessage(channelId: string, message: string) {
    return this.hubConnection.invoke('SendMessageToChannel', channelId, message);
  }

  onMessage(callback: (msg: any) => void) {
    this.hubConnection.on('ReceiveMessage', callback);
  }

  getMessages(channelId: string) {
    return this.http.get(`/channels/${channelId}/messages`);
  }
}
