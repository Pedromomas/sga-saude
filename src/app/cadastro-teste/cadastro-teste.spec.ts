import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CadastroTeste } from './cadastro-teste';

describe('CadastroTeste', () => {
  let component: CadastroTeste;
  let fixture: ComponentFixture<CadastroTeste>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CadastroTeste],
    }).compileComponents();

    fixture = TestBed.createComponent(CadastroTeste);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
