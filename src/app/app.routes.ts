import { Routes } from '@angular/router';

// --- IMPORTAÇÃO DA NOVA TELA INICIAL ---
import { HomeComponent } from './home/home'; // ✨ A Home pika importada aqui!

// --- IMPORTAÇÕES DAS SUAS TELAS ORIGINAIS ---
import { Login } from './login/login';
import { Cadastro } from './cadastro/cadastro';
import { Dashboard } from './dashboard/dashboard';
import { Perfil } from './perfil/perfil';
import { Agendamento } from './agendamento/agendamento';
import { Admin } from './admin/admin';

// --- IMPORTAÇÕES DAS SUAS OUTRAS TELAS DE TESTE ---
import { DashboardTesteComponent } from './dashboard-teste/dashboard-teste';
import { AgendamentoTesteComponent } from './agendamento-teste/agendamento-teste';
import { PerfilTesteComponent } from './perfil-teste/perfil-teste';
import { LoginTesteComponent } from './login-teste/login-teste';
import { CadastroTesteComponent } from './cadastro-teste/cadastro-teste'; 
import { AdminTesteComponent } from './admin-teste/admin-teste'; 

export const routes: Routes = [
  // 0. A PORTA DE ENTRADA (Lending Page)
  { path: '', component: HomeComponent }, // ✨ Agora o site começa por aqui!

  // 1. Rotas do Sistema Original
  { path: 'login', component: Login },
  { path: 'cadastro', component: Cadastro },
  { path: 'dashboard', component: Dashboard },
  { path: 'perfil', component: Perfil },
  { path: 'agendamento', component: Agendamento },
  { path: 'admin', component: Admin },

  // 2. Rotas de Teste e Premium
  { path: 'login-teste', component: LoginTesteComponent },
  { path: 'cadastro-teste', component: CadastroTesteComponent }, 
  { path: 'dashboard-teste', component: DashboardTesteComponent },
  { path: 'agendamento-teste', component: AgendamentoTesteComponent },
  { path: 'perfil-teste', component: PerfilTesteComponent },
  { path: 'admin-teste', component: AdminTesteComponent },

  // 3. Rota "Curinga" para erros de digitação
  // Se o cara digitar algo errado, ele volta para a Home inicial
  { path: '**', redirectTo: '' }
];