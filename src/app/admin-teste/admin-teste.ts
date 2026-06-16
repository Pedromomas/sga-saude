import { Component, OnInit, OnDestroy, TemplateRef, ViewChild, inject, ChangeDetectorRef, NgZone } from '@angular/core'; 
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms'; 
import { Router, RouterModule } from '@angular/router'; 

// Módulos do Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs'; 
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; 

// Firebase
import { Firestore, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, addDoc, query, where, onSnapshot } from '@angular/fire/firestore'; 
import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth'; 

@Component({
  selector: 'app-admin-teste',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule, MatDialogModule, MatSnackBarModule, MatToolbarModule, 
    MatCardModule, MatButtonModule, RouterModule, MatTabsModule, 
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule
  ],
  templateUrl: './admin-teste.html',
  styleUrls: ['./admin-teste.scss']
})
export class AdminTesteComponent implements OnInit, OnDestroy {
  nivelAcesso: 'funcionario' | 'chefe' | 'supremo' = 'supremo';
  abaAtiva = 'dashboard'; 
  protocoloEmergenciaAtivo = false;
  isLoading = true;

  // Listas base do Banco
  fila: any[] = []; mural: any[] = []; equipe: any[] = []; usuariosMap: { [key: string]: any } = {};
  stats = { totalAgendamentos: 0, aguardando: 0, emAtendimento: 0, atendidos: 0, cancelados: 0, totalPacientesCadastrados: 0 };
  
  filtroData: 'hoje' | 'todos' = 'hoje'; 
  filtroStatus: 'todos' | 'aguardando' | 'compareceu' | 'faltou' = 'aguardando';

  // VARIÁVEIS PRÉ-CALCULADAS PARA MÁXIMA PERFORMANCE
  filaFiltradaProp: any[] = [];
  resumoAtualProp: any = { titulo: 'Agendamentos de Hoje', total: 0, compareceu: 0, faltou: 0 };
  vagasParaRepasseProp: any[] = [];
  equipeFiltradaProp: any[] = [];
  stringGraficoPizzaProp: string = '';
  taxaSucessoProp: number = 0;

  novoAviso = { titulo: '', desc: '', icone: 'campaign', cor: '#3b82f6', validadeDias: 7 };
  criandoAviso = false;
  iconesDisponiveis = [ { id: 'campaign', nome: 'Aviso Geral' }, { id: 'vaccines', nome: 'Vacinação' }, { id: 'coronavirus', nome: 'Alerta Vírus' }, { id: 'warning', nome: 'Atenção' }, { id: 'medication', nome: 'Remédios' }, { id: 'event', nome: 'Evento' } ];
  coresDisponiveis = [ { hex: '#3b82f6', nome: 'Azul (Informativo)' }, { hex: '#10b981', nome: 'Verde (Saúde)' }, { hex: '#f59e0b', nome: 'Laranja (Atenção)' }, { hex: '#ef4444', nome: 'Vermelho (Urgente)' } ];

  novoStaff = { nomeCompleto: '', email: '', cargo: 'funcionario', unidadeTrabalho: 'Todas' };
  criandoStaff = false;
  unidadesPadrao: string[] = ['Todas', 'Hospital Municipal Rocha Faria', 'Posto de Saúde - Bangu', 'Clínica da Família'];
  unidadesDisponiveis: string[] = [...this.unidadesPadrao]; 
  minhaUnidadeSimulada = 'Hospital Municipal Rocha Faria'; 

  novaConfigUnidade = ''; novaConfigEspecialidade = ''; 
  novaConfigVacina = { nome: '', idadeMin: 0, idadeMax: 120, dataLimite: '' };
  configRegra = { unidade: 'Todas' }; 

  listaUnidadesOficiais: any[] = []; listaEspecialidadesOficiais: any[] = []; listaVacinasOficiais: any[] = [];
  novaAgendaUnidade = ''; novaAgendaEspecialidade = ''; novaAgendaHorarios = '08:00, 09:00, 10:00, 11:00, 14:00, 15:00'; novaAgendaVagas = 1;
  listaAgendasOficiais: any[] = [];

