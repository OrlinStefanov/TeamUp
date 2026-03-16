import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Taskdetails } from './taskdetails';

describe('Taskdetails', () => {
  let component: Taskdetails;
  let fixture: ComponentFixture<Taskdetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Taskdetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Taskdetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
