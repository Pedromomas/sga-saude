import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Auth, signInWithEmailAndPassword, sendPasswordResetEmail } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-login-teste',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, RouterModule],
  templateUrl: './login-teste.html',
  styleUrls: ['./login-teste.scss']
})
export class LoginTesteComponent {
  email = '';
  senha = '';
  mostrarSenha = false;
  isLoading = false;
  erro = '';
  mensagemSucesso = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  // 🔥 A MÁGICA: O detector de mudanças forçadas do Angular 🔥
  private cdr = inject(ChangeDetectorRef); 

  toggleSenha() {
    this.mostrarSenha = !this.mostrarSenha;
  }

  async logar() {
    // Tira os espaços em branco que o celular às vezes coloca sozinho
    this.email = this.email.trim();

    if (!this.email || !this.senha) {
      this.erro = 'Por favor, preencha o e-mail e a senha!';
      return;
    }

    // Validação instantânea de formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.erro = 'Formato de e-mail inválido. Verifique a digitação.';
      return;
    }

    this.isLoading = true;
    this.erro = '';
    this.mensagemSucesso = '';
    this.cdr.detectChanges(); // Força a tela a mostrar o spinner AGORA

    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, this.email, this.senha);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(this.firestore, 'usuarios', user.uid));
      
      this.mensagemSucesso = 'Autenticado com sucesso! Entrando...';
      this.cdr.detectChanges();

      setTimeout(() => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData['cargo'] && userData['cargo'] !== 'paciente') {
             this.router.navigate(['/admin-teste']);
          } else {
             this.router.navigate(['/dashboard-teste']);
          }
        } else {
          this.router.navigate(['/dashboard-teste']);
        }
      }, 400);

    } catch (error: any) {
      console.error('Erro de login detalhado:', error);
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        this.erro = 'E-mail ou senha incorretos.';
      } else if (error.code === 'auth/too-many-requests') {
        this.erro = 'Muitas tentativas incorretas. Tente novamente mais tarde.';
      } else if (error.code === 'auth/network-request-failed') {
        this.erro = 'Sem conexão com a internet. Verifique sua rede.';
      } else {
        this.erro = 'Erro no servidor. Tente novamente em instantes.';
      }
    } finally {
      // 🔥 A CURA DO BUG: O finally executa de qualquer jeito, dando erro ou sucesso! 🔥
      this.isLoading = false;
      this.cdr.detectChanges(); // Avisa a tela pra esconder o spinner imediatamente
    }
  }

  async recuperarSenha() {
    this.email = this.email.trim();

    if (!this.email) {
      this.erro = 'Digite seu e-mail acima para recuperar a senha.';
      return;
    }

    this.isLoading = true;
    this.erro = '';
    this.mensagemSucesso = '';
    this.cdr.detectChanges();

    try {
      await sendPasswordResetEmail(this.auth, this.email);
      this.mensagemSucesso = 'E-mail de recuperação enviado! Verifique sua caixa de entrada.';
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
        this.erro = 'E-mail não encontrado no sistema.';
      } else {
        this.erro = 'Erro ao enviar e-mail de recuperação.';
      }
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
}