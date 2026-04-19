import { Component, inject, OnInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core'; 
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { Firestore, collection, addDoc, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore'; 
import { Auth } from '@angular/fire/auth'; 

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select'; 
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; 
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-agendamento',
  imports: [
    FormsModule, RouterModule, MatProgressSpinnerModule,
    MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule, 
    MatFormFieldModule, MatSelectModule, MatInputModule, MatSnackBarModule,
    MatDatepickerModule, MatNativeDateModule
  ],
  templateUrl: './agendamento.html',
  styleUrl: './agendamento.scss',
  encapsulation: ViewEncapsulation.None // <-- ISSO AQUI PERMITE PINTAR O CALENDÁRIO!
})
export class Agendamento implements OnInit {
  unidadeSelecionada = '';
  especialidadeSelecionada = '';
  
  dataSelecionada: Date | null = null; 
  dataMinima: Date = new Date(); 
  
  horarioSelecionado = ''; 
  horariosDaUnidade: string[] = []; 
  carregandoHorarios = false;

  private firestore = inject(Firestore);
  private auth = inject(Auth); 
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  // 📅 LISTA DE FERIADOS (Pode adicionar os feriados do Rio de Janeiro aqui)
  feriados = [
    '2026-04-21', // Tiradentes
    '2026-05-01', // Dia do Trabalho
    '2026-09-07', // Independência do Brasil
    '2026-10-12', // Nossa Senhora Aparecida
    '2026-11-02', // Finados
    '2026-11-15', // Proclamação da República
    '2026-12-25'  // Natal
  ];

  ngOnInit() { }

