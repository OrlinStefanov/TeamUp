import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { InboxService } from './inbox.service';
import { InboxMessage, InboxMessageType, InboxResponse } from '../models/inbox.models';

describe('InboxService', () => {
  let service: InboxService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [InboxService],
    });

    service = TestBed.inject(InboxService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    service.stopPolling();
  });

  describe('setWorkspace', () => {
    it('should set the current workspace and reset state', (done) => {
      service.setWorkspace('workspace-123');

      service.inboxState$.subscribe((state) => {
        expect(state.messages.length).toBe(0);
        expect(state.unreadCount).toBe(0);
        expect(state.currentPage).toBe(1);
        done();
      });
    });

    it('should reset state when switching workspaces', (done) => {
      service.setWorkspace('workspace-1');

      // Mock loading messages for first workspace
      service.getInboxMessages(1).subscribe();

      const mockResponse: InboxResponse = {
        page: 1,
        pageSize: 20,
        unreadCount: 2,
        taskUnreadCount: 1,
        memberUnreadCount: 0,
        messages: [
          {
            publicId: 'msg-1',
            title: 'Task Created',
            body: 'New task created',
            type: InboxMessageType.TaskCreated,
            channelPublicId: null,
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
      };

      const req1 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-1/inbox?page=1');
      req1.flush(mockResponse);

      service.inboxState$.subscribe((state) => {
        expect(state.messages.length).toBe(1);

        // Switch workspace
        service.setWorkspace('workspace-2');

        service.inboxState$.subscribe((newState) => {
          expect(newState.messages.length).toBe(0);
          expect(newState.unreadCount).toBe(0);
          done();
        });
      });
    });
  });

  describe('getInboxMessages', () => {
    it('should throw error if workspace not set', () => {
      expect(() => service.getInboxMessages(1)).toThrowError('Workspace not set');
    });

    it('should fetch inbox messages for page 1', (done) => {
      service.setWorkspace('workspace-123');

      const mockResponse: InboxResponse = {
        page: 1,
        pageSize: 20,
        unreadCount: 3,
        taskUnreadCount: 2,
        memberUnreadCount: 1,
        messages: [
          {
            publicId: 'msg-1',
            title: 'Task Created',
            body: 'New task assigned to you',
            type: InboxMessageType.TaskCreated,
            channelPublicId: null,
            createdAt: new Date().toISOString(),
            isRead: false,
          },
          {
            publicId: 'msg-2',
            title: 'Member Added',
            body: 'John joined the workspace',
            type: InboxMessageType.MemberAdded,
            channelPublicId: null,
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
      };

      service.getInboxMessages(1).subscribe((response) => {
        expect(response.unreadCount).toBe(3);
        expect(response.messages.length).toBe(2);

        service.inboxState$.subscribe((state) => {
          expect(state.messages.length).toBe(2);
          expect(state.unreadCount).toBe(3);
          expect(state.currentPage).toBe(1);
          expect(state.hasMorePages).toBe(false); // Only 2 messages, less than pageSize (20)
          done();
        });
      });

      const req = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox?page=1');
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });

    it('should sort messages with unread first', (done) => {
      service.setWorkspace('workspace-123');

      const mockResponse: InboxResponse = {
        page: 1,
        pageSize: 20,
        unreadCount: 1,
        taskUnreadCount: 1,
        memberUnreadCount: 0,
        messages: [
          {
            publicId: 'msg-1',
            title: 'Read Message',
            body: 'This is read',
            type: InboxMessageType.TaskCreated,
            channelPublicId: null,
            createdAt: '2026-06-08T10:00:00Z',
            isRead: true,
          },
          {
            publicId: 'msg-2',
            title: 'Unread Message',
            body: 'This is unread',
            type: InboxMessageType.TaskAssigned,
            channelPublicId: null,
            createdAt: '2026-06-08T11:00:00Z',
            isRead: false,
          },
        ],
      };

      service.getInboxMessages(1).subscribe();

      const req = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox?page=1');
      req.flush(mockResponse);

      service.inboxState$.subscribe((state) => {
        // Unread message should be first
        expect(state.messages[0].isRead).toBe(false);
        expect(state.messages[1].isRead).toBe(true);
        done();
      });
    });

    it('should append messages for subsequent pages', (done) => {
      service.setWorkspace('workspace-123');

      const mockResponse1: InboxResponse = {
        page: 1,
        pageSize: 20,
        unreadCount: 2,
        taskUnreadCount: 1,
        memberUnreadCount: 0,
        messages: [
          {
            publicId: 'msg-1',
            title: 'Message 1',
            body: 'Body 1',
            type: InboxMessageType.TaskCreated,
            channelPublicId: null,
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
      };

      service.getInboxMessages(1).subscribe();

      const req1 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox?page=1');
      req1.flush(mockResponse1);

      // Load page 2
      setTimeout(() => {
        const mockResponse2: InboxResponse = {
          page: 2,
          pageSize: 20,
          unreadCount: 2,
          taskUnreadCount: 1,
          memberUnreadCount: 0,
          messages: [
            {
              publicId: 'msg-2',
              title: 'Message 2',
              body: 'Body 2',
              type: InboxMessageType.TaskUpdated,
              channelPublicId: null,
              createdAt: new Date().toISOString(),
              isRead: false,
            },
          ],
        };

        service.getInboxMessages(2).subscribe();

        const req2 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox?page=2');
        req2.flush(mockResponse2);

        service.inboxState$.subscribe((state) => {
          expect(state.messages.length).toBe(2);
          expect(state.messages[0].publicId).toBe('msg-1');
          expect(state.messages[1].publicId).toBe('msg-2');
          expect(state.currentPage).toBe(2);
          done();
        });
      }, 100);
    });
  });

  describe('markInboxAsRead', () => {
    it('should throw error if workspace not set', () => {
      expect(() => service.markInboxAsRead()).toThrowError('Workspace not set');
    });

    it('should mark all messages as read', (done) => {
      service.setWorkspace('workspace-123');

      const mockResponse: InboxResponse = {
        page: 1,
        pageSize: 20,
        unreadCount: 2,
        taskUnreadCount: 1,
        memberUnreadCount: 0,
        messages: [
          {
            publicId: 'msg-1',
            title: 'Message 1',
            body: 'Body 1',
            type: InboxMessageType.TaskCreated,
            channelPublicId: null,
            createdAt: new Date().toISOString(),
            isRead: false,
          },
          {
            publicId: 'msg-2',
            title: 'Message 2',
            body: 'Body 2',
            type: InboxMessageType.TaskAssigned,
            channelPublicId: null,
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
      };

      service.getInboxMessages(1).subscribe();

      const req1 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox?page=1');
      req1.flush(mockResponse);

      service.markInboxAsRead().subscribe();

      const req2 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox/mark-read');
      expect(req2.request.method).toBe('POST');
      expect(req2.request.withCredentials).toBe(true);
      req2.flush('Marked as read');

      service.inboxState$.subscribe((state) => {
        expect(state.unreadCount).toBe(0);
        expect(state.messages.every((msg) => msg.isRead)).toBe(true);
        done();
      });
    });
  });

  describe('receiveNewMessage', () => {
    it('should add new message to the top of the list', (done) => {
      service.setWorkspace('workspace-123');

      const existingMessage: InboxMessage = {
        publicId: 'msg-1',
        title: 'Existing Message',
        body: 'Existing body',
        type: InboxMessageType.TaskCreated,
        channelPublicId: null,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      service.receiveNewMessage(existingMessage);

      const newMessage: InboxMessage = {
        publicId: 'msg-2',
        title: 'New Message',
        body: 'New body',
        type: InboxMessageType.TaskAssigned,
        channelPublicId: null,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      service.receiveNewMessage(newMessage);

      service.inboxState$.subscribe((state) => {
        expect(state.messages.length).toBe(2);
        expect(state.messages[0].publicId).toBe('msg-2'); // New message should be first
        expect(state.unreadCount).toBe(2);
        done();
      });
    });

    it('should increment unread count only if message is unread', (done) => {
      service.setWorkspace('workspace-123');

      const unreadMessage: InboxMessage = {
        publicId: 'msg-1',
        title: 'Unread Message',
        body: 'Unread body',
        type: InboxMessageType.TaskCreated,
        channelPublicId: null,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      service.receiveNewMessage(unreadMessage);

      const readMessage: InboxMessage = {
        publicId: 'msg-2',
        title: 'Read Message',
        body: 'Read body',
        type: InboxMessageType.TaskAssigned,
        channelPublicId: null,
        createdAt: new Date().toISOString(),
        isRead: true,
      };

      service.receiveNewMessage(readMessage);

      service.inboxState$.subscribe((state) => {
        expect(state.unreadCount).toBe(1); // Only 1 unread
        expect(state.messages.length).toBe(2);
        done();
      });
    });

    it('should emit new message observable', (done) => {
      const testMessage: InboxMessage = {
        publicId: 'msg-1',
        title: 'Test Message',
        body: 'Test body',
        type: InboxMessageType.TaskCreated,
        channelPublicId: null,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      service.newMessage$.subscribe((message) => {
        expect(message).toEqual(testMessage);
        done();
      });

      service.setWorkspace('workspace-123');
      service.receiveNewMessage(testMessage);
    });
  });

  describe('discardMessage', () => {
    it('should throw error if workspace not set', () => {
      expect(() => service.discardMessage('msg-1')).toThrowError('Workspace not set. Call setWorkspace() first.');
    });

    it('should discard a message and update state', (done) => {
      service.setWorkspace('workspace-123');

      const mockResponse: InboxResponse = {
        page: 1,
        pageSize: 20,
        unreadCount: 1,
        taskUnreadCount: 1,
        memberUnreadCount: 0,
        messages: [
          {
            publicId: 'msg-1',
            title: 'Message 1',
            body: 'Body 1',
            type: InboxMessageType.TaskCreated,
            channelPublicId: null,
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
      };

      service.getInboxMessages(1).subscribe();

      const req1 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox?page=1');
      req1.flush(mockResponse);

      service.discardMessage('msg-1').subscribe();

      const req2 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox/discard/msg-1');
      expect(req2.request.method).toBe('POST');
      req2.flush(null);

      service.inboxState$.subscribe((state) => {
        expect(state.messages.length).toBe(0);
        expect(state.unreadCount).toBe(0);
        done();
      });
    });
  });

  describe('discardAllMessages', () => {
    it('should throw error if workspace not set', () => {
      expect(() => service.discardAllMessages()).toThrowError('Workspace not set. Call setWorkspace() first.');
    });

    it('should discard all messages and clear state', (done) => {
      service.setWorkspace('workspace-123');

      const mockResponse: InboxResponse = {
        page: 1,
        pageSize: 20,
        unreadCount: 2,
        taskUnreadCount: 1,
        memberUnreadCount: 1,
        messages: [
          {
            publicId: 'msg-1',
            title: 'Message 1',
            body: 'Body 1',
            type: InboxMessageType.TaskCreated,
            channelPublicId: null,
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
      };

      service.getInboxMessages(1).subscribe();

      const req1 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox?page=1');
      req1.flush(mockResponse);

      service.discardAllMessages().subscribe((response) => {
        expect(response.dismissedCount).toBe(1);
      });

      const req2 = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox/discard-all');
      expect(req2.request.method).toBe('POST');
      req2.flush({ dismissedCount: 1 });

      service.inboxState$.subscribe((state) => {
        expect(state.messages.length).toBe(0);
        expect(state.unreadCount).toBe(0);
        done();
      });
    });
  });

  describe('Polling', () => {
    it('should start polling on startPolling()', (done) => {
      service.setWorkspace('workspace-123');
      service.startPolling();

      // Wait for at least one polling interval
      setTimeout(() => {
        // Should have made a request
        const req = httpMock.expectOne('https://localhost:7094/api/workspace/workspace-123/inbox?page=1');
        req.flush({
          page: 1,
          pageSize: 20,
          unreadCount: 0,
          taskUnreadCount: 0,
          memberUnreadCount: 0,
          messages: [],
        });

        done();
      }, 100);
    });

    it('should stop polling on stopPolling()', (done) => {
      service.setWorkspace('workspace-123');
      service.startPolling();

      setTimeout(() => {
        service.stopPolling();
        httpMock.expectNone('https://localhost:7094/api/workspace/workspace-123/inbox?page=1');
        done();
      }, 500);
    });
  });
});
