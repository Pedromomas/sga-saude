import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminTesteComponent } from './admin-teste';

describe('AdminTesteComponent', () => {
  let component: AdminTesteComponent;
  let fixture: ComponentFixture<AdminTesteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTesteComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminTesteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});