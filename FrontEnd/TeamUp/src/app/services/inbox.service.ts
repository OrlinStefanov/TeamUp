import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { tap, shareReplay, catchError } from 'rxjs/operators';
import {
  InboxMessage,
  InboxResponse,
  InboxState,
  InboxMessageType,
  TASK_INBOX_TYPES,
  MEMBER_INBOX_TYPES,
} from '../models/inbox.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InboxService {
  private apiUrl = environment.apiUrl;
  private currentWorkspaceId: string | null = null;

  private inboxStateSubject = new BehaviorSubject<InboxState>({
    messages: [],
    unreadCount: 0,
    taskUnreadCount: 0,
    memberUnreadCount: 0,
    currentPage: 1,
    isLoading: false,
    error: null,
    hasMorePages: true,
  });
  inboxState$ = this.inboxStateSubject.asObservable();

  private newMessageSubject = new Subject<InboxMessage>();
  newMessage$ = this.newMessageSubject.asObservable();

  private pollingTimer: any = null;
  private readonly POLL_INTERVAL_MS = 30000;

  constructor(private http: HttpClient) {}

  setWorkspace(workspacePublicId: string): void {
    if (this.currentWorkspaceId !== workspacePublicId) {
      this.currentWorkspaceId = workspacePublicId;
      this.resetState();
    }
  }

  getInboxMessagesForWorkspace(workspacePublicId: string, page: number = 1): Observable<InboxResponse> {
    const url = `${this.apiUrl}/api/workspace/${workspacePublicId}/inbox?page=${page}`;
    return this.http.get<InboxResponse>(url, { withCredentials: true });
  }

  getInboxMessages(page: number = 1): Observable<InboxResponse> {
    if (!this.currentWorkspaceId) {
      throw new Error('Workspace not set. Call setWorkspace() first.');
    }

    const url = `${this.apiUrl}/api/workspace/${this.currentWorkspaceId}/inbox?page=${page}`;

    return this.http.get<InboxResponse>(url, { withCredentials: true }).pipe(
      tap((response) => {
        this.updateState((state) => {
          if (page === 1) {
            state.messages = this.sortMessagesByReadStatus(response.messages);
            state.currentPage = 1;
          } else {
            state.messages = [
              ...state.messages,
              ...this.sortMessagesByReadStatus(response.messages),
            ];
            state.currentPage = page;
          }

          state.unreadCount = response.unreadCount;
          state.taskUnreadCount = response.taskUnreadCount ?? 0;
          state.memberUnreadCount = response.memberUnreadCount ?? 0;
          state.hasMorePages = response.messages.length === response.pageSize;
          state.isLoading = false;
          state.error = null;
        });
      }),
      catchError((error) => {
        this.updateState((state) => {
          state.isLoading = false;
          state.error = 'Failed to load inbox messages';
        });
        throw error;
      }),
      shareReplay(1)
    );
  }

  markInboxAsRead(): Observable<any> {
    if (!this.currentWorkspaceId) {
      throw new Error('Workspace not set. Call setWorkspace() first.');
    }

    const url = `${this.apiUrl}/api/workspace/${this.currentWorkspaceId}/inbox/mark-read`;

    return this.http.post<any>(url, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.updateState((state) => {
          state.messages = state.messages.map((msg) => ({ ...msg, isRead: true }));
          state.unreadCount = 0;
        });
      }),
      catchError((error) => {
        this.updateState((state) => {
          state.error = 'Failed to mark inbox as read';
        });
        throw error;
      })
    );
  }

  markTaskInboxAsRead(): Observable<any> {
    if (!this.currentWorkspaceId) {
      throw new Error('Workspace not set. Call setWorkspace() first.');
    }

    const url = `${this.apiUrl}/api/workspace/${this.currentWorkspaceId}/inbox/mark-tasks-read`;

    return this.http.post<any>(url, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.updateState((state) => {
          state.taskUnreadCount = 0;
        });
      })
    );
  }

  markMemberInboxAsRead(): Observable<any> {
    if (!this.currentWorkspaceId) {
      throw new Error('Workspace not set. Call setWorkspace() first.');
    }

    const url = `${this.apiUrl}/api/workspace/${this.currentWorkspaceId}/inbox/mark-members-read`;

    return this.http.post<any>(url, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.updateState((state) => {
          state.memberUnreadCount = 0;
        });
      })
    );
  }

  discardMessage(messagePublicId: string): Observable<void> {
    if (!this.currentWorkspaceId) {
      throw new Error('Workspace not set. Call setWorkspace() first.');
    }

    const url = `${this.apiUrl}/api/workspace/${this.currentWorkspaceId}/inbox/discard/${messagePublicId}`;

    return this.http.post<void>(url, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.updateState((state) => {
          const removed = state.messages.find((msg) => msg.publicId === messagePublicId);
          state.messages = state.messages.filter((msg) => msg.publicId !== messagePublicId);

          if (removed && !removed.isRead) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);

            if (TASK_INBOX_TYPES.includes(removed.type)) {
              state.taskUnreadCount = Math.max(0, state.taskUnreadCount - 1);
            }

            if (MEMBER_INBOX_TYPES.includes(removed.type)) {
              state.memberUnreadCount = Math.max(0, state.memberUnreadCount - 1);
            }
          }
        });
      }),
      catchError((error) => {
        this.updateState((state) => {
          state.error = 'Failed to discard message';
        });
        throw error;
      })
    );
  }

  discardAllMessages(): Observable<{ dismissedCount: number }> {
    if (!this.currentWorkspaceId) {
      throw new Error('Workspace not set. Call setWorkspace() first.');
    }

    const url = `${this.apiUrl}/api/workspace/${this.currentWorkspaceId}/inbox/discard-all`;

    return this.http.post<{ dismissedCount: number }>(url, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.updateState((state) => {
          state.messages = [];
          state.unreadCount = 0;
          state.taskUnreadCount = 0;
          state.memberUnreadCount = 0;
          state.hasMorePages = false;
        });
      }),
      catchError((error) => {
        this.updateState((state) => {
          state.error = 'Failed to clear inbox';
        });
        throw error;
      })
    );
  }

  receiveNewMessage(message: InboxMessage): void {
    this.newMessageSubject.next(message);

    this.updateState((state) => {
      state.messages.unshift(message);

      if (!message.isRead) {
        state.unreadCount++;
      }

      if (TASK_INBOX_TYPES.includes(message.type)) {
        state.taskUnreadCount++;
      }

      if (MEMBER_INBOX_TYPES.includes(message.type)) {
        state.memberUnreadCount++;
      }
    });
  }

  getState(): InboxState {
    return this.inboxStateSubject.value;
  }

  startPolling(): void {
    if (this.pollingTimer) {
      return;
    }

    this.pollingTimer = setInterval(() => {
      if (this.currentWorkspaceId) {
        this.getInboxMessages(1).subscribe();
      }
    }, this.POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private resetState(): void {
    this.stopPolling();
    this.inboxStateSubject.next({
      messages: [],
      unreadCount: 0,
      taskUnreadCount: 0,
      memberUnreadCount: 0,
      currentPage: 1,
      isLoading: false,
      error: null,
      hasMorePages: true,
    });
  }

  private updateState(updater: (state: InboxState) => void): void {
    const currentState = this.inboxStateSubject.value;
    const newState = { ...currentState };
    updater(newState);
    this.inboxStateSubject.next(newState);
  }

  private sortMessagesByReadStatus(messages: InboxMessage[]): InboxMessage[] {
    return [...messages].sort((a, b) => {
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
}
