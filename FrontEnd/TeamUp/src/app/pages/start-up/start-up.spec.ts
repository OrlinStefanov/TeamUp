import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartUp } from './start-up';

describe('StartUp', () => {
  let component: StartUp;
  let fixture: ComponentFixture<StartUp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StartUp]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StartUp);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
