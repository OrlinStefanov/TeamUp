import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})

export class Taskhub {
  private hubConnection!: signalR.HubConnection;
  private currentWorkspaceId: string | null = null;

  private tasksSubject = new BehaviorSubject<any[]>([]);
  public tasks$ = this.tasksSubject.asObservable();

  private tasksCache = new Map<string, any[]>();

  private apiUrl = 'https://localhost:7094';

  //connect
  connect(workspaceId: string, token: string) {
    if (this.hubConnection && this.currentWorkspaceId === workspaceId) {
      return;
    }

    this.currentWorkspaceId = workspaceId;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/taskHub`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start()
      .then(() => {
        console.log('Connected to TaskHub');

        this.hubConnection.invoke('JoinWorkspace', workspaceId);
        this.registerListeners();
      })
      .catch(err => console.error('SignalR Error:', err));
  }

  //disconnect
  disconnect() {
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.currentWorkspaceId = null;
    }
  }

  // load info from API
  setInitialTasks(workspaceId: string, tasks: any[]) {
    this.tasksCache.set(workspaceId, tasks);
    this.tasksSubject.next(tasks);
  }

  // hub listeneres
  private registerListeners() {
    if (!this.hubConnection) return;

    // create task
    this.hubConnection.on('taskCreated', (task) => {
      const tasks = this.tasksCache.get(this.currentWorkspaceId!) || [];
      const updated = [task, ...tasks];

      this.tasksCache.set(this.currentWorkspaceId!, updated);
      this.tasksSubject.next(updated);
    });

    //update task
    this.hubConnection.on('taskUpdated', (updatedTask) => {
      const tasks = this.tasksCache.get(this.currentWorkspaceId!) || [];

      const updated = tasks.map(t =>
        t.publicId === updatedTask.publicId ? { ...t, ...updatedTask } : t
      );

      this.tasksCache.set(this.currentWorkspaceId!, updated);
      this.tasksSubject.next(updated);
    });

    //change status of task
    this.hubConnection.on('taskStatusChanged', (task) => {
      const tasks = this.tasksCache.get(this.currentWorkspaceId!) || [];

      const updated = tasks.map(t =>
        t.publicId === task.publicId ? { ...t, status: task.status } : t
      );

      this.tasksCache.set(this.currentWorkspaceId!, updated);
      this.tasksSubject.next(updated);
    });

    //delete task
    this.hubConnection.on('taskDeleted', (task) => {
      const tasks = this.tasksCache.get(this.currentWorkspaceId!) || [];

      const updated = tasks.filter(t => t.publicId !== task.publicId);

      this.tasksCache.set(this.currentWorkspaceId!, updated);
      this.tasksSubject.next(updated);
    });
  }
}
