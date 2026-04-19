import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore'; 
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; 

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-perfil',
  imports: [
    MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule, 
    MatProgressSpinnerModule, RouterModule, FormsModule, MatFormFieldModule, MatInputModule
  ],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss'
})
export class Perfil implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  dadosUsuario: any = null;
  dadosEditados: any = {}; 
  carregando = true;
  editando = false; 

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(this.firestore, 'usuarios', user.uid);
          const snapshot = await getDoc(docRef);
          
          if (snapshot.exists()) {
            this.dadosUsuario = snapshot.data();
            this.dadosEditados = { ...this.dadosUsuario }; 
          }
        } catch (erro) {
          console.error('Erro ao buscar perfil:', erro);
        } finally {
          this.carregando = false;
          this.cdr.detectChanges();
        }
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  habilitarEdicao() {
    this.editando = true;
    this.cdr.detectChanges(); // <-- ACORDA O ANGULAR PRA MOSTRAR O FORMULÁRIO!
  }

  cancelarEdicao() {
    this.dadosEditados = { ...this.dadosUsuario }; 
    this.editando = false;
    this.cdr.detectChanges(); // <-- ACORDA O ANGULAR PRA VOLTAR PRA CARTEIRINHA!
  }

  async salvarEdicao() {
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(this.firestore, 'usuarios', user.uid);
      
      await updateDoc(docRef, {
        nomeCompleto: this.dadosEditados.nomeCompleto || '',
        cpf: this.dadosEditados.cpf || '',
        telefone: this.dadosEditados.telefone || '',
        cns: this.dadosEditados.cns || '',
        cep: this.dadosEditados.cep || '',
        endereco: this.dadosEditados.endereco || '',
        numero: this.dadosEditados.numero || ''
      });

      this.dadosUsuario = { ...this.dadosEditados };
      this.editando = false;
      this.cdr.detectChanges(); // <-- ACORDA O ANGULAR PRA ATUALIZAR OS DADOS SALVOS!
      alert('Perfil atualizado com sucesso!');
      
    } catch (erro) {
      console.error('Erro ao salvar:', erro);
      alert('Erro ao atualizar os dados.');
    }
  }
}