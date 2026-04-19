import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, addDoc, doc, getDoc, getDocs, query, where, onSnapshot } from '@angular/fire/firestore';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-agendamento-teste',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatToolbarModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, FormsModule
  ],
  templateUrl: './agendamento-teste.html',
  styleUrl: './agendamento-teste.scss'
})
export class AgendamentoTesteComponent implements OnInit {
  usuario = { uid: '', nome: 'Paciente VIP', photoURL: '' };
  salvando = false;
  
  novaConsulta = { especialidade: '', unidade: '', data: '', horario: '' };

  especialidades: string[] = [];
  unidades: string[] = [];
  
  // AQUI É A MÁGICA: Agora os horários e vagas vêm dinâmicos do banco!
  configuracoesBanco: any[] = [];
  horariosDisponiveis: string[] = [];

  diasDisponiveis: any[] = [];
  mesesDisponiveis: string[] = []; 
  mesSelecionado: string = '';

  // VARIÁVEIS DO SISTEMA DE LOTAÇÃO
  vagasPorHoraAtual: number = 1; // Padrão seguro, mas vai ser atualizado pelo banco!
  agendamentosMarcados: any = {}; 

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);

  ngOnInit() {
    this.gerarProximosDias();
    this.carregarTudoDoBanco();

    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuario.uid = user.uid;
        await this.carregarMiniPerfil(user.uid);
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  // Puxa as Configurações (Unidades, Especialidades e AGENDAS VINCULADAS)
  carregarTudoDoBanco() {
    onSnapshot(collection(this.firestore, 'configuracoes'), (snapshot) => {
      const unids = new Set<string>();
      const especs = new Set<string>();
      this.configuracoesBanco = []; // Limpa pra não duplicar

      snapshot.forEach((doc) => {
        const data = doc.data();
        this.configuracoesBanco.push(data); // Salva tudo para usar depois!

        if (data['tipo'] === 'unidade' && data['nome']) unids.add(data['nome']);
        if (data['tipo'] === 'especialidade' && data['nome']) especs.add(data['nome']);
      });

      this.unidades = Array.from(unids).sort();
      this.especialidades = Array.from(especs).sort();
      
      if (this.unidades.length === 0) this.unidades = ['Aguardando liberação'];
      if (this.especialidades.length === 0) this.especialidades = ['Aguardando especialidades'];

      this.cdr.detectChanges();
    });
  }

  // A CORREÇÃO MASTER ESTÁ AQUI: Atualiza os horários e o LIMITE DE VAGAS lendo a Agenda do Admin!
  atualizarHorarios() {
    if (!this.novaConsulta.unidade || !this.novaConsulta.especialidade) {
       this.horariosDisponiveis = [];
       return;
    }

    // Busca na lista de configurações se o Admin criou uma "Agenda" para essa dupla (Unidade + Especialidade)
    const configAgenda = this.configuracoesBanco.find(c => 
       c.tipo === 'agenda' && 
       c.unidade === this.novaConsulta.unidade && 
       c.especialidade === this.novaConsulta.especialidade
    );

    if (configAgenda && configAgenda.horariosDisponiveis) {
        // Pega a string "08:00, 09:00" do banco, corta nas vírgulas, tira os espaços e ordena!
        this.horariosDisponiveis = configAgenda.horariosDisponiveis.split(',').map((h:string) => h.trim()).sort();
        
        // Puxa o limite de vagas exato que o Admin definiu (se der erro, assume 1)
        this.vagasPorHoraAtual = configAgenda.vagasPorHora || 1; 
        
        // Agora sim, vai no banco contar quantos agendamentos já tem!
        this.carregarOcupacaoDoBanco();
    } else {
        this.horariosDisponiveis = [];
        this.mostrarAviso('⚠️ Esta unidade ainda não atende essa especialidade.');
    }

    this.novaConsulta.horario = '';
    this.novaConsulta.data = ''; 
    this.cdr.detectChanges();
  }

  // O ESPIÃO DE LOTAÇÃO: Vai no banco e conta as vagas
  async carregarOcupacaoDoBanco() {
    try {
      const q = query(
        collection(this.firestore, 'agendamentos'),
        where('unidade', '==', this.novaConsulta.unidade),
        where('especialidade', '==', this.novaConsulta.especialidade)
      );
      
      const snapshot = await getDocs(q);
      this.agendamentosMarcados = {}; 

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // A CIRURGIA DE LIBERAR VAGA CANCELADA: Se a palavra 'cancelad' existir no status, IGNORA ELE!
        if ((data['status'] || '').toLowerCase().includes('cancelad')) return;

        if(!this.agendamentosMarcados[data['data']]) this.agendamentosMarcados[data['data']] = {};
        if(!this.agendamentosMarcados[data['data']][data['horario']]) this.agendamentosMarcados[data['data']][data['horario']] = 0;
        
        // Soma +1 pessoa marcando pra esse horário
        this.agendamentosMarcados[data['data']][data['horario']]++;
      });

      this.verificarDiasEsgotados();
      this.cdr.detectChanges();
    } catch (error) {
      console.error("Erro ao buscar agendamentos marcados: ", error);
    }
  }

  // PINTA O DIA DE VERMELHO SE TODOS OS HORÁRIOS ESTIVEREM CHEIOS
  verificarDiasEsgotados() {
    this.diasDisponiveis.forEach(dia => {
      dia.esgotado = this.horariosDisponiveis.length > 0 && this.horariosDisponiveis.every(hora => {
        const ocupados = this.agendamentosMarcados[dia.dataCompleta]?.[hora] || 0;
        return ocupados >= this.vagasPorHoraAtual;
      });
    });
  }

  // BLOQUEIA O BOTÃO DE HORÁRIO SE ESTIVER CHEIO
  isHorarioEsgotado(hora: string): boolean {
    if (!this.novaConsulta.data) return false;
    const ocupados = this.agendamentosMarcados[this.novaConsulta.data]?.[hora] || 0;
    return ocupados >= this.vagasPorHoraAtual;
  }

  gerarProximosDias() {
    const hoje = new Date();
    const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const feriadosNacionais = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'];

    let vagasAdicionadas = 0; let diaOffset = 0;

    while (vagasAdicionadas < 45) {
      const data = new Date(); data.setDate(hoje.getDate() + diaOffset); diaOffset++;
      if (data.getDay() === 0) continue; // Pula domingos

      const mesIndex = data.getMonth();
      const mesStr = (mesIndex + 1).toString().padStart(2, '0');
      const diaStr = data.getDate().toString().padStart(2, '0');
      
      if (feriadosNacionais.includes(`${mesStr}-${diaStr}`)) continue; 

      const nomeDoMes = nomesMeses[mesIndex];

      this.diasDisponiveis.push({
        dataCompleta: data.toISOString().split('T')[0], 
        diaMes: diaStr, diaSemana: diasDaSemana[data.getDay()], mesNome: nomeDoMes,
        esgotado: false 
      });

      if (!this.mesesDisponiveis.includes(nomeDoMes)) this.mesesDisponiveis.push(nomeDoMes);
      vagasAdicionadas++; 
    }
    if (this.mesesDisponiveis.length > 0) this.mesSelecionado = this.mesesDisponiveis[0];
  }

  getDiasDoMesSelecionado() { return this.diasDisponiveis.filter(d => d.mesNome === this.mesSelecionado); }

  async carregarMiniPerfil(uid: string) {
    try {
      const docSnap = await getDoc(doc(this.firestore, 'usuarios', uid));
      if (docSnap.exists()) {
        const data: any = docSnap.data();
        this.usuario.nome = data['nomeCompleto'] ? data['nomeCompleto'].split(' ')[0] : 'VIP';
        this.usuario.photoURL = data['photoURL'] || '';
      }
    } catch (e) { console.error(e); }
    this.cdr.detectChanges();
  }

  selecionarHorario(hora: string) { this.novaConsulta.horario = hora; }
  selecionarData(data: string) { 
    this.novaConsulta.data = data; 
    this.novaConsulta.horario = ''; // Reseta o horário pra forçar nova escolha
  }

  async confirmarAgendamento() {
    if (!this.novaConsulta.especialidade || !this.novaConsulta.unidade || !this.novaConsulta.data || !this.novaConsulta.horario) {
      this.mostrarAviso('⚠️ Preencha todos os campos do ticket!'); return;
    }
    
    // Trava de segurança final para impedir agendamento em horário lotado
    if (this.isHorarioEsgotado(this.novaConsulta.horario)) {
       this.mostrarAviso('❌ Este horário acabou de esgotar. Escolha outro.'); return;
    }

    this.salvando = true;
    try {
      const agendamentoData = {
        pacienteId: this.usuario.uid, 
        paciente: this.usuario.nome, 
        especialidade: this.novaConsulta.especialidade,
        unidade: this.novaConsulta.unidade, 
        data: this.novaConsulta.data,
        horario: this.novaConsulta.horario, 
        status: 'Confirmada', 
        criadoEm: new Date().toISOString()
      };
      
      await addDoc(collection(this.firestore, 'agendamentos'), agendamentoData);
      
      this.mostrarAviso('✅ Consulta agendada com sucesso!');
      setTimeout(() => { this.router.navigate(['/dashboard-teste']); }, 1500);
      
    } catch (error) { 
      console.error(error); 
      this.mostrarAviso('❌ Erro no banco de dados. Verifique sua conexão!'); 
      this.salvando = false; 
    }
  }

  mostrarAviso(mensagem: string) {
    this.snackBar.open(mensagem, 'OK', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['premium-snackbar'] });
  }
}