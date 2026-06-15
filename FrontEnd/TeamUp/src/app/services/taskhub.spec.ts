import { TestBed } from '@angular/core/testing';

import { Taskhub } from './taskhub';
import { InboxService } from './inbox.service';
import { Auth } from './auth/auth';

describe('Taskhub', () => {
  let service: Taskhub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: InboxService, useValue: { receiveNewMessage: () => {} } },
        { provide: Auth, useValue: { invalidateWorkspaceTasks: () => {} } }
      ]
    });
    service = TestBed.inject(Taskhub);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
