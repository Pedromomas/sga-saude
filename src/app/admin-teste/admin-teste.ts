import { Component, OnInit, OnDestroy, TemplateRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Firestore, collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-teste',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
  templateUrl: './admin-teste.html',
  styleUrls: ['./admin-teste.scss']
})
export class AdminTesteComponent implements OnInit, OnDestroy {
  nivelAcesso: 'funcionario' | 'chefe' | 'supremo' = 'supremo';
  abaAtiva = 'dashboard'; 
  protocoloEmergenciaAtivo = false;
  isLoading = true;

  fila: any[] = []; mural: any[] = []; equipe: any[] = []; usuariosMap: { [key: string]: any } = {};
  stats = { totalAgendamentos: 0, aguardando: 0, emAtendimento: 0, atendidos: 0, cancelados: 0, totalPacientesCadastrados: 0 };
  
  filtroData: 'hoje' | 'todos' = 'todos'; filtroStatus: 'todos' | 'aguardando' | 'compareceu' | 'faltou' = 'aguardando';

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
  listaUnidadesOficiais: any[] = []; listaEspecialidadesOficiais: any[] = [];
  novaAgendaUnidade = ''; novaAgendaEspecialidade = ''; novaAgendaHorarios = '08:00, 09:00, 10:00, 11:00, 14:00, 15:00'; novaAgendaVagas = 1;
  listaAgendasOficiais: any[] = [];

  @ViewChild('modalRepasse') modalRepasse!: TemplateRef<any>;
  pacientesSubstitutos: any[] = [];
  vagaOriginal: any = null;
  statusNotificacao: { [key: string]: boolean } = {};

  private unsubAgendamentos: any; private unsubUsuarios: any; private unsubAvisos: any; private unsubConfig: any;

  private firestore = inject(Firestore);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  ngOnInit() { this.iniciarTempoReal(); }
  ngOnDestroy() { if (this.unsubAgendamentos) this.unsubAgendamentos(); if (this.unsubUsuarios) this.unsubUsuarios(); if (this.unsubAvisos) this.unsubAvisos(); if (this.unsubConfig) this.unsubConfig(); }

  setAba(aba: string) { this.abaAtiva = aba; }
  get dataHoje() { return new Date().toISOString().split('T')[0]; }

