import { Routes } from '@angular/router';

// --- IMPORTAÇÃO DA NOVA TELA INICIAL ---
import { HomeComponent } from './home/home'; 

// --- IMPORTAÇÕES DAS SUAS TELAS ORIGINAIS ---
import { Login } from './login/login';
import { Cadastro } from './cadastro/cadastro';
import { Dashboard } from './dashboard/dashboard';
import { Perfil } from './perfil/perfil';
import { Agendamento } from './agendamento/agendamento';
// ❌ APAGUEI A IMPORTAÇÃO DO ADMIN ANTIGO DAQUI!

// --- IMPORTAÇÕES DAS SUAS OUTRAS TELAS DE TESTE ---
import { DashboardTesteComponent } from './dashboard-teste/dashboard-teste';
import { AgendamentoTesteComponent } from './agendamento-teste/agendamento-teste';
import { PerfilTesteComponent } from './perfil-teste/perfil-teste';
import { LoginTesteComponent } from './login-teste/login-teste';
import { CadastroTesteComponent } from './cadastro-teste/cadastro-teste'; 
import { AdminTesteComponent } from './admin-teste/admin-teste'; 

// --- IMPORTAÇÃO DA TELA DE VACINAÇÃO ---
import { VacinacaoComponent } from './vacinacao/vacinacao'; 

export const routes: Routes = [
  // 0. A PORTA DE ENTRADA (Landing Page)
  { path: '', component: HomeComponent }, 

  // 1. Rotas do Sistema Original
  { path: 'login', component: Login },
  { path: 'cadastro', component: Cadastro },
  { path: 'dashboard', component: Dashboard },
  { path: 'perfil', component: Perfil },
  { path: 'agendamento', component: Agendamento },
  
  // 🔥 O PULO DO GATO: Se o sistema chamar /admin, ele vai abrir a tela teste (Premium)
  { path: 'admin', component: AdminTesteComponent },

  // 2. Rotas de Teste e Premium
  { path: 'login-teste', component: LoginTesteComponent },
  { path: 'cadastro-teste', component: CadastroTesteComponent }, 
  { path: 'dashboard-teste', component: DashboardTesteComponent },
  { path: 'agendamento-teste', component: AgendamentoTesteComponent },
  { path: 'perfil-teste', component: PerfilTesteComponent },
  { path: 'admin-teste', component: AdminTesteComponent },

  // 3. Rota de Vacinação
  { path: 'vacinacao', component: VacinacaoComponent }, 

  // 4. Rota "Curinga" para erros de digitação
  { path: '**', redirectTo: '' }
];