  // VARIÁVEIS DA VACINAÇÃO
  listaVacinacaoGlobal: any[] = [];
  listaPacientes: any[] = []; 
  novaVacinaAdmin = { pacienteId: '', pacienteNome: '', cpf: '', nome: '', dataAplicacao: '', dose: '1ª Dose', status: 'concluida', unidade: '', idadePaciente: 0 };
  criandoVacinaAdmin = false;
  private unsubVacinacao: any;
  
  buscaCpfAdmin: string = '';
  pacienteEncontrado: boolean | null = null; 
  erroRegraVacina: string = ''; 

  // SISTEMA DE MODAL PREMIUM
  @ViewChild('modalConfirmacao') modalConfirmacao!: TemplateRef<any>;
  confirmacaoTitulo = '';
  confirmacaoTexto = '';
  acaoConfirmacao: any;

  @ViewChild('modalRepasse') modalRepasse!: TemplateRef<any>;
  pacientesSubstitutos: any[] = [];
  vagaOriginal: any = null;
  statusNotificacao: { [key: string]: boolean } = {};

  private unsubAgendamentos: any; private unsubUsuarios: any; private unsubAvisos: any; private unsubConfig: any;

  private firestore = inject(Firestore);
  private auth = inject(Auth); 
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone); 

  carregandoPerfil = true;
  carregandoConsultas = false; 
  meuPerfilAdmin: any = null; 
  filtroUnidadeSupremo = 'Todas'; 
  todasConsultas: any[] = [];

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        await this.verificarCargo(user.uid);
      } else {
        this.router.navigate(['/login-teste']);
      }
    });
    this.iniciarTempoReal(); 
  }

  ngOnDestroy() { 
    if (this.unsubAgendamentos) this.unsubAgendamentos(); 
    if (this.unsubUsuarios) this.unsubUsuarios(); 
    if (this.unsubAvisos) this.unsubAvisos(); 
    if (this.unsubConfig) this.unsubConfig(); 
    if (this.unsubVacinacao) this.unsubVacinacao(); 
  }

  async verificarCargo(uid: string) {
    try {
      const docUser = await getDoc(doc(this.firestore, 'usuarios', uid));
      if (docUser.exists()) {
        const dados: any = docUser.data(); 
        if (!dados['cargo'] || dados['cargo'] === 'paciente') {
          this.snackBar.open('Acesso Negado. Área restrita.', 'OK', { duration: 3000 });
          this.router.navigate(['/dashboard-teste']);
          return;
        }
        this.meuPerfilAdmin = { id: uid, ...dados };
        if (this.meuPerfilAdmin.cargo !== 'supremo') this.configRegra.unidade = this.meuPerfilAdmin.unidadeTrabalho;
        this.carregarTodasConsultas();
      }
    } catch (erro) { console.error("Erro:", erro); } 
    finally { this.zone.run(() => { this.carregandoPerfil = false; this.cdr.detectChanges(); }); }
  }

  setAba(aba: string) { this.abaAtiva = aba; }
  get dataHoje() { return new Date().toISOString().split('T')[0]; }

  formatarDataBR(dataIso: string): string {
    if (!dataIso) return '';
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

  diasParaExpirar(dataExp: string): string { 
    if (!dataExp) return 'Sem validade'; 
    const diffTime = Math.abs(new Date(dataExp).getTime() - new Date().getTime()); 
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays === 1 ? 'Expira amanhã' : `Expira em ${diffDays} dias`; 
  }

  getNome(p: any): string { if (p.paciente) return p.paciente; if (p.nomeCompleto) return p.nomeCompleto; if (p.pacienteId && this.usuariosMap[p.pacienteId]) return this.usuariosMap[p.pacienteId].nomeCompleto || this.usuariosMap[p.pacienteId].nome || 'Paciente sem nome'; return 'Paciente Desconhecido'; }
  getCpf(p: any): string { if (p.cpf) return p.cpf; if (p.pacienteId && this.usuariosMap[p.pacienteId]) return this.usuariosMap[p.pacienteId].cpf || 'N/A'; return 'N/A'; }
  getCorStatus(status: string) { if (!status) return 'aguardando'; const s = status.toLowerCase(); if (s === 'compareceu' || s === 'atendido' || s === 'finalizado') return 'atendido'; if (s === 'faltou' || s.includes('cancelad')) return 'cancelado'; return 'aguardando'; }

  mostrarAviso(mensagem: string) {
    const isError = mensagem.includes('❌') || mensagem.includes('⚠️') || mensagem.includes('🚨');
    this.snackBar.open(mensagem, 'OK', { 
      duration: 4000, 
      horizontalPosition: 'center', 
      verticalPosition: 'bottom', 
      panelClass: ['premium-snackbar', isError ? 'error-snackbar' : 'success-snackbar'] 
    });
  }

  atualizarCalculosDeFila() {
    this.filaFiltradaProp = this.fila.filter(p => { 
      const dataAgendamento = p.data || (p.criadoEm ? p.criadoEm.split('T')[0] : this.dataHoje); 
      const passaData = this.filtroData === 'todos' || dataAgendamento === this.dataHoje; 
      const statusNormalizado = this.getCorStatus(p.status);
      const passaStatus = this.filtroStatus === 'todos' || statusNormalizado === this.filtroStatus; 
      return passaData && passaStatus; 
    });

    const agendamentosNaData = this.fila.filter(p => { 
      const dataAgendamento = p.data || (p.criadoEm ? p.criadoEm.split('T')[0] : this.dataHoje); 
      return this.filtroData === 'todos' || dataAgendamento === this.dataHoje; 
    }); 
    this.resumoAtualProp = { 
      titulo: this.filtroData === 'todos' ? 'Histórico Completo' : 'Agendamentos de Hoje', 
      total: agendamentosNaData.length, 
      compareceu: agendamentosNaData.filter(p => this.getCorStatus(p.status) === 'atendido').length, 
      faltou: agendamentosNaData.filter(p => this.getCorStatus(p.status) === 'cancelado').length 
    };

    this.vagasParaRepasseProp = this.fila.filter(p => this.getCorStatus(p.status) === 'cancelado');
  }

  atualizarCalculosDashboard() {
    this.taxaSucessoProp = this.stats.totalAgendamentos === 0 ? 0 : Math.round((this.stats.atendidos / this.stats.totalAgendamentos) * 100);
    const total = this.stats.totalAgendamentos; 
    if (total === 0) {
      this.stringGraficoPizzaProp = 'conic-gradient(#e2e8f0 0% 100%)'; 
    } else {
      const pAtendidos = (this.stats.atendidos / total) * 100; const pEmAtendimento = (this.stats.emAtendimento / total) * 100; const pAguardando = (this.stats.aguardando / total) * 100; let acum = 0; 
      const c1 = `#10b981 ${acum}% ${acum += pAtendidos}%`; const c2 = `#3b82f6 ${acum}% ${acum += pEmAtendimento}%`; const c3 = `#f59e0b ${acum}% ${acum += pAguardando}%`; const c4 = `#ef4444 ${acum}% 100%`; 
      this.stringGraficoPizzaProp = `conic-gradient(${c1}, ${c2}, ${c3}, ${c4})`;
    }
  }

  atualizarEquipe() {
    this.equipeFiltradaProp = this.equipe.filter(membro => { 
      if (this.nivelAcesso === 'supremo') return true; 
      if (this.nivelAcesso === 'chefe') return membro.cargo === 'funcionario'; 
      return false; 
    });
  }

  alterarFiltroData(filtro: 'hoje' | 'todos') {
    this.filtroData = filtro;
    this.atualizarCalculosDeFila();
  }

  alterarFiltroStatus(filtro: 'todos' | 'aguardando' | 'compareceu' | 'faltou') {
    this.filtroStatus = filtro;
    this.atualizarCalculosDeFila();
  }

  abrirConfirmacao(titulo: string, texto: string, acao: () => void) {
    this.confirmacaoTitulo = titulo;
    this.confirmacaoTexto = texto;
    this.acaoConfirmacao = acao;
    this.dialog.open(this.modalConfirmacao, { width: '400px', panelClass: 'premium-dialog' });
  }

  executarAcaoConfirmacao() {
    if (this.acaoConfirmacao) this.acaoConfirmacao();
    this.dialog.closeAll();
  }

  iniciarTempoReal() {
    this.isLoading = true;
    setTimeout(() => { this.isLoading = false; }, 600);

    this.unsubAgendamentos = onSnapshot(collection(this.firestore, 'agendamentos'), (snapshot) => {
      this.fila = []; let total = 0; let aguardando = 0; let emAtendimento = 0; let atendidos = 0; let cancelados = 0;
      snapshot.forEach((doc) => { 
        total++; const data = doc.data(); this.fila.push({ id: doc.id, ...data }); 
        const s = (data['status'] || '').toLowerCase(); 
        if (s === 'em atendimento') emAtendimento++; else if (s === 'compareceu' || s === 'atendido' || s === 'finalizado') atendidos++; else if (s === 'faltou' || s.includes('cancelad')) cancelados++; else aguardando++; 
      });
      this.stats.totalAgendamentos = total; this.stats.aguardando = aguardando; this.stats.emAtendimento = emAtendimento; this.stats.atendidos = atendidos; this.stats.cancelados = cancelados;
      
      this.atualizarCalculosDeFila();
      this.atualizarCalculosDashboard();
    });

    this.unsubUsuarios = onSnapshot(collection(this.firestore, 'usuarios'), (snapshot) => {
      this.equipe = []; this.stats.totalPacientesCadastrados = 0; this.usuariosMap = {}; this.unidadesDisponiveis = [...this.unidadesPadrao];
      this.listaPacientes = []; 
      snapshot.forEach((doc) => {
        const data = doc.data(); this.usuariosMap[doc.id] = data;
        if (data['unidadeTrabalho'] && !this.unidadesDisponiveis.includes(data['unidadeTrabalho'])) { this.unidadesDisponiveis.push(data['unidadeTrabalho']); }
        if (data['cargo'] === 'paciente' || !data['cargo']) { this.stats.totalPacientesCadastrados++; this.listaPacientes.push({ id: doc.id, ...data }); }
        if (data['cargo'] && data['cargo'] !== 'paciente') this.equipe.push({ id: doc.id, ...data });
      });
      if (!this.novoStaff.unidadeTrabalho || !this.unidadesDisponiveis.includes(this.novoStaff.unidadeTrabalho)) { this.aoTrocarCargo(); }
      this.atualizarEquipe();
    });

    this.unsubAvisos = onSnapshot(collection(this.firestore, 'avisos'), (snapshot) => {
      this.mural = []; const agora = new Date().toISOString();
      snapshot.forEach((doc) => { const aviso = doc.data(); if (!aviso['dataExpiracao'] || aviso['dataExpiracao'] > agora) { this.mural.push({ id: doc.id, ...aviso }); } });
      this.mural.sort((a, b) => (b.criadoEm > a.criadoEm ? 1 : -1));
    });

    this.unsubConfig = onSnapshot(collection(this.firestore, 'configuracoes'), (snapshot) => {
      this.listaUnidadesOficiais = []; this.listaEspecialidadesOficiais = []; this.listaAgendasOficiais = []; this.listaVacinasOficiais = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data['tipo'] === 'unidade') this.listaUnidadesOficiais.push({ id: doc.id, ...data });
        if (data['tipo'] === 'especialidade') this.listaEspecialidadesOficiais.push({ id: doc.id, ...data });
        if (data['tipo'] === 'vacina') this.listaVacinasOficiais.push({ id: doc.id, ...data });
        if (data['tipo'] === 'agenda') this.listaAgendasOficiais.push({ id: doc.id, ...data });
      });
    });

    this.unsubVacinacao = onSnapshot(collection(this.firestore, 'vacinacao'), (snapshot) => {
      this.listaVacinacaoGlobal = [];
      snapshot.forEach((doc) => { this.listaVacinacaoGlobal.push({ id: doc.id, ...doc.data() }); });
      this.listaVacinacaoGlobal.sort((a, b) => new Date(b.dataAplicacao).getTime() - new Date(a.dataAplicacao).getTime());
    });
  }

  async carregarTodasConsultas() {
    this.zone.run(() => { this.carregandoConsultas = true; this.cdr.detectChanges(); });
    try {
      const colecaoAgendamentos = collection(this.firestore, 'agendamentos');
      let buscaRef: any = colecaoAgendamentos; 
      if (this.meuPerfilAdmin?.cargo !== 'supremo') { buscaRef = query(colecaoAgendamentos, where('unidade', '==', this.meuPerfilAdmin?.unidadeTrabalho || '')); } 
      else if (this.meuPerfilAdmin?.cargo === 'supremo' && this.filtroUnidadeSupremo !== 'Todas') { buscaRef = query(colecaoAgendamentos, where('unidade', '==', this.filtroUnidadeSupremo)); }
      const snapshot = await getDocs(buscaRef);
      const cacheUsuarios: any = {}; 
      const promessasDeConsultas = snapshot.docs.map(async (documento) => {
        const dados: any = documento.data();  
        let infoPaciente = { nome: 'Paciente Desconhecido', endereco: 'Não informado', cep: '---' };
        if (dados['pacienteId']) {
          const idDoPaciente = dados['pacienteId'];
          if (!cacheUsuarios[idDoPaciente]) { const docUsuario = await getDoc(doc(this.firestore, 'usuarios', idDoPaciente)); cacheUsuarios[idDoPaciente] = docUsuario.exists() ? docUsuario.data() : null; }
          const u: any = cacheUsuarios[idDoPaciente]; 
          if (u) { infoPaciente = { nome: u['nomeCompleto'], endereco: `${u['endereco']}, ${u['numero']}`, cep: u['cep'] }; }
        }
        return { id: documento.id, infoPaciente, ...dados };
      });
      const resultadosFinalizados = await Promise.all(promessasDeConsultas);
      this.zone.run(() => { this.todasConsultas = resultadosFinalizados; this.carregandoConsultas = false; this.cdr.detectChanges(); });
    } catch (erro) { this.zone.run(() => { this.carregandoConsultas = false; this.cdr.detectChanges(); }); } 
  }

  async atualizarStatusAgendamento(id: string, novoStatus: 'compareceu' | 'cancelada') { 
    try { await updateDoc(doc(this.firestore, 'agendamentos', id), { status: novoStatus }); this.mostrarAviso(`✅ Status atualizado.`); } catch (e) { this.mostrarAviso('❌ Erro.'); } 
  }

  abrirModalRepasse(consultaCancelada: any) {
    this.vagaOriginal = consultaCancelada; this.statusNotificacao = {}; 
    const dataCorte = new Date(); dataCorte.setDate(dataCorte.getDate() + 3); const dataCorteStr = dataCorte.toISOString().split('T')[0];
    this.pacientesSubstitutos = this.fila.filter(p => (!p.status || p.status.toLowerCase() === 'confirmada' || p.status.toLowerCase() === 'aguardando') && p.especialidade === consultaCancelada.especialidade && p.unidade === consultaCancelada.unidade && p.data >= dataCorteStr);
    this.pacientesSubstitutos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    this.dialog.open(this.modalRepasse, { width: '500px', panelClass: 'premium-dialog' });
  }

  getTelefone(p: any): string { if (p.telefone) return p.telefone; if (p.pacienteId && this.usuariosMap[p.pacienteId]) return this.usuariosMap[p.pacienteId].telefone || ''; return ''; }
  getEmail(p: any): string { if (p.email) return p.email; if (p.pacienteId && this.usuariosMap[p.pacienteId]) return this.usuariosMap[p.pacienteId].email || ''; return ''; }

  chamarNoWhatsApp(p: any) {
    this.statusNotificacao[p.id] = true; 
    const telefoneBruto = this.getTelefone(p); const telefone = telefoneBruto.replace(/\D/g, ''); 
    if (!telefone) { this.mostrarAviso('⚠️ Este paciente não tem telefone cadastrado.'); return; }
    const msg = `Olá ${this.getNome(p)}, temos uma vaga de urgência para ${this.vagaOriginal?.especialidade || p.especialidade} no dia ${this.formatarDataBR(this.vagaOriginal?.data || this.dataHoje)} às ${this.vagaOriginal?.horario || 'um horário próximo'}. Deseja antecipar?`;
    window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  chamarNoEmail(p: any) {
    this.statusNotificacao[p.id] = true; 
    const email = this.getEmail(p);
    if (!email) { this.mostrarAviso('⚠️ Este paciente não tem e-mail cadastrado.'); return; }
    const msg = `Olá ${this.getNome(p)},\n\nTemos uma vaga de urgência para ${this.vagaOriginal?.especialidade || p.especialidade} no dia ${this.formatarDataBR(this.vagaOriginal?.data || this.dataHoje)}. Responda este e-mail caso queira ficar com a vaga.`;
    window.open(`mailto:${email}?subject=Antecipação de Consulta - SGA Saúde&body=${encodeURIComponent(msg)}`, '_blank');
  }

  confirmarRepasseVaga(substituto: any) {
    this.abrirConfirmacao('Confirmar Repasse', `O paciente ${this.getNome(substituto)} confirmou que quer a vaga?`, async () => {
      try {
        await updateDoc(doc(this.firestore, 'agendamentos', substituto.id), { data: this.vagaOriginal.data, horario: this.vagaOriginal.horario || 'Encaixe Extra' });
        await deleteDoc(doc(this.firestore, 'agendamentos', this.vagaOriginal.id));
        this.mostrarAviso('✅ Vaga repassada com sucesso!');
        this.dialog.closeAll(); 
      } catch (e) { this.mostrarAviso('❌ Erro ao repassar a vaga.'); }
    });
  }

  async salvarNovoAviso() { 
    if (!this.novoAviso.titulo || !this.novoAviso.desc) return; this.criandoAviso = true; const dataExpiracao = new Date(new Date().getTime() + (this.novoAviso.validadeDias * 24 * 60 * 60 * 1000)); 
    try { await addDoc(collection(this.firestore, 'avisos'), { titulo: this.novoAviso.titulo, desc: this.novoAviso.desc, icone: this.novoAviso.icone, cor: this.novoAviso.cor, criadoEm: new Date().toISOString(), dataExpiracao: dataExpiracao.toISOString() }); this.novoAviso = { titulo: '', desc: '', icone: 'campaign', cor: '#3b82f6', validadeDias: 7 }; this.mostrarAviso('✅ Aviso publicado no mural!'); } catch (e) { this.mostrarAviso('❌ Erro.'); } this.criandoAviso = false; 
  }
  
  deletarAviso(id: string) { 
    this.abrirConfirmacao('Excluir Aviso', 'Este comunicado sumirá imediatamente do app dos pacientes.', async () => {
      await deleteDoc(doc(this.firestore, 'avisos', id)); this.mostrarAviso('✅ Aviso removido.');
    }); 
  }
  
  aoTrocarCargo() { if (this.novoStaff.cargo === 'supremo') { this.novoStaff.unidadeTrabalho = 'Todas'; } else { if (this.novoStaff.unidadeTrabalho === 'Todas' || !this.novoStaff.unidadeTrabalho) { const unidadesReais = this.unidadesDisponiveis.filter(u => u !== 'Todas'); this.novoStaff.unidadeTrabalho = unidadesReais.length > 0 ? unidadesReais[0] : ''; } } }
  
  async salvarNovoStaff() { 
    if (!this.novoStaff.nomeCompleto || !this.novoStaff.email) return; this.criandoStaff = true; 
    try { await addDoc(collection(this.firestore, 'usuarios'), { nomeCompleto: this.novoStaff.nomeCompleto, email: this.novoStaff.email, cargo: this.novoStaff.cargo, unidadeTrabalho: this.nivelAcesso === 'chefe' ? this.minhaUnidadeSimulada : (this.novoStaff.unidadeTrabalho || 'Todas'), criadoEm: new Date().toISOString() }); this.novoStaff = { nomeCompleto: '', email: '', cargo: 'funcionario', unidadeTrabalho: 'Todas' }; this.aoTrocarCargo(); this.mostrarAviso('✅ Colaborador cadastrado.'); } catch (e) { this.mostrarAviso('❌ Erro.'); } this.criandoStaff = false; 
  }
  
  removerStaff(id: string, cargo: string) { 
    if (this.nivelAcesso === 'chefe' && cargo !== 'funcionario') { this.mostrarAviso('❌ Acesso Negado.'); return; } 
    this.abrirConfirmacao('Revogar Acesso', 'Este funcionário perderá acesso ao painel.', async () => {
      await deleteDoc(doc(this.firestore, 'usuarios', id)); this.mostrarAviso('✅ Acesso revogado.');
    }); 
  }
  
  async adicionarConfiguracao(tipo: 'unidade' | 'especialidade' | 'vacina') { 
    if (tipo === 'vacina') {
        if (!this.novaConfigVacina.nome.trim()) return;
        try { await addDoc(collection(this.firestore, 'configuracoes'), { ...this.novaConfigVacina, tipo: 'vacina', criadoEm: new Date().toISOString() }); this.novaConfigVacina = { nome: '', idadeMin: 0, idadeMax: 120, dataLimite: '' }; this.mostrarAviso('✅ Regra de vacina salva.'); } catch(e) { console.error(e); }
        return;
    }
    let valor = tipo === 'unidade' ? this.novaConfigUnidade : this.novaConfigEspecialidade;
    if (!valor.trim()) return; 
    try { await addDoc(collection(this.firestore, 'configuracoes'), { nome: valor.trim(), tipo: tipo, criadoEm: new Date().toISOString() }); if (tipo === 'unidade') { this.novaConfigUnidade = ''; this.mostrarAviso('✅ Unidade salva.'); } else { this.novaConfigEspecialidade = ''; this.mostrarAviso('✅ Especialidade salva.'); } } catch (e) { console.error(e); } 
  }
  
  async adicionarAgenda() { if (!this.novaAgendaUnidade || !this.novaAgendaEspecialidade || !this.novaAgendaHorarios) return; try { await addDoc(collection(this.firestore, 'configuracoes'), { tipo: 'agenda', unidade: this.novaAgendaUnidade, especialidade: this.novaAgendaEspecialidade, horariosDisponiveis: this.novaAgendaHorarios, vagasPorHora: this.novaAgendaVagas, criadoEm: new Date().toISOString() }); this.novaAgendaHorarios = '08:00, 09:00, 10:00, 11:00, 14:00, 15:00'; this.novaAgendaVagas = 1; this.mostrarAviso('✅ Agenda criada.'); } catch (e) { console.error("Erro ao criar agenda:", e); } }
  
  deletarConfiguracao(id: string) { 
    this.abrirConfirmacao('Excluir Registro', 'Deseja excluir esta configuração do sistema permanentemente?', async () => {
      await deleteDoc(doc(this.firestore, 'configuracoes', id)); this.mostrarAviso('✅ Removido com sucesso.');
    }); 
  }

  async chamarPaciente(idConsulta: string) {
    try { await updateDoc(doc(this.firestore, 'agendamentos', idConsulta), { status: 'Em Atendimento' }); this.mostrarAviso('📢 Paciente chamado para atendimento!'); this.carregarTodasConsultas(); } catch (erro) { console.error('Erro:', erro); }
  }

  // 🔥 PERMISSÃO ATUALIZADA: TODOS OS NÍVEIS ACESSAM VACINAS 🔥
  podeGerenciarVacinacao(): boolean { return true; }

  podeVerEquipe(): boolean { return this.nivelAcesso === 'chefe' || this.nivelAcesso === 'supremo'; }
  podeAcionarEmergencia(): boolean { return this.nivelAcesso === 'chefe' || this.nivelAcesso === 'supremo'; }

  mudarNivel(nivel: 'funcionario' | 'chefe' | 'supremo') { 
    this.nivelAcesso = nivel; 
    if (nivel === 'chefe') { this.novoStaff.unidadeTrabalho = this.minhaUnidadeSimulada; } else { this.aoTrocarCargo(); } 
    if (this.abaAtiva === 'equipe' && !this.podeVerEquipe()) this.abaAtiva = 'dashboard'; 
    if (this.abaAtiva === 'config' && nivel !== 'supremo') this.abaAtiva = 'dashboard'; 
    this.atualizarEquipe();
  }
  
  async sair() { 
    try { await signOut(this.auth); this.router.navigate(['/login-teste']); } catch (e) { console.error('Erro ao sair:', e); }
  }

  buscarPacientePorCpf(event: any) {
    let v = event.target.value.replace(/\D/g, ''); 
    if (v.length > 11) v = v.slice(0, 11);
    const cpfLimpoParaBusca = v;
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    this.buscaCpfAdmin = v; 

    if (cpfLimpoParaBusca.length === 11) { 
      const todosOsUsuarios = [...this.listaPacientes, ...this.equipe];
      const pacienteEncontrado = todosOsUsuarios.find(p => (p.cpf || '').replace(/\D/g, '') === cpfLimpoParaBusca);
      if (pacienteEncontrado) {
        this.novaVacinaAdmin.pacienteId = pacienteEncontrado.id;
        this.novaVacinaAdmin.pacienteNome = pacienteEncontrado.nomeCompleto || pacienteEncontrado.nome || 'Sem Nome';
        this.novaVacinaAdmin.cpf = pacienteEncontrado.cpf;
        this.novaVacinaAdmin.idadePaciente = this.calcularIdade(pacienteEncontrado.dataNascimento);
        this.pacienteEncontrado = true;
        this.validarRegrasVacina(); 
      } else { this.limparDadosPaciente(); this.pacienteEncontrado = false; }
    } else { this.limparDadosPaciente(); this.pacienteEncontrado = null; }
  }

  limparDadosPaciente() { this.novaVacinaAdmin.pacienteId = ''; this.novaVacinaAdmin.pacienteNome = ''; this.novaVacinaAdmin.cpf = ''; this.novaVacinaAdmin.idadePaciente = 0; this.erroRegraVacina = ''; }

  validarRegrasVacina() {
    this.erroRegraVacina = '';
    const vacinaSelecionada = this.listaVacinasOficiais.find(v => v.nome === this.novaVacinaAdmin.nome);
    if (this.pacienteEncontrado && vacinaSelecionada) {
      if (this.novaVacinaAdmin.idadePaciente < vacinaSelecionada.idadeMin || this.novaVacinaAdmin.idadePaciente > vacinaSelecionada.idadeMax) {
        this.erroRegraVacina = `⚠️ Paciente fora da faixa etária (${vacinaSelecionada.idadeMin} a ${vacinaSelecionada.idadeMax} anos).`;
      }
      if (vacinaSelecionada.dataLimite) {
        if (new Date() > new Date(vacinaSelecionada.dataLimite)) {
          this.erroRegraVacina = `⚠️ Campanha encerrada em ${this.formatarDataBR(vacinaSelecionada.dataLimite)}.`;
        }
      }
    }
  }

  async salvarNovaVacinaAdmin() {
    if (this.erroRegraVacina) { this.mostrarAviso('❌ Corrija as regras da vacina primeiro.'); return; }
    if (!this.novaVacinaAdmin.pacienteId || !this.novaVacinaAdmin.nome || !this.novaVacinaAdmin.dataAplicacao || !this.novaVacinaAdmin.unidade) { this.mostrarAviso('❌ Preencha os campos obrigatórios!'); return; }
    this.criandoVacinaAdmin = true;
    try {
      await addDoc(collection(this.firestore, 'vacinacao'), { ...this.novaVacinaAdmin, criadoEm: new Date().toISOString() });
      this.novaVacinaAdmin = { pacienteId: '', pacienteNome: '', cpf: '', nome: '', dataAplicacao: '', dose: '1ª Dose', status: 'concluida', unidade: '', idadePaciente: 0 };
      this.buscaCpfAdmin = ''; this.pacienteEncontrado = null;
      this.mostrarAviso('✅ Registro de vacina salvo com sucesso no SUS!');
    } catch (e) { this.mostrarAviso('❌ Erro ao salvar.'); }
    this.criandoVacinaAdmin = false;
  }

  deletarVacinaAdmin(id: string) {
    this.abrirConfirmacao('Excluir Imunização', 'Este registro de vacina será apagado do histórico do paciente.', async () => {
      await deleteDoc(doc(this.firestore, 'vacinacao', id)); this.mostrarAviso('✅ Registro apagado.');
    });
  }

  gerarPDF() { window.print(); }
}