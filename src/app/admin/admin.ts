import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core'; 
import { Firestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc, setDoc, query, where } from '@angular/fire/firestore'; 
import { Auth, onAuthStateChanged, createUserWithEmailAndPassword } from '@angular/fire/auth'; 
import { FormsModule } from '@angular/forms'; 

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router'; 
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; 
import { MatTabsModule } from '@angular/material/tabs'; 
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; 

@Component({
  selector: 'app-admin',
  imports: [
    MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule, RouterModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatTabsModule, FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class Admin implements OnInit {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);
  private zone = inject(NgZone); 
  
  carregandoPerfil = true;
  carregandoConsultas = false; 
  meuPerfilAdmin: any = null; 
  filtroUnidadeSupremo = 'Todas'; 

  todasConsultas: any[] = [];
  todosAvisos: any[] = []; 

  configRegra = {
    unidade: 'Posto de Saúde - Bangu',
    especialidade: 'Clínica Geral',
    vagasPorHora: 5,
    horariosDisponiveis: '08:00, 09:00, 10:00, 14:00, 15:00',
    statusUnidade: 'Operacional' 
  };

  novoAviso = { titulo: '', mensagem: '', tipo: 'alerta' };
  novoMembro = { nome: '', email: '', senha: '', cargo: '', unidade: '' };

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        await this.verificarCargo(user.uid);
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  async verificarCargo(uid: string) {
    try {
      const docUser = await getDoc(doc(this.firestore, 'usuarios', uid));
      if (docUser.exists()) {
        const dados: any = docUser.data(); 
        
        if (!dados['cargo'] || dados['cargo'] === 'paciente') {
          this.snackBar.open('Acesso Negado. Área restrita.', 'OK', { duration: 3000 });
          this.router.navigate(['/dashboard']);
          return;
        }

        this.meuPerfilAdmin = { id: uid, ...dados };
        
        if (this.meuPerfilAdmin.cargo !== 'supremo') {
           this.configRegra.unidade = this.meuPerfilAdmin.unidadeTrabalho;
        }

        this.carregarTodasConsultas();
        this.carregarAvisos();
      }
    } catch (erro) {
      console.error("Erro ao verificar cargo:", erro);
    } finally {
      this.zone.run(() => {
        this.carregandoPerfil = false;
        this.cdr.detectChanges();
      });
    }
  }

  mostrarNotificacao(mensagem: string, duracao: number = 5000) {
    this.zone.run(() => {
      this.snackBar.open(mensagem, 'OK', { duration: duracao, horizontalPosition: 'center', verticalPosition: 'bottom' });
    });
  }

  async carregarTodasConsultas() {
    this.zone.run(() => {
      this.carregandoConsultas = true;
      this.cdr.detectChanges(); 
    });

    try {
      const colecaoAgendamentos = collection(this.firestore, 'agendamentos');
      let buscaRef: any = colecaoAgendamentos; 

      if (this.meuPerfilAdmin.cargo !== 'supremo') {
        buscaRef = query(colecaoAgendamentos, where('unidade', '==', this.meuPerfilAdmin.unidadeTrabalho));
      } 
      else if (this.meuPerfilAdmin.cargo === 'supremo' && this.filtroUnidadeSupremo !== 'Todas') {
        buscaRef = query(colecaoAgendamentos, where('unidade', '==', this.filtroUnidadeSupremo));
      }

      const snapshot = await getDocs(buscaRef);
      const cacheUsuarios: any = {}; 

      const promessasDeConsultas = snapshot.docs.map(async (documento) => {
        const dados: any = documento.data();  
        let infoPaciente = { nome: 'Paciente Desconhecido', endereco: 'Não informado', cep: '---' };
        
        if (dados['pacienteId']) {
          const idDoPaciente = dados['pacienteId'];
          
          if (!cacheUsuarios[idDoPaciente]) {
            const docUsuario = await getDoc(doc(this.firestore, 'usuarios', idDoPaciente));
            cacheUsuarios[idDoPaciente] = docUsuario.exists() ? docUsuario.data() : null;
          }

          const u: any = cacheUsuarios[idDoPaciente]; 
          if (u) {
            infoPaciente = { nome: u['nomeCompleto'], endereco: `${u['endereco']}, ${u['numero']}`, cep: u['cep'] };
          }
        }
        return { id: documento.id, infoPaciente, ...dados };
      });

      const resultadosFinalizados = await Promise.all(promessasDeConsultas);
      
      this.zone.run(() => {
        this.todasConsultas = resultadosFinalizados;
        this.carregandoConsultas = false;
        this.cdr.detectChanges();
      });

    } catch (erro) { 
      console.error(erro); 
      this.zone.run(() => {
        this.carregandoConsultas = false;
        this.cdr.detectChanges();
      });
    } 
  }

  async chamarPaciente(idConsulta: string) {
    try {
      await updateDoc(doc(this.firestore, 'agendamentos', idConsulta), { status: 'Em Atendimento' });
      this.mostrarNotificacao('📢 Paciente chamado para atendimento!');
      this.carregarTodasConsultas(); 
    } catch (erro) { console.error('Erro:', erro); }
  }

  async acionarModoEmergencia() {
    const confirmacao = confirm(`🚨 ATENÇÃO: Você deseja CANCELAR TODAS as consultas de hoje para a unidade ${this.configRegra.unidade}?`);
    if (!confirmacao) return;

    try {
      const hoje = new Date().toISOString().split('T')[0];
      const q = query(collection(this.firestore, 'agendamentos'), where('unidade', '==', this.configRegra.unidade), where('data', '==', hoje), where('status', '==', 'Confirmada'));

      const snapshot = await getDocs(q);
      if (snapshot.empty) return this.mostrarNotificacao('ℹ️ Nenhuma consulta agendada para hoje nesta unidade.');

      for (const d of snapshot.docs) {
        await updateDoc(doc(this.firestore, 'agendamentos', d.id), { status: 'Cancelada (Emergência)' });
      }

      const idRegra = `${this.configRegra.unidade}_Geral`; 
      await setDoc(doc(this.firestore, 'configuracoes', idRegra), { ...this.configRegra, statusUnidade: 'Emergência' }, { merge: true });

      this.mostrarNotificacao(`🚨 EMERGÊNCIA ATIVADA! ${snapshot.size} consultas canceladas.`, 10000);
      this.carregarTodasConsultas();
    } catch (erro) {
      console.error(erro);
      this.mostrarNotificacao('❌ Erro ao processar cancelamento em massa.');
    }
  }

  async repassarVaga(consulta: any) {
    try {
      const snapshotUsuarios = await getDocs(collection(this.firestore, 'usuarios'));
      let pacienteSubstituto: any = null;
      const regiaoCep = consulta.infoPaciente.cep.substring(0, 5); 

      for (const docUser of snapshotUsuarios.docs) {
        const dadosUser: any = docUser.data(); 
        if (docUser.id !== consulta.pacienteId && dadosUser['cep']?.startsWith(regiaoCep)) {
          pacienteSubstituto = { id: docUser.id, ...dadosUser };
          break; 
        }
      }

      if (pacienteSubstituto) {
        await updateDoc(doc(this.firestore, 'agendamentos', consulta.id), { pacienteId: pacienteSubstituto.id, status: 'Aguardando Confirmação' });
        this.mostrarNotificacao(`📩 CONVITE ENVIADO! SMS para (${pacienteSubstituto.telefone}).`, 8000);
        this.carregarTodasConsultas(); 
      }
    } catch (erro) { console.error(erro); }
  }

  async salvarConfiguracao() {
    const idRegra = `${this.configRegra.unidade}_${this.configRegra.especialidade}`;
    await setDoc(doc(this.firestore, 'configuracoes', idRegra), this.configRegra);
    this.mostrarNotificacao(`⚙️ Configurações salvas para ${this.configRegra.unidade}`);
  }

  async carregarAvisos() {
    const snapshot = await getDocs(collection(this.firestore, 'avisos'));
    const mural: any[] = []; // 🔥 MUDANÇA AQUI: Agora ele sabe que é um array do tipo "any"
    snapshot.forEach(doc => mural.push({ id: doc.id, ...(doc.data() as any) })); 
    
    this.zone.run(() => {
      this.todosAvisos = mural;
      this.cdr.detectChanges();
    });
  }

  async publicarAviso() {
    await addDoc(collection(this.firestore, 'avisos'), { ...this.novoAviso, criadoEm: new Date() });
    this.mostrarNotificacao('✅ Aviso publicado!');
    
    this.zone.run(() => {
      this.novoAviso = { titulo: '', mensagem: '', tipo: 'alerta' }; 
    });
    
    this.carregarAvisos(); 
  }

  async excluirAviso(idAviso: string) {
    await deleteDoc(doc(this.firestore, 'avisos', idAviso));
    this.carregarAvisos();
  }

  async cadastrarMembroEquipe() {
    if (!this.novoMembro.nome || !this.novoMembro.email || !this.novoMembro.senha || !this.novoMembro.cargo) {
      return this.mostrarNotificacao('⚠️ Preencha todos os dados do novo funcionário!');
    }

    if (this.meuPerfilAdmin.cargo === 'chefe') {
      this.novoMembro.unidade = this.meuPerfilAdmin.unidadeTrabalho;
    } else if (!this.novoMembro.unidade) {
      return this.mostrarNotificacao('⚠️ Supremo, você precisa escolher a unidade deste funcionário!');
    }

    try {
      const credencial = await createUserWithEmailAndPassword(this.auth, this.novoMembro.email, this.novoMembro.senha);
      const novoUser = credencial.user;

      await setDoc(doc(this.firestore, 'usuarios', novoUser.uid), {
        nomeCompleto: this.novoMembro.nome,
        email: this.novoMembro.email,
        cargo: this.novoMembro.cargo,
        unidadeTrabalho: this.novoMembro.unidade,
        criadoEm: new Date()
      });

      this.mostrarNotificacao('✅ Conta de Admin criada com sucesso! Por segurança, o sistema vai te deslogar.', 8000);
      
      this.zone.run(() => {
        this.novoMembro = { nome: '', email: '', senha: '', cargo: '', unidade: '' };
        this.router.navigate(['/login']);
      });

    } catch (erro: any) {
      console.error(erro);
      this.mostrarNotificacao('❌ Erro ao criar conta. A senha deve ter 6+ letras ou o email já existe.');
    }
  }
}