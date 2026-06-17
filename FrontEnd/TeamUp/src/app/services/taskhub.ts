import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { InboxService } from './inbox.service';
import { InboxMessage, InboxMessageType } from '../models/inbox.models';
import { Auth } from './auth/auth';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})

export class Taskhub {
  private hubConnection!: signalR.HubConnection;
  private currentWorkspaceId: string | null = null;
  private listenersRegistered = false;

  private tasksSubject = new BehaviorSubject<any[]>([]);
  public tasks$ = this.tasksSubject.asObservable();

  private tasksCache = new Map<string, any[]>();

  private apiUrl = environment.apiUrl;

  constructor(
    private inboxService: InboxService,
    private auth: Auth
  ) {}

  connect(workspaceId: string, token: string) {
    if (this.hubConnection && this.currentWorkspaceId === workspaceId) {
      return;
    }

    if (this.hubConnection && this.currentWorkspaceId !== workspaceId) {
      this.disconnect();
    }

    this.currentWorkspaceId = workspaceId;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/taskhub`, {
        accessTokenFactory: () => this.auth.getToken() ?? ''
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

  disconnect() {
    if (this.hubConnection && this.currentWorkspaceId) {
      const workspaceId = this.currentWorkspaceId;
      this.hubConnection.invoke('LeaveWorkspace', workspaceId).finally(() => {
        this.hubConnection?.stop();
      });
    } else if (this.hubConnection) {
      this.hubConnection.stop();
    }

    this.hubConnection = undefined!;
    this.currentWorkspaceId = null;
    this.listenersRegistered = false;
    this.tasksSubject.next([]);
  }

  setInitialTasks(workspaceId: string, tasks: any[]) {
    this.tasksCache.set(workspaceId, tasks);
    this.tasksSubject.next(tasks);
  }

  private mergeTask(existing: any, incoming: any): any {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }
    return merged;
  }

  private normalizeTaskPayload(task: any): any {
    if (!task) return task;

    const rawDifficulty = task.difficulty ?? task.Difficulty;
    const difficultyMap: Record<string, number> = {
      Easy: 0,
      Medium: 1,
      Hard: 2,
      VeryHard: 3,
      'Very Hard': 3
    };

    const result: Record<string, any> = {};

    const publicId = task.publicId ?? task.PublicId;
    if (publicId !== undefined) result['publicId'] = String(publicId);

    const title = task.title ?? task.Title;
    if (title !== undefined) result['title'] = title;

    const description = task.description ?? task.Description;
    if (description !== undefined) result['description'] = description;

    const dueDate = task.dueDate ?? task.DueDate;
    if (dueDate !== undefined) result['dueDate'] = dueDate;

    const startDate = task.startDate ?? task.StartDate;
    if (startDate !== undefined) result['startDate'] = startDate;

    const points = task.points ?? task.Points;
    if (points !== undefined) result['points'] = points;

    const status = task.status ?? task.Status;
    if (status !== undefined) result['status'] = status;

    if (rawDifficulty !== undefined && rawDifficulty !== null) {
      result['difficulty'] = typeof rawDifficulty === 'number'
        ? rawDifficulty
        : difficultyMap[String(rawDifficulty)] ?? rawDifficulty;
    }

    const tags = task.tags ?? task.Tags;
    if (tags !== undefined) {
      result['tags'] = tags.map((tag: any) =>
        typeof tag === 'string'
          ? { name: tag }
          : { id: tag.id ?? tag.Id, name: tag.name ?? tag.Name }
      );
    }

    const assignedUsers = task.assignedUsers ?? task.AssignedUsers;
    if (assignedUsers !== undefined) {
      result['assignedUsers'] = assignedUsers;
    }

    return result;
  }

  private emitTasks(workspaceId: string) {
    const tasks = this.tasksCache.get(workspaceId) || [];
    this.auth.invalidateWorkspaceTasks(workspaceId);
    this.tasksSubject.next([...tasks]);
  }

  private registerListeners() {
    if (!this.hubConnection || this.listenersRegistered) return;
    this.listenersRegistered = true;

    this.hubConnection.on('taskCreated', (task) => {
      const workspaceId = this.currentWorkspaceId!;
      const tasks = this.tasksCache.get(workspaceId) || [];
      const normalized = this.normalizeTaskPayload(task);

      if (tasks.some(t => String(t.publicId) === String(normalized.publicId))) {
        return;
      }

      const updated = [normalized, ...tasks];

      this.tasksCache.set(workspaceId, updated);
      this.emitTasks(workspaceId);
    });

    this.hubConnection.on('taskUpdated', (updatedTask) => {
      const workspaceId = this.currentWorkspaceId!;
      const tasks = this.tasksCache.get(workspaceId) || [];
      const normalized = this.normalizeTaskPayload(updatedTask);
      const publicId = normalized.publicId;
      if (!publicId) return;

      const updated = tasks.map(t =>
        String(t.publicId) === String(publicId) ? this.mergeTask(t, normalized) : t
      );

      this.tasksCache.set(workspaceId, updated);
      this.emitTasks(workspaceId);
    });

    this.hubConnection.on('taskStatusChanged', (task) => {
      const workspaceId = this.currentWorkspaceId!;
      const tasks = this.tasksCache.get(workspaceId) || [];
      const publicId = task.publicId ?? task.PublicId;
      const status = task.status ?? task.Status;

      const updated = tasks.map(t =>
        String(t.publicId) === String(publicId) ? { ...t, status } : t
      );

      this.tasksCache.set(workspaceId, updated);
      this.emitTasks(workspaceId);
    });

    this.hubConnection.on('taskDeleted', (task) => {
      const workspaceId = this.currentWorkspaceId!;
      const tasks = this.tasksCache.get(workspaceId) || [];
      const publicId = task.publicId ?? task.PublicId;

      const updated = tasks.filter(t => String(t.publicId) !== String(publicId));

      this.tasksCache.set(workspaceId, updated);
      this.emitTasks(workspaceId);
    });

    this.hubConnection.on('NewInboxMessage', (messageData: any) => {
      const inboxMessage: InboxMessage = {
        publicId: messageData.publicId,
        title: messageData.title,
        body: messageData.body,
        type: messageData.type as InboxMessageType,
        channelPublicId: messageData.channelPublicId || null,
        createdAt: messageData.createdAt,
        isRead: false,
      };

      this.inboxService.receiveNewMessage(inboxMessage);
    });
  }
}
