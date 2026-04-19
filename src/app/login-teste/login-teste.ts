import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, sendPasswordResetEmail } from '@angular/fire/auth';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login-teste',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './login-teste.html',
  styleUrls: ['./login-teste.scss']
})
export class LoginTesteComponent {
  email = '';
  senha = '';
  erro = '';
  mensagemSucesso = '';
  isLoading = false;
  mostrarSenha = false;

  constructor(private auth: Auth, private router: Router) {}

  async logar() {
    if (!this.email || !this.senha) {
      this.erro = 'Ei, preencha todos os campos para continuar.';
      this.mensagemSucesso = '';
      return;
    }
    this.isLoading = true;
    this.erro = '';
    this.mensagemSucesso = '';
    
    try {
      await signInWithEmailAndPassword(this.auth, this.email, this.senha);
      // 👇 AQUI TÁ A MÁGICA: Mudei para dashboard-teste
      this.router.navigate(['/dashboard-teste']); 
    } catch (e) {
      this.erro = 'Credenciais incorretas. Tente novamente!';
      this.isLoading = false;
    }
  }

  toggleSenha() {
    this.mostrarSenha = !this.mostrarSenha;
  }

  async recuperarSenha() {
    if (!this.email) {
      this.erro = 'Digite seu e-mail no campo acima e clique em Esqueceu a senha.';
      this.mensagemSucesso = '';
      return;
    }

    this.isLoading = true;
    this.erro = '';
    this.mensagemSucesso = '';

    try {
      await sendPasswordResetEmail(this.auth, this.email);
      this.mensagemSucesso = 'E-mail de recuperação enviado! Olhe sua caixa de entrada.';
      this.isLoading = false;
    } catch (e: any) {
      this.isLoading = false;
      this.erro = 'Erro ao enviar. Verifique se o e-mail está correto ou se você já tem cadastro.';
    }
  }

  irParaCadastro() {
    this.router.navigate(['/cadastro']);
  }
}