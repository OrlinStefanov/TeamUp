import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InboxService } from '../../services/inbox.service';
import { InboxState, InboxMessage, getMessageTypeIcon, getMessageTypeColor } from '../../models/inbox.models';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-inbox-drawer',
  standalone: true, 
  imports: [CommonModule],
  template: `
    <div class="inbox-drawer-overlay" [class.show]="isOpen" (click)="closeDrawer()"></div>
    <div class="inbox-drawer" [class.open]="isOpen">
      <div class="inbox-drawer-header">
        <h5 class="mb-0">Workspace Inbox</h5>
        <div class="inbox-header-actions">
          @if (state.messages.length > 0) {
            <button class="btn-clear-all" type="button" title="Clear all" (click)="discardAll()">
              Clear all
            </button>
          }
          <button class="tu-modal-close inbox-drawer-close" type="button" aria-label="Close inbox" (click)="closeDrawer()">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        </div>
      </div>

      <div class="inbox-drawer-content">
        @if (state.isLoading && state.messages.length === 0) {
          <div class="loading-state">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p>Loading messages...</p>
          </div>
        } @else if (state.messages.length === 0) {
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16" opacity="0.5">
              <path d="M.5 1A.5.5 0 0 1 1 .5h14a.5.5 0 0 1 1 .5v2a.5.5 0 0 1-.5.5H15V14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3H.5a.5.5 0 0 1-.5-.5zm3 4a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5"/>
            </svg>
            <p>No messages yet</p>
            <small>Workspace notifications will appear here</small>
          </div>
        } @else {
          <div class="messages-list">
            @for (message of state.messages; track message.publicId) {
              <div class="message-item" [class.unread]="!message.isRead">
                <div class="message-type-badge" [class]="getMessageTypeColor(message.type)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <use [attr.xlink:href]="'#icon-' + getMessageTypeIcon(message.type)"></use>
                  </svg>
                </div>
                <div class="message-content">
                  <h6 class="message-title">{{ message.title }}</h6>
                  <p class="message-body">{{ message.body }}</p>
                  <small class="message-time">{{ formatTime(message.createdAt) }}</small>
                </div>
                <button
                  class="btn-discard"
                  type="button"
                  title="Discard"
                  (click)="discardMessage(message, $event)">
                  ×
                </button>
                @if (!message.isRead) {
                  <div class="unread-indicator"></div>
                }
              </div>
            }
          </div>

          @if (state.hasMorePages) {
            <button class="btn btn-outline-secondary btn-sm w-100 mt-3" 
                    (click)="loadMore()" 
                    [disabled]="state.isLoading">
              @if (state.isLoading) {
                <span class="spinner-border spinner-border-sm me-2" role="status">
                  <span class="visually-hidden">Loading...</span>
                </span>
              }
              Load More
            </button>
          }
        }

        @if (state.error) {
          <div class="alert alert-danger alert-sm mb-0" role="alert">
            {{ state.error }}
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .inbox-drawer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      z-index: 1040;
    }

    .inbox-drawer-overlay.show {
      opacity: 1;
      visibility: visible;
    }

    .inbox-drawer {
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: 400px;
      background-color: var(--bg-color, white);
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 1050;
      display: flex;
      flex-direction: column;
    }

    .inbox-drawer.open {
      transform: translateX(0);
    }

    @media (max-width: 768px) {
      .inbox-drawer {
        width: 100%;
      }
    }

    .inbox-drawer-header {
      position: relative;
      padding: 1.25rem 3rem 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-color, #e0e0e0);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .inbox-drawer-close {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 2;
    }

    .inbox-header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-right: 2rem;
    }

    .btn-clear-all {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-size: 0.8rem;
      color: var(--text-muted, #6c757d);
      transition: color 0.2s ease;
    }

    .btn-clear-all:hover {
      color: var(--text-danger, #dc3545);
    }

    .inbox-drawer-header h5 {
      font-weight: 600;
      margin: 0;
    }

    .inbox-drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }

    .loading-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      text-align: center;
      color: var(--text-muted, #6c757d);
    }

    .empty-state {
      min-height: 300px;
    }

    .empty-state small {
      color: var(--text-muted-light, #999);
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .message-item {
      display: flex;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
      background-color: var(--bg-light, #f8f9fa);
      border-left: 3px solid transparent;
      transition: background-color 0.2s ease, border-color 0.2s ease;
      position: relative;
    }

    .message-item:hover {
      background-color: var(--bg-lighter, #f0f0f0);
    }

    .message-item.unread {
      border-left-color: var(--primary-color, #007bff);
      background-color: var(--bg-primary-light, #f0f7ff);
    }

    .message-type-badge {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: white;
      font-size: 0.9rem;
    }

    .message-type-badge.primary {
      background-color: #007bff;
    }

    .message-type-badge.success {
      background-color: #28a745;
    }

    .message-type-badge.danger {
      background-color: #dc3545;
    }

    .message-type-badge.warning {
      background-color: #ffc107;
      color: #333;
    }

    .message-type-badge.info {
      background-color: #17a2b8;
    }

    .message-type-badge.secondary {
      background-color: #6c757d;
    }

    .message-content {
      flex: 1;
      min-width: 0;
    }

    .message-title {
      margin: 0 0 0.25rem 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-color, #333);
    }

    .message-body {
      margin: 0 0 0.5rem 0;
      font-size: 0.85rem;
      color: var(--text-secondary, #666);
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .message-time {
      font-size: 0.75rem;
      color: var(--text-muted, #999);
    }

    .unread-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #007bff;
      flex-shrink: 0;
      margin-top: 0.5rem;
    }

    .btn-discard {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      line-height: 1;
      font-size: 1.1rem;
      color: var(--text-muted, #999);
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.2s ease, color 0.2s ease;
    }

    .message-item:hover .btn-discard {
      opacity: 1;
    }

    .btn-discard:hover {
      color: var(--text-danger, #dc3545);
    }

    .alert-sm {
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
    }

    /* Dark mode support */
    :host(.dark-mode),
    :host-context(.dark-mode) {
      --bg-color: #17171f;
      --text-color: #f5f2ff;
      --text-secondary: #9a98a8;
      --text-muted: #6b6b8a;
      --text-muted-light: #6b6b8a;
      --border-color: #363345;
      --bg-light: #1e1e2e;
      --bg-lighter: #241b33;
      --bg-primary-light: rgba(168, 85, 247, 0.12);
      --primary-color: #a855f7;
    }

    :host(.dark-mode) .btn-outline-secondary,
    :host-context(.dark-mode) .btn-outline-secondary {
      border-color: #2a2a3a;
      color: #b0b0d0;
      background: transparent;
    }

    :host(.dark-mode) .btn-outline-secondary:hover,
    :host-context(.dark-mode) .btn-outline-secondary:hover {
      background: rgba(168, 85, 247, 0.12);
      border-color: #7c3aed;
      color: #c4b5fd;
    }

    :host(.dark-mode) .unread-indicator,
    :host-context(.dark-mode) .unread-indicator {
      background-color: #a855f7;
    }

    :host(.dark-mode) .message-item.unread,
    :host-context(.dark-mode) .message-item.unread {
      border-left-color: #a855f7;
    }

    :host(.light-mode),
    :host-context(.light-mode) {
      --bg-color: white;
      --text-color: #333;
      --text-secondary: #666;
      --text-muted: #999;
      --border-color: #e0e0e0;
      --bg-light: #f8f9fa;
      --bg-lighter: #f0f0f0;
      --bg-primary-light: #f0f7ff;
    }
  `]
})
export class InboxDrawerComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() markAsRead = new EventEmitter<void>();

  state: InboxState = {
    messages: [],
    unreadCount: 0,
    taskUnreadCount: 0,
    memberUnreadCount: 0,
    currentPage: 1,
    isLoading: false,
    error: null,
    hasMorePages: true,
  };

  private destroy$ = new Subject<void>();

  constructor(private inboxService: InboxService) {}

  ngOnInit(): void {
    this.inboxService.inboxState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: InboxState) => {
        this.state = state;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  closeDrawer(): void {
    this.close.emit();
  }

  loadMore(): void {
    const nextPage = this.state.currentPage + 1;
    this.inboxService.getInboxMessages(nextPage).subscribe();
  }

  discardMessage(message: InboxMessage, event: Event): void {
    event.stopPropagation();
    this.inboxService.discardMessage(message.publicId).subscribe();
  }

  discardAll(): void {
    this.inboxService.discardAllMessages().subscribe();
  }

  formatTime(createdAt: string): string {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  getMessageTypeIcon(type: string): string {
    return getMessageTypeIcon(type as any);
  }

  getMessageTypeColor(type: string): string {
    return getMessageTypeColor(type as any);
  }
}