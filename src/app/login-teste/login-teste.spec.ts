import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginTeste } from './login-teste';

describe('LoginTeste', () => {
  let component: LoginTeste;
  let fixture: ComponentFixture<LoginTeste>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginTeste],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginTeste);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
