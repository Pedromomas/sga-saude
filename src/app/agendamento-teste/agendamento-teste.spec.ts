import { ComponentFixture, TestBed } from '@angular/core/testing';

// 🔥 Importando o nome correto da classe e o caminho certo do arquivo
import { AgendamentoTesteComponent } from './agendamento-teste';

describe('AgendamentoTesteComponent', () => {
  let component: AgendamentoTesteComponent;
  let fixture: ComponentFixture<AgendamentoTesteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendamentoTesteComponent] // 🔥 Corrigido aqui também
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgendamentoTesteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});