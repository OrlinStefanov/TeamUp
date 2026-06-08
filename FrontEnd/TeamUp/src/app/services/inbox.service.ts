import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, interval } from 'rxjs';
import { tap, shareReplay, catchError } from 'rxjs/operators';
import { InboxMessage, InboxResponse, InboxState, InboxMessageType } from '../models/inbox.models';

@Injectable({ providedIn: 'root' })
export class InboxService {
  private apiUrl = 'https://localhost:7094';
  private currentWorkspaceId: string | null = null;

  // State management
  private inboxStateSubject = new BehaviorSubject<InboxState>({
    messages: [],
    unreadCount: 0,
    currentPage: 1,
    isLoading: false,
    error: null,
    hasMorePages: true,
  });
  inboxState$ = this.inboxStateSubject.asObservable();

  // Real-time updates
  private newMessageSubject = new Subject<InboxMessage>();
  newMessage$ = this.newMessageSubject.asObservable();

  // Polling timer
  private pollingTimer: any = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds

  constructor(private http: HttpClient) {}

  /**
   * Set the current workspace context
   */
  setWorkspace(workspacePublicId: string): void {
    if (this.currentWorkspaceId !== workspacePublicId) {
      this.currentWorkspaceId = workspacePublicId;
      this.resetState();
    }
  }

  /**
   * Get inbox messages for current workspace with pagination
   */
  getInboxMessages(page: number = 1): Observable<InboxResponse> {
    if (!this.currentWorkspaceId) {
      throw new Error('Workspace not set. Call setWorkspace() first.');
    }

    const url = `${this.apiUrl}/api/workspace/${this.currentWorkspaceId}/inbox?page=${page}`;

    return this.http.get<InboxResponse>(url, { withCredentials: true }).pipe(
      tap((response) => {
        this.updateState((state) => {
          if (page === 1) {
            // First page: replace all messages
            state.messages = this.sortMessagesByReadStatus(response.messages);
            state.currentPage = 1;
          } else {
            // Subsequent pages: append messages
            state.messages = [
              ...state.messages,
              ...this.sortMessagesByReadStatus(response.messages),
            ];
            state.currentPage = page;
          }

          state.unreadCount = response.unreadCount;
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

  /**
   * Mark all inbox messages as read for the current workspace
   */
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

  /**
   * Handle new message received via SignalR
   */
  receiveNewMessage(message: InboxMessage): void {
    this.newMessageSubject.next(message);
    
    this.updateState((state) => {
      // Prepend new message to the beginning
      state.messages.unshift(message);
      
      // Increment unread count if not already read
      if (!message.isRead) {
        state.unreadCount++;
      }
    });
  }

  /**
   * Get current inbox state snapshot
   */
  getState(): InboxState {
    return this.inboxStateSubject.value;
  }

  /**
   * Start periodic polling for new messages (fallback when SignalR is down)
   */
  startPolling(): void {
    if (this.pollingTimer) {
      return; // Already polling
    }

    this.pollingTimer = setInterval(() => {
      if (this.currentWorkspaceId) {
        this.getInboxMessages(1).subscribe();
      }
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop periodic polling
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Reset inbox state (e.g., when switching workspaces)
   */
  private resetState(): void {
    this.stopPolling();
    this.inboxStateSubject.next({
      messages: [],
      unreadCount: 0,
      currentPage: 1,
      isLoading: false,
      error: null,
      hasMorePages: true,
    });
  }

  /**
   * Update state using a updater function (immutable pattern)
   */
  private updateState(updater: (state: InboxState) => void): void {
    const currentState = this.inboxStateSubject.value;
    const newState = { ...currentState };
    updater(newState);
    this.inboxStateSubject.next(newState);
  }

  /**
   * Sort messages: unread first, then by date descending
   */
  private sortMessagesByReadStatus(messages: InboxMessage[]): InboxMessage[] {
    return [...messages].sort((a, b) => {
      // Unread messages first
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }

      // Then by date descending (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
}
