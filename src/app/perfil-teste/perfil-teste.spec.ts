import { ComponentFixture, TestBed } from '@angular/core/testing';

// 🔥 Importando o nome certinho da nossa classe
import { PerfilTesteComponent } from './perfil-teste';

describe('PerfilTesteComponent', () => {
  let component: PerfilTesteComponent;
  let fixture: ComponentFixture<PerfilTesteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilTesteComponent] // 🔥 Corrigido aqui tmb
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PerfilTesteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});