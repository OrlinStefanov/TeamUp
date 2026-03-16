import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Chatdetails } from './chatdetails';

describe('Chatdetails', () => {
  let component: Chatdetails;
  let fixture: ComponentFixture<Chatdetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chatdetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Chatdetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
