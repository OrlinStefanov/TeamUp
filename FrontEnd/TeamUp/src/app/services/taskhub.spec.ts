import { TestBed } from '@angular/core/testing';

import { Taskhub } from './taskhub';

describe('Taskhub', () => {
  let service: Taskhub;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Taskhub);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