  converterDataParaTexto(d: Date): string {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  // 🔥 REGRA 1: BLOQUEIA FINAIS DE SEMANA E FERIADOS
  filtroDiasUteis = (d: Date | null): boolean => {
    const data = d || new Date();
    const diaSemana = data.getDay();
    
    // 0 = Domingo, 6 = Sábado
    if (diaSemana === 0 || diaSemana === 6) {
      return false; 
    }

    // Verifica se a data cai num feriado da nossa lista
    const dataFormatada = this.converterDataParaTexto(data);
    if (this.feriados.includes(dataFormatada)) {
      return false; // Bloqueia!
    }

    return true; // Se não for sábado, domingo nem feriado, LIBERA!
  };

  // 🔥 REGRA 2: PINTA DE AZUL OS DIAS DISPONÍVEIS
  marcarDiasAzuis = (d: Date): string => {
    // Só pinta de azul se a unidade e especialidade já estiverem selecionadas
    if (this.unidadeSelecionada && this.especialidadeSelecionada) {
      // Se passar no filtro (for dia útil), ganha a classe CSS 'dia-livre-azul'
      if (this.filtroDiasUteis(d)) {
        return 'dia-livre-azul';
      }
    }
    return '';
  };

  async buscarConfiguracaoUnidade() {
    if (!this.unidadeSelecionada || !this.especialidadeSelecionada) {
      this.horariosDaUnidade = []; 
      return;
    }
    
    this.carregandoHorarios = true;
    
    try {
      // 1. Verifica primeiro se a Unidade está em Emergência
      const idEmergencia = `${this.unidadeSelecionada}_Geral`;
      const docEmergencia = await getDoc(doc(this.firestore, 'configuracoes', idEmergencia));
      
      if (docEmergencia.exists() && docEmergencia.data()['statusUnidade'] === 'Emergência') {
        this.mostrarAviso(`🚨 A unidade ${this.unidadeSelecionada} está temporariamente fechada por motivos de força maior.`);
        this.resetarBusca();
        this.carregandoHorarios = false;
        return; // TRAVA TUDO
      }

      // 2. Se estiver tudo OK, busca a regra normal (o código que você já tinha...)
      const idRegra = `${this.unidadeSelecionada}_${this.especialidadeSelecionada}`;
      const docRef = doc(this.firestore, 'configuracoes', idRegra);
      const snapshot = await getDoc(docRef);
      // ... resto do seu código
      
      if (snapshot.exists()) {
        const dados = snapshot.data();
        this.horariosDaUnidade = dados['horariosDisponiveis'].split(',').map((h: string) => h.trim());
      } else {
        this.mostrarAviso(`⚠️ Nenhuma regra de horário definida para ${this.especialidadeSelecionada} nesta unidade.`);
      }
    } catch (erro) {
      console.error("Erro ao buscar config:", erro);
    } finally {
      this.carregandoHorarios = false;
      this.cdr.detectChanges();
    }
  }

  async buscarHorariosLivreNoDia() {
    if (!this.unidadeSelecionada || !this.especialidadeSelecionada || !this.dataSelecionada) {
      this.horariosDaUnidade = [];
      return;
    }
    
    this.carregandoHorarios = true;
    this.horarioSelecionado = '';
    
    try {
      const idRegra = `${this.unidadeSelecionada}_${this.especialidadeSelecionada}`;
      const docRef = doc(this.firestore, 'configuracoes', idRegra);
      const snapshotConfig = await getDoc(docRef);
      
      if (!snapshotConfig.exists()) {
        this.mostrarAviso(`⚠️ O Posto não configurou horários para ${this.especialidadeSelecionada}.`);
        this.horariosDaUnidade = [];
        this.carregandoHorarios = false;
        return;
      }

      const dadosAdmin = snapshotConfig.data();
      const todosHorariosDoAdmin = dadosAdmin['horariosDisponiveis'].split(',').map((h: string) => h.trim());
      const limitePorHora = dadosAdmin['vagasPorHora'] || 2;

      const dataTexto = this.converterDataParaTexto(this.dataSelecionada);
      const colecaoAgendamentos = collection(this.firestore, 'agendamentos');
      
      const buscaOcupados = query(
        colecaoAgendamentos,
        where('unidade', '==', this.unidadeSelecionada),
        where('especialidade', '==', this.especialidadeSelecionada),
        where('data', '==', dataTexto),
        where('status', 'in', ['Confirmada', 'Aguardando Confirmação'])
      );

      const snapshotVagas = await getDocs(buscaOcupados);

      const contagemDeVagas: any = {};
      snapshotVagas.forEach(doc => {
        const horaOcupada = doc.data()['horario'];
        contagemDeVagas[horaOcupada] = (contagemDeVagas[horaOcupada] || 0) + 1;
      });

      this.horariosDaUnidade = todosHorariosDoAdmin.filter((hora: string) => {
        const ocupadas = contagemDeVagas[hora] || 0;
        return ocupadas < limitePorHora;
      });

      if (this.horariosDaUnidade.length === 0) {
        this.mostrarAviso('⚠️ Todas as vagas para este dia estão esgotadas. Selecione outro dia!');
      }

    } catch (erro) {
      this.mostrarAviso('❌ Erro de conexão ao buscar os horários.');
    } finally {
      this.carregandoHorarios = false;
      this.cdr.detectChanges();
    }
  }

  resetarBusca() {
    this.dataSelecionada = null;
    this.horariosDaUnidade = [];
    this.horarioSelecionado = '';
    this.buscarConfiguracaoUnidade();
  }

  mostrarAviso(mensagem: string) {
    this.snackBar.open(mensagem, 'OK', { duration: 5000, horizontalPosition: 'center', verticalPosition: 'bottom' });
  }

  async salvarAgendamento() {
    if (!this.unidadeSelecionada || !this.especialidadeSelecionada || !this.dataSelecionada || !this.horarioSelecionado) {
      return this.mostrarAviso('⚠️ Por favor, preencha todos os passos do funil!');
    }

    const usuarioLogado = this.auth.currentUser;
    if (!usuarioLogado) return;

    try {
      const dataTexto = this.converterDataParaTexto(this.dataSelecionada);

      await addDoc(collection(this.firestore, 'agendamentos'), {
        pacienteId: usuarioLogado.uid, 
        unidade: this.unidadeSelecionada,
        especialidade: this.especialidadeSelecionada,
        data: dataTexto,
        horario: this.horarioSelecionado, 
        status: 'Confirmada',
        criadoEm: new Date()
      });

      this.mostrarAviso('✅ Consulta agendada com sucesso!');
      this.router.navigate(['/dashboard']);

    } catch (erro) {
      this.mostrarAviso('❌ Erro ao salvar agendamento no sistema.');
    }
  }
}