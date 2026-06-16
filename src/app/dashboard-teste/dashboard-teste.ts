import { Component, inject, OnInit, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
// 🔥 IMPORTAÇÃO DO SIGNOUT DO FIREBASE 🔥
import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface Vacina {
  id?: string;
  nome: string;
  dataAplicacao: string;
  dose: string;
  status: 'concluida' | 'pendente' | 'atrasada';
  unidade: string;
}

@Component({
  selector: 'app-dashboard-teste',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatToolbarModule, MatButtonModule, MatIconModule,
    MatCardModule, MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, FormsModule
  ],
  templateUrl: './dashboard-teste.html',
  styleUrl: './dashboard-teste.scss'
})
export class DashboardTesteComponent implements OnInit {
  nomeUsuario = '';
  saudacao = 'Olá';
  loadingNome = true;
  meusAgendamentos: any[] = [];
  avisosDoMural: any[] = [];
  photoURL = ''; 
  mostrarNotificacoes: boolean = false;

  termoBusca: string = '';
  resultadosBusca: any[] = [];
  mostrarResultados: boolean = false;

  mapaDoSistema = [
    { titulo: 'Meu Perfil', rota: '/perfil-teste', icone: 'manage_accounts', tags: ['perfil', 'conta', 'dados', 'senha', 'foto', 'usuario'] },
    { titulo: 'Novo Agendamento', rota: '/agendamento-teste', icone: 'add_task', tags: ['agendar', 'nova consulta', 'marcar', 'médico', 'exame'] },
    { titulo: 'Meus Exames', rota: '/exames', icone: 'science', tags: ['exames', 'laudos', 'resultados', 'laboratório'] },
    { titulo: 'Plantão Virtual', rota: '/telemedicina', icone: 'videocam', tags: ['plantão', 'telemedicina', 'online', 'médico online'] },
    { titulo: 'Carteira de Vacinação', rota: '/vacinacao', icone: 'vaccines', tags: ['vacina', 'imunização', 'dose', 'carteira', 'sus'] }
  ];

  @ViewChild('modalCancelamento') modalCancelamento!: TemplateRef<any>;
  idConsultaSelecionada = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  dataNascimentoPaciente: string = '';
  idadePaciente: number = 0;
  totalDoses = 0;
  pendentes = 0;
  concluidas = 0;
  statusGeral = 'Carregando...';
  porcentagem = 0;
  ultimaDoseData = '--/--/----';

