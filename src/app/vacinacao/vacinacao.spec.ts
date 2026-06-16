import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Vacinacao } from './vacinacao';

describe('Vacinacao', () => {
  let component: Vacinacao;
  let fixture: ComponentFixture<Vacinacao>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Vacinacao],
    }).compileComponents();

    fixture = TestBed.createComponent(Vacinacao);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
