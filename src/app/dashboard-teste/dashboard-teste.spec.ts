import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardTesteComponent } from './dashboard-teste';

describe('DashboardTesteComponent', () => {
  let component: DashboardTesteComponent;
  let fixture: ComponentFixture<DashboardTesteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardTesteComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DashboardTesteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});