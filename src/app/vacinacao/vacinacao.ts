import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc, query, where } from '@angular/fire/firestore';
// 🔥 IMPORTAÇÃO DO SIGNOUT DO FIREBASE 🔥
import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth';

export interface Vacina {
  id?: string;
  nome: string;
  dataAplicacao: string;
  dose: string;
  status: 'concluida' | 'pendente' | 'atrasada';
  unidade: string;
}

@Component({
  selector: 'app-vacinacao',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterModule, MatToolbarModule, MatButtonModule, FormsModule],
  templateUrl: './vacinacao.html',
  styleUrls: ['./vacinacao.scss']
})
export class VacinacaoComponent implements OnInit {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  nomeUsuario: string = 'Carregando...';
  photoURL: string = '';
  dataNascimentoPaciente: string = '';
  idadePaciente: number = 0;
  loadingNome = true;
  saudacao = 'Olá';
  dataAtual = new Date().toLocaleDateString('pt-BR'); 

  termoBusca: string = '';
  mostrarResultados: boolean = false;
  mostrarNotificacoes: boolean = false;
  resultadosBusca: any[] = [];
  avisosDoMural: any[] = [];
  isScrolled = false;
  
  mapaDoSistema = [
    { titulo: 'Meu Perfil', rota: '/perfil-teste', icone: 'manage_accounts', tags: ['perfil', 'conta', 'dados'] },
    { titulo: 'Novo Agendamento', rota: '/agendamento-teste', icone: 'add_task', tags: ['agendar', 'nova consulta'] },
    { titulo: 'Dashboard', rota: '/dashboard-teste', icone: 'dashboard', tags: ['inicio', 'home'] }
  ];

  minhasVacinas: Vacina[] = [];
  carregandoVacinas = true;
  totalDoses = 0;
  pendentes = 0;
  concluidas = 0;
  statusGeral = 'Carregando...';
  porcentagem = 0;

  ngOnInit() {
    this.definirSaudacao();
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        await this.carregarPerfil(user.uid);
        await this.carregarVacinasInteligentes(user.uid);
        await this.carregarAvisos();
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
    } catch (e) {
      console.error('Erro ao deslogar:', e);
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
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

  async carregarVacinasInteligentes(uid: string) {
    try {
      this.carregandoVacinas = true;
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
              id: 'virtual_' + regra['nome'],
              nome: regra['nome'],
              dataAplicacao: dataLimite ? `Até ${this.formatarDataBRTabela(dataLimite)}` : 'Campanha Contínua',
              dose: 'A Definir no Posto',
              status: statusVirtual,
              unidade: 'Procure uma Unidade Oficial'
            });
          }
        }
      });

      const pesos = { atrasada: 1, pendente: 2, concluida: 3 };
      vacinasFinais.sort((a, b) => pesos[a.status] - pesos[b.status]);

      this.minhasVacinas = vacinasFinais;

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

    } catch (e) { 
      console.error("Erro ao carregar vacinas:", e); 
    } finally {
      this.carregandoVacinas = false;
      this.cdr.detectChanges();
    }
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

  definirSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) this.saudacao = 'Bom dia';
    else if (hora >= 12 && hora < 18) this.saudacao = 'Boa tarde';
    else this.saudacao = 'Boa noite';
  }

  buscarNoSistema() {
    const busca = this.termoBusca.toLowerCase().trim();
    if (!busca) { this.resultadosBusca = []; this.mostrarResultados = false; return; }
    this.resultadosBusca = this.mapaDoSistema.filter(item => item.titulo.toLowerCase().includes(busca) || item.tags.some(tag => tag.includes(busca)));
    this.mostrarResultados = this.resultadosBusca.length > 0;
  }

  fecharBusca() { setTimeout(() => { this.mostrarResultados = false; }, 200); }
  irParaRota(rota: string) { this.termoBusca = ''; this.mostrarResultados = false; this.router.navigate([rota]); }
  toggleNotificacoes() { this.mostrarNotificacoes = !this.mostrarNotificacoes; }

  formatarDataBRTabela(texto: string): string {
    if (!texto) return 'Data não definida';
    if (texto.includes('Até') || texto.includes('Campanha')) return texto;
    const partes = texto.split('-');
    if (partes.length !== 3) return texto;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  gerarPDF() {
    window.print();
  }
}