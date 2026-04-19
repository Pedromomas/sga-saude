import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { Auth, signInWithEmailAndPassword, sendPasswordResetEmail } from '@angular/fire/auth'; // <-- RECUPERAÇÃO DE SENHA ADICIONADA

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatButtonModule, MatIconModule, RouterModule, MatSnackBarModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  emailDigitado = '';
  senhaDigitada = '';

  private auth = inject(Auth);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  mostrarAviso(mensagem: string) {
    this.snackBar.open(mensagem, 'OK', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  async fazerLogin() {
    if (!this.emailDigitado || !this.senhaDigitada) {
      this.mostrarAviso('⚠️ Por favor, preencha seu e-mail e senha!');
      return;
    }

    try {
      await signInWithEmailAndPassword(this.auth, this.emailDigitado, this.senhaDigitada);
      
      // Lógica simples para direcionar o Admin ou o Paciente
      if (this.emailDigitado === 'admin@admin.com') { // Troque pelo e-mail do seu admin se for diferente
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/dashboard']);
      }
      
    } catch (erro: any) {
      console.error('Erro no login:', erro);
      this.mostrarAviso('❌ E-mail ou senha incorretos! Tente novamente.'); // SUBSTITUIU O ALERT
    }
  }

  // A MÁGICA DA RECUPERAÇÃO DE SENHA
  async esqueciSenha() {
    if (!this.emailDigitado) {
      this.mostrarAviso('⚠️ Digite o seu e-mail no campo acima e clique em "Esqueci minha senha".');
      return;
    }

    try {
      await sendPasswordResetEmail(this.auth, this.emailDigitado);
      this.mostrarAviso('📧 E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (erro) {
      console.error('Erro ao resetar senha:', erro);
      this.mostrarAviso('❌ Erro. Verifique se o e-mail digitado está correto.');
    }
  }
}