  ngOnInit() {
    this.definirSaudacao();
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        await this.carregarPerfil(user.uid);
        await this.carregarAgendamentos(user.uid);
        await this.carregarAvisos();
        await this.carregarVacinasInteligentes(user.uid); 
      } else {
        // 🔥 REDIRECIONA PARA LOGIN TESTE SE ESTIVER DESLOGADO 🔥
        this.router.navigate(['/login-teste']);
      }
    });
  }

  // 🔥 FUNÇÃO DE DESLOGAR INJETADA AQUI 🔥
  async sair() {
    try {
      await signOut(this.auth);
      // O onAuthStateChanged acima vai captar a mudança e mandar pro /login-teste automaticamente!
    } catch (e) {
      console.error('Erro ao deslogar:', e);
    }
  }

  formatarDataBR(dataIso: string): string {
    if (!dataIso) return '--/--/----';
    const partes = dataIso.split('-');
    if (partes.length !== 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  calcularIdade(dataNasc: string): number {
    if (!dataNasc) return 0;
    const hoje = new Date();
    const nascimento = new Date(dataNasc);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
    return Math.max(0, idade);
  }

  buscarNoSistema() {
    const busca = this.termoBusca.toLowerCase().trim();
    if (!busca) { this.resultadosBusca = []; this.mostrarResultados = false; return; }
    this.resultadosBusca = this.mapaDoSistema.filter(item => {
      return item.titulo.toLowerCase().includes(busca) || item.tags.some(tag => tag.includes(busca));
    });
    this.mostrarResultados = this.resultadosBusca.length > 0;
  }

  fecharBusca() { setTimeout(() => { this.mostrarResultados = false; }, 200); }
  irParaRota(rota: string) { this.termoBusca = ''; this.mostrarResultados = false; this.router.navigate([rota]); }
  toggleNotificacoes() { this.mostrarNotificacoes = !this.mostrarNotificacoes; }

  definirSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) this.saudacao = 'Bom dia';
    else if (hora >= 12 && hora < 18) this.saudacao = 'Boa tarde';
    else this.saudacao = 'Boa noite';
  }

  async carregarPerfil(uid: string) {
    try {
      const docSnap = await getDoc(doc(this.firestore, 'usuarios', uid));
      if (docSnap.exists()) {
        const data: any = docSnap.data(); 
        this.nomeUsuario = data['nomeCompleto'] ? data['nomeCompleto'].split(' ')[0] : 'VIP';
        this.photoURL = data['photoURL'] || ''; 
        this.dataNascimentoPaciente = data['dataNascimento'] || '';
        this.idadePaciente = this.calcularIdade(this.dataNascimentoPaciente);
      }
    } catch (e) { console.error("Erro perfil:", e); }
    this.loadingNome = false;
    this.cdr.detectChanges();
  }

  async carregarAgendamentos(uid: string) {
    try {
      const q = query(collection(this.firestore, 'agendamentos'), where('pacienteId', '==', uid));
      const querySnapshot = await getDocs(q);
      this.meusAgendamentos = [];
      querySnapshot.forEach((doc) => { this.meusAgendamentos.push({ id: doc.id, ...doc.data() }); });
      this.meusAgendamentos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      this.cdr.detectChanges();
    } catch (e) { console.error("Erro agendamentos:", e); }
  }

  async carregarAvisos() {
    try {
      const querySnapshot = await getDocs(collection(this.firestore, 'avisos'));
      this.avisosDoMural = [];
      const agora = new Date().toISOString();
      querySnapshot.forEach((doc) => {
        const aviso = doc.data();
        if (!aviso['dataExpiracao'] || aviso['dataExpiracao'] > agora) { this.avisosDoMural.push({ id: doc.id, ...aviso }); }
      });
      this.avisosDoMural.sort((a, b) => (b.criadoEm > a.criadoEm ? 1 : -1));
      this.cdr.detectChanges();
    } catch (e) { console.error("Erro mural:", e); }
  }

  async carregarVacinasInteligentes(uid: string) {
    try {
      const hojeStr = new Date().toISOString().split('T')[0];

      const qRegras = query(collection(this.firestore, 'configuracoes'), where('tipo', '==', 'vacina'));
      const regrasSnap = await getDocs(qRegras);
      const regrasOficiais = regrasSnap.docs.map(d => d.data());

      const qTomadas = query(collection(this.firestore, 'vacinacao'), where('pacienteId', '==', uid));
      const tomadasSnap = await getDocs(qTomadas);
      const vacinasTomadas: Vacina[] = [];
      const nomesTomados: string[] = []; 

      tomadasSnap.forEach((doc) => {
        const data = doc.data() as Vacina;
        vacinasTomadas.push({ id: doc.id, ...data });
        nomesTomados.push(data.nome.toLowerCase().trim());
      });

      const tomadasConcluidas = vacinasTomadas.filter(v => v.status === 'concluida');
      if (tomadasConcluidas.length > 0) {
        tomadasConcluidas.sort((a, b) => new Date(b.dataAplicacao).getTime() - new Date(a.dataAplicacao).getTime());
        this.ultimaDoseData = this.formatarDataBR(tomadasConcluidas[0].dataAplicacao);
      } else {
        this.ultimaDoseData = '--/--/----';
      }

      let vacinasFinais: Vacina[] = [...vacinasTomadas];

      regrasOficiais.forEach(regra => {
        const nomeOficial = regra['nome'].toLowerCase().trim();
        const idadeMin = Number(regra['idadeMin']) || 0;
        const idadeMax = Number(regra['idadeMax']) || 120;
        const dataLimite = regra['dataLimite'];

        if (this.idadePaciente >= idadeMin && this.idadePaciente <= idadeMax) {
          if (!nomesTomados.includes(nomeOficial)) {
            let statusVirtual: 'pendente' | 'atrasada' = 'pendente';
            if (dataLimite && dataLimite < hojeStr) {
              statusVirtual = 'atrasada';
            }
            vacinasFinais.push({
              id: 'virtual_' + regra['nome'], nome: regra['nome'],
              dataAplicacao: '', dose: '', status: statusVirtual, unidade: ''
            });
          }
        }
      });

      this.totalDoses = vacinasTomadas.length; 
      this.pendentes = vacinasFinais.filter(v => v.status === 'pendente' || v.status === 'atrasada').length;
      const totalNecessario = this.totalDoses + this.pendentes;

      if (totalNecessario === 0) {
        this.statusGeral = 'Sem Dados';
        this.porcentagem = 0;
      } else if (this.pendentes > 0) {
        const temAtraso = vacinasFinais.some(v => v.status === 'atrasada');
        this.statusGeral = temAtraso ? 'Em Atraso' : 'Atenção';
        this.porcentagem = Math.round((this.totalDoses / totalNecessario) * 100);
      } else {
        this.statusGeral = 'Protegido';
        this.porcentagem = 100;
      }

      this.cdr.detectChanges();
    } catch (e) { console.error("Erro vacinas dash:", e); }
  }
  
  abrirModalDeCancelamento(idDaConsulta: string) {
    this.idConsultaSelecionada = idDaConsulta;
    this.dialog.open(this.modalCancelamento, { width: '400px', disableClose: true, panelClass: 'premium-dialog' });
  }

  async cancelarConsulta() {
    if (!this.idConsultaSelecionada) return;
    this.dialog.closeAll();
    try {
      await updateDoc(doc(this.firestore, 'agendamentos', this.idConsultaSelecionada), { status: 'Cancelada' });
      this.mostrarAviso('✅ Consulta cancelada e vaga liberada!');
      const user = this.auth.currentUser;
      if(user) this.carregarAgendamentos(user.uid);
      this.idConsultaSelecionada = '';
    } catch(e) { this.mostrarAviso('❌ Erro ao cancelar a consulta.'); }
  }

  async excluirConsulta(idDaConsulta: string) {
    try {
      await deleteDoc(doc(this.firestore, 'agendamentos', idDaConsulta));
      this.mostrarAviso('🗑️ Removida do histórico!');
      const user = this.auth.currentUser;
      if(user) this.carregarAgendamentos(user.uid); 
    } catch(e) { this.mostrarAviso('❌ Erro.'); }
  }

  mostrarAviso(mensagem: string) {
    this.snackBar.open(mensagem, 'OK', { duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['premium-snackbar'] });
  }
}