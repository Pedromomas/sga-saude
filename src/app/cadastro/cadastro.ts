import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth'; 
import { Firestore, doc, setDoc } from '@angular/fire/firestore'; 

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // <-- NOVA FERRAMENTA AQUI

@Component({
  selector: 'app-cadastro',
  imports: [
    FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatButtonModule, MatIconModule, RouterModule, MatSnackBarModule
  ],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.scss'
})
export class Cadastro {
  nomeDigitado = '';
  cpfDigitado = '';     
  telefoneDigitado = '';
  cnsDigitado = '';
  cepDigitado = '';
  enderecoDigitado = '';
  numeroDigitado = '';
  emailDigitado = '';
  senhaDigitada = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar); // <-- INJETADO

  // A FUNÇÃO DO AVISO BONITO
  mostrarAviso(mensagem: string) {
    this.snackBar.open(mensagem, 'OK', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  async buscarCep() {
    const cep = this.cepDigitado.replace(/\D/g, ''); 
    if (cep.length !== 8) return;

    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resposta.json();

      if (!dados.erro) {
        this.enderecoDigitado = dados.logradouro;
      } else {
        this.mostrarAviso('📍 CEP não encontrado!');
      }
    } catch (erro) {
      console.error('Erro na API ViaCEP:', erro);
    }
  }

  validarCPF(cpf: string) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
  }

  async criarConta() {
    if (!this.validarCPF(this.cpfDigitado)) {
      this.mostrarAviso('❌ CPF inválido! Por favor, confira os números.'); // SUBSTITUIU O ALERT
      return;
    }

    if (!this.nomeDigitado || !this.emailDigitado || !this.senhaDigitada || !this.cepDigitado) {
      this.mostrarAviso('⚠️ Preencha os campos obrigatórios!'); // SUBSTITUIU O ALERT
      return;
    }

    try {
      const credencial = await createUserWithEmailAndPassword(this.auth, this.emailDigitado, this.senhaDigitada);
      const usuario = credencial.user;

      const docPerfil = doc(this.firestore, 'usuarios', usuario.uid);
      await setDoc(docPerfil, {
        nomeCompleto: this.nomeDigitado,
        cpf: this.cpfDigitado,
        telefone: this.telefoneDigitado,
        cns: this.cnsDigitado,
        cep: this.cepDigitado,
        endereco: this.enderecoDigitado,
        numero: this.numeroDigitado,
        email: this.emailDigitado,
        criadoEm: new Date()
      });

      this.mostrarAviso('✅ Conta criada com sucesso!'); // SUBSTITUIU O ALERT
      this.router.navigate(['/dashboard']);

    } catch (erro: any) {
      console.error('Erro ao cadastrar:', erro);
      this.mostrarAviso('❌ Erro ao criar conta. O e-mail já pode estar em uso ou a senha é muito fraca.'); // SUBSTITUIU O ALERT
    }
  }
}