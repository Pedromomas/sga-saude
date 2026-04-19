import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Component, inject, OnInit, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
// 🔥 Adicionei o 'deleteDoc' aqui na linha debaixo
import { Firestore, collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatToolbarModule, MatButtonModule, MatIconModule,
    MatCardModule, MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule,
    MatFormFieldModule, MatInputModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  nomeUsuario = '';
  loadingNome = true;
  meusAgendamentos: any[] = [];
  avisosDoMural: any[] = [];

  @ViewChild('modalCancelamento') modalCancelamento!: TemplateRef<any>;
  idConsultaSelecionada = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        await this.carregarPerfil(user.uid);
        await this.carregarAgendamentos(user.uid);
        await this.carregarAvisos();
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  async carregarPerfil(uid: string) {
    try {
      const docSnap = await getDoc(doc(this.firestore, 'usuarios', uid));
      if (docSnap.exists()) {
        this.nomeUsuario = docSnap.data()['nomeCompleto'].split(' ')[0];
      }
    } catch (e) { console.error(e); }
    this.loadingNome = false;
    this.cdr.detectChanges();
  }

  async carregarAgendamentos(uid: string) {
    try {
      const q = query(collection(this.firestore, 'agendamentos'), where('pacienteId', '==', uid));
      const querySnapshot = await getDocs(q);
      this.meusAgendamentos = [];
      querySnapshot.forEach((doc) => {
        this.meusAgendamentos.push({ id: doc.id, ...doc.data() });
      });
      // Ordena para as mais recentes ficarem no topo, se quiser
      // this.meusAgendamentos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      this.cdr.detectChanges();
    } catch (e) { console.error(e); }
  }

  async carregarAvisos() {
    try {
      const querySnapshot = await getDocs(collection(this.firestore, 'avisos'));
      this.avisosDoMural = [];
      querySnapshot.forEach((doc) => {
        this.avisosDoMural.push({ id: doc.id, ...doc.data() });
      });
      this.cdr.detectChanges();
    } catch (e) { console.error("Erro ao carregar o mural:", e); }
  }
  
  abrirModalDeCancelamento(idDaConsulta: string) {
    this.idConsultaSelecionada = idDaConsulta;
    this.dialog.open(this.modalCancelamento, { width: '400px', disableClose: true });
  }

  async confirmarCancelamento() {
     this.dialog.closeAll();
     try {
        await updateDoc(doc(this.firestore, 'agendamentos', this.idConsultaSelecionada), { status: 'Cancelada' });
        this.snackBar.open('✅ Vaga cancelada com sucesso!', 'OK', { duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom' });
        const user = this.auth.currentUser;
        if(user) this.carregarAgendamentos(user.uid);
     } catch(e) { 
        this.snackBar.open('❌ Erro ao cancelar a vaga.', 'OK', { duration: 3000 });
     }
  }

  // 🔥 NOVA FUNÇÃO: DELETAR DO HISTÓRICO
  async excluirConsulta(idDaConsulta: string) {
    try {
      await deleteDoc(doc(this.firestore, 'agendamentos', idDaConsulta));
      this.snackBar.open('🗑️ Consulta removida do histórico!', 'OK', { duration: 3000 });
      const user = this.auth.currentUser;
      if(user) this.carregarAgendamentos(user.uid); // Recarrega a lista
    } catch(e) {
      this.snackBar.open('❌ Erro ao remover do histórico.', 'OK', { duration: 3000 });
    }
  }

  reagendarConsulta(id: string) {
    this.snackBar.open('📅 Redirecionando para o calendário de reagendamento...', 'OK', { duration: 3000 });
  }

  verPreparo(id: string) {
    this.snackBar.open('📋 Baixando orientações de preparo (Jejum, etc)...', 'OK', { duration: 4000 });
  }

  // (Mantenha as outras funções vazias para os outros botões...)
}