  // 🔥 O TRADUTOR DE DATAS (Inverte de YYYY-MM-DD para DD/MM/YYYY)
  formatarDataBR(dataIso: string): string {
    if (!dataIso) return 'Data não definida';
    const partes = dataIso.split('-');
    if (partes.length !== 3) return dataIso; // Se não for padrão, devolve como tá
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  getNome(p: any): string { if (p.paciente) return p.paciente; if (p.nomeCompleto) return p.nomeCompleto; if (p.pacienteId && this.usuariosMap[p.pacienteId]) return this.usuariosMap[p.pacienteId].nomeCompleto || this.usuariosMap[p.pacienteId].nome || 'Paciente sem nome'; return 'Paciente Desconhecido'; }
  getCpf(p: any): string { if (p.cpf) return p.cpf; if (p.pacienteId && this.usuariosMap[p.pacienteId]) return this.usuariosMap[p.pacienteId].cpf || 'N/A'; return 'N/A'; }
  get filaFiltrada() { return this.fila.filter(p => { const dataAgendamento = p.data || (p.criadoEm ? p.criadoEm.split('T')[0] : this.dataHoje); const passaData = this.filtroData === 'todos' || dataAgendamento === this.dataHoje; const statusBanco = (p.status || 'aguardando').toLowerCase(); let statusNormalizado = 'aguardando'; if (statusBanco === 'compareceu' || statusBanco === 'atendido' || statusBanco === 'finalizado') statusNormalizado = 'compareceu'; if (statusBanco === 'faltou' || statusBanco.includes('cancelad')) statusNormalizado = 'faltou'; const passaStatus = this.filtroStatus === 'todos' || statusNormalizado === this.filtroStatus; return passaData && passaStatus; }); }
  get resumoAtual() { const agendamentosNaData = this.fila.filter(p => { const dataAgendamento = p.data || (p.criadoEm ? p.criadoEm.split('T')[0] : this.dataHoje); return this.filtroData === 'todos' || dataAgendamento === this.dataHoje; }); return { titulo: this.filtroData === 'todos' ? 'Histórico Completo' : 'Agendamentos de Hoje', total: agendamentosNaData.length, compareceu: agendamentosNaData.filter(p => { const s = (p.status || '').toLowerCase(); return s === 'compareceu' || s === 'atendido' || s === 'finalizado'; }).length, faltou: agendamentosNaData.filter(p => { const s = (p.status || '').toLowerCase(); return s === 'faltou' || s.includes('cancelad'); }).length }; }
  get taxaSucesso() { if (this.stats.totalAgendamentos === 0) return 0; return Math.round((this.stats.atendidos / this.stats.totalAgendamentos) * 100); }
  async atualizarStatusAgendamento(id: string, novoStatus: 'compareceu' | 'cancelada') { try { await updateDoc(doc(this.firestore, 'agendamentos', id), { status: novoStatus }); } catch (e) { console.error(e); } }
  getCorStatus(status: string) { if (!status) return 'aguardando'; const s = status.toLowerCase(); if (s === 'compareceu' || s === 'atendido' || s === 'finalizado') return 'atendido'; if (s === 'faltou' || s.includes('cancelad')) return 'cancelado'; return 'aguardando'; }
  get vagasParaRepasse() { return this.fila.filter(p => this.getCorStatus(p.status) === 'cancelado'); }

  iniciarTempoReal() {
    this.isLoading = true;
    setTimeout(() => { this.isLoading = false; }, 600);

    this.unsubAgendamentos = onSnapshot(collection(this.firestore, 'agendamentos'), (snapshot) => {
      this.fila = []; let total = 0; let aguardando = 0; let emAtendimento = 0; let atendidos = 0; let cancelados = 0;
      snapshot.forEach((doc) => { total++; const data = doc.data(); this.fila.push({ id: doc.id, ...data }); const s = (data['status'] || '').toLowerCase(); if (s === 'em atendimento') emAtendimento++; else if (s === 'compareceu' || s === 'atendido' || s === 'finalizado') atendidos++; else if (s === 'faltou' || s.includes('cancelad')) cancelados++; else aguardando++; });
      this.stats.totalAgendamentos = total; this.stats.aguardando = aguardando; this.stats.emAtendimento = emAtendimento; this.stats.atendidos = atendidos; this.stats.cancelados = cancelados;
    });

    this.unsubUsuarios = onSnapshot(collection(this.firestore, 'usuarios'), (snapshot) => {
      this.equipe = []; this.stats.totalPacientesCadastrados = 0; this.usuariosMap = {}; this.unidadesDisponiveis = [...this.unidadesPadrao];
      snapshot.forEach((doc) => {
        const data = doc.data(); this.usuariosMap[doc.id] = data;
        if (data['unidadeTrabalho'] && !this.unidadesDisponiveis.includes(data['unidadeTrabalho'])) { this.unidadesDisponiveis.push(data['unidadeTrabalho']); }
        if (data['cargo'] === 'paciente' || !data['cargo']) this.stats.totalPacientesCadastrados++;
        if (data['cargo'] && data['cargo'] !== 'paciente') this.equipe.push({ id: doc.id, ...data });
      });
      if (!this.novoStaff.unidadeTrabalho || !this.unidadesDisponiveis.includes(this.novoStaff.unidadeTrabalho)) { this.aoTrocarCargo(); }
    });

    this.unsubAvisos = onSnapshot(collection(this.firestore, 'avisos'), (snapshot) => {
      this.mural = []; const agora = new Date().toISOString();
      snapshot.forEach((doc) => { const aviso = doc.data(); if (!aviso['dataExpiracao'] || aviso['dataExpiracao'] > agora) { this.mural.push({ id: doc.id, ...aviso }); } });
      this.mural.sort((a, b) => (b.criadoEm > a.criadoEm ? 1 : -1));
    });

    this.unsubConfig = onSnapshot(collection(this.firestore, 'configuracoes'), (snapshot) => {
      this.listaUnidadesOficiais = []; this.listaEspecialidadesOficiais = []; this.listaAgendasOficiais = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data['tipo'] === 'unidade') this.listaUnidadesOficiais.push({ id: doc.id, ...data });
        if (data['tipo'] === 'especialidade') this.listaEspecialidadesOficiais.push({ id: doc.id, ...data });
        if (data['tipo'] === 'agenda') this.listaAgendasOficiais.push({ id: doc.id, ...data });
      });
    });
  }

  abrirModalRepasse(consultaCancelada: any) {
    this.vagaOriginal = consultaCancelada;
    this.statusNotificacao = {}; 
    
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() + 3);
    const dataCorteStr = dataCorte.toISOString().split('T')[0];

    this.pacientesSubstitutos = this.fila.filter(p => 
      (!p.status || p.status.toLowerCase() === 'confirmada' || p.status.toLowerCase() === 'aguardando') &&
      p.especialidade === consultaCancelada.especialidade &&
      p.unidade === consultaCancelada.unidade &&
      p.data >= dataCorteStr
    );

    this.pacientesSubstitutos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    this.dialog.open(this.modalRepasse, { width: '500px', panelClass: 'premium-dialog' });
  }

  getTelefone(p: any): string { if (p.telefone) return p.telefone; if (p.pacienteId && this.usuariosMap[p.pacienteId]) return this.usuariosMap[p.pacienteId].telefone || ''; return ''; }
  getEmail(p: any): string { if (p.email) return p.email; if (p.pacienteId && this.usuariosMap[p.pacienteId]) return this.usuariosMap[p.pacienteId].email || ''; return ''; }

  chamarNoWhatsApp(p: any) {
    this.statusNotificacao[p.id] = true; 
    const telefoneBruto = this.getTelefone(p);
    const telefone = telefoneBruto.replace(/\D/g, ''); 
    if (!telefone) { alert('Este paciente não tem telefone cadastrado.'); return; }
    
    const nome = this.getNome(p);
    const especialidade = this.vagaOriginal?.especialidade || p.especialidade;
    
    // FORMATANDO A DATA AQUI PRO ZAP!
    const dataVagaBruta = this.vagaOriginal?.data || this.dataHoje;
    const dataVaga = this.formatarDataBR(dataVagaBruta); 
    const horaVaga = this.vagaOriginal?.horario || 'um horário próximo';
    
    const msg = `Olá ${nome}, aqui é do SGA Saúde. Temos uma ótima notícia! Surgiu uma vaga de urgência para ${especialidade} no dia ${dataVaga} às ${horaVaga}. Como você já tem consulta marcada no futuro, gostaríamos de saber se deseja antecipar para esta nova vaga?`;
    window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  chamarNoEmail(p: any) {
    this.statusNotificacao[p.id] = true; 
    const email = this.getEmail(p);
    if (!email) { alert('Este paciente não tem e-mail cadastrado.'); return; }
    
    const nome = this.getNome(p);
    const especialidade = this.vagaOriginal?.especialidade || p.especialidade;
    
    // FORMATANDO A DATA AQUI PRO EMAIL!
    const dataVagaBruta = this.vagaOriginal?.data || this.dataHoje;
    const dataVaga = this.formatarDataBR(dataVagaBruta);
    
    const subject = `Antecipação de Consulta - SGA Saúde`;
    const body = `Olá ${nome},\n\nTemos uma ótima notícia! Surgiu uma vaga de urgência para ${especialidade} no dia ${dataVaga}.\n\nComo você está na nossa fila para datas futuras, estamos oferecendo a oportunidade de antecipar sua consulta. \n\nPor favor, responda este e-mail o mais rápido possível caso queira ficar com esta vaga antecipada.\n\nAtenciosamente,\nEquipe SGA Saúde`;
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  }

  async confirmarRepasseVaga(substituto: any) {
    const dataFormatada = this.formatarDataBR(this.vagaOriginal.data);
    if (confirm(`Confirmar que ${this.getNome(substituto)} aceitou a vaga do dia ${dataFormatada}?`)) {
      try {
        await updateDoc(doc(this.firestore, 'agendamentos', substituto.id), {
          data: this.vagaOriginal.data,
          horario: this.vagaOriginal.horario || 'Encaixe Extra'
        });
        await deleteDoc(doc(this.firestore, 'agendamentos', this.vagaOriginal.id));

        alert('✅ Vaga repassada e confirmada com sucesso!');
        this.dialog.closeAll(); 
      } catch (e) {
        console.error(e);
        alert('❌ Erro ao repassar a vaga no banco de dados.');
      }
    }
  }

  get stringGraficoPizza(): string { const total = this.stats.totalAgendamentos; if (total === 0) return 'conic-gradient(#e2e8f0 0% 100%)'; const pAtendidos = (this.stats.atendidos / total) * 100; const pEmAtendimento = (this.stats.emAtendimento / total) * 100; const pAguardando = (this.stats.aguardando / total) * 100; let acum = 0; const c1 = `#10b981 ${acum}% ${acum += pAtendidos}%`; const c2 = `#3b82f6 ${acum}% ${acum += pEmAtendimento}%`; const c3 = `#f59e0b ${acum}% ${acum += pAguardando}%`; const c4 = `#ef4444 ${acum}% 100%`; return `conic-gradient(${c1}, ${c2}, ${c3}, ${c4})`; }
  async salvarNovoAviso() { if (!this.novoAviso.titulo || !this.novoAviso.desc) return; this.criandoAviso = true; const dataCriacao = new Date(); const dataExpiracao = new Date(dataCriacao.getTime() + (this.novoAviso.validadeDias * 24 * 60 * 60 * 1000)); try { await addDoc(collection(this.firestore, 'avisos'), { titulo: this.novoAviso.titulo, desc: this.novoAviso.desc, icone: this.novoAviso.icone, cor: this.novoAviso.cor, criadoEm: dataCriacao.toISOString(), dataExpiracao: dataExpiracao.toISOString() }); this.novoAviso = { titulo: '', desc: '', icone: 'campaign', cor: '#3b82f6', validadeDias: 7 }; } catch (e) { console.error('Erro:', e); } this.criandoAviso = false; }
  async deletarAviso(id: string) { if(confirm('Excluir este aviso imediatamente?')) await deleteDoc(doc(this.firestore, 'avisos', id)); }
  diasParaExpirar(dataExp: string): string { if (!dataExp) return 'Sem validade'; const diffTime = Math.abs(new Date(dataExp).getTime() - new Date().getTime()); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); return diffDays === 1 ? 'Expira amanhã' : `Expira em ${diffDays} dias`; }
  aoTrocarCargo() { if (this.novoStaff.cargo === 'supremo') { this.novoStaff.unidadeTrabalho = 'Todas'; } else { if (this.novoStaff.unidadeTrabalho === 'Todas' || !this.novoStaff.unidadeTrabalho) { const unidadesReais = this.unidadesDisponiveis.filter(u => u !== 'Todas'); this.novoStaff.unidadeTrabalho = unidadesReais.length > 0 ? unidadesReais[0] : ''; } } }
  get equipeFiltrada() { return this.equipe.filter(membro => { if (this.nivelAcesso === 'supremo') return true; if (this.nivelAcesso === 'chefe') return membro.cargo === 'funcionario'; return false; }); }
  async salvarNovoStaff() { if (!this.novoStaff.nomeCompleto || !this.novoStaff.email) return; this.criandoStaff = true; try { await addDoc(collection(this.firestore, 'usuarios'), { nomeCompleto: this.novoStaff.nomeCompleto, email: this.novoStaff.email, cargo: this.novoStaff.cargo, unidadeTrabalho: this.nivelAcesso === 'chefe' ? this.minhaUnidadeSimulada : (this.novoStaff.unidadeTrabalho || 'Todas'), criadoEm: new Date().toISOString() }); this.novoStaff = { nomeCompleto: '', email: '', cargo: 'funcionario', unidadeTrabalho: 'Todas' }; this.aoTrocarCargo(); } catch (e) { console.error(e); } this.criandoStaff = false; }
  async removerStaff(id: string, cargo: string) { if (this.nivelAcesso === 'chefe' && cargo !== 'funcionario') { alert('Acesso Negado.'); return; } if (confirm('Revogar acesso?')) { await deleteDoc(doc(this.firestore, 'usuarios', id)); } }
  async adicionarConfiguracao(tipo: 'unidade' | 'especialidade') { const valor = tipo === 'unidade' ? this.novaConfigUnidade : this.novaConfigEspecialidade; if (!valor.trim()) return; try { await addDoc(collection(this.firestore, 'configuracoes'), { nome: valor.trim(), tipo: tipo, criadoEm: new Date().toISOString() }); if (tipo === 'unidade') this.novaConfigUnidade = ''; else this.novaConfigEspecialidade = ''; } catch (e) { console.error(e); } }
  async adicionarAgenda() { if (!this.novaAgendaUnidade || !this.novaAgendaEspecialidade || !this.novaAgendaHorarios) return; try { await addDoc(collection(this.firestore, 'configuracoes'), { tipo: 'agenda', unidade: this.novaAgendaUnidade, especialidade: this.novaAgendaEspecialidade, horariosDisponiveis: this.novaAgendaHorarios, vagasPorHora: this.novaAgendaVagas, criadoEm: new Date().toISOString() }); this.novaAgendaHorarios = '08:00, 09:00, 10:00, 11:00, 14:00, 15:00'; this.novaAgendaVagas = 1; } catch (e) { console.error("Erro ao criar agenda:", e); } }
  async deletarConfiguracao(id: string) { if (confirm('Deseja excluir esta opção do sistema?')) { await deleteDoc(doc(this.firestore, 'configuracoes', id)); } }

  podeVerEquipe(): boolean { return this.nivelAcesso === 'chefe' || this.nivelAcesso === 'supremo'; }
  podeAcionarEmergencia(): boolean { return this.nivelAcesso === 'chefe' || this.nivelAcesso === 'supremo'; }
  acionarProtocoloEmergencia() { if (this.podeAcionarEmergencia()) this.protocoloEmergenciaAtivo = !this.protocoloEmergenciaAtivo; }
  mudarNivel(nivel: 'funcionario' | 'chefe' | 'supremo') { this.nivelAcesso = nivel; if (nivel === 'chefe') { this.novoStaff.unidadeTrabalho = this.minhaUnidadeSimulada; } else { this.aoTrocarCargo(); } if (this.abaAtiva === 'equipe' && !this.podeVerEquipe()) this.abaAtiva = 'dashboard'; if (this.abaAtiva === 'config' && nivel !== 'supremo') this.abaAtiva = 'dashboard'; }
  sair() { this.router.navigate(['/login-teste']); }
}