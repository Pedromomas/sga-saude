import { Component, inject, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
// 🔥 APAGAMOS O STORAGE DAQUI! NÃO VAMOS MAIS PRECISAR DELE!

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-perfil-teste',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatToolbarModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, FormsModule
  ],
  templateUrl: './perfil-teste.html',
  styleUrl: './perfil-teste.scss'
})
export class PerfilTesteComponent implements OnInit {
  loading = true;
  salvando = false;
  uploadingPhoto = false;

  usuario = {
    uid: '',
    nomeCompleto: '',
    email: '',
    telefone: '',
    cpf: '',
    dataNascimento: '',
    cep: '',
    photoURL: ''
  };

  @ViewChild('fileInput') fileInput!: ElementRef;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuario.uid = user.uid;
        this.usuario.email = user.email || '';
        await this.carregarPerfil(user.uid);
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  async carregarPerfil(uid: string) {
    try {
      const docSnap = await getDoc(doc(this.firestore, 'usuarios', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.usuario.nomeCompleto = data['nomeCompleto'] || '';
        this.usuario.telefone = data['telefone'] || '';
        this.usuario.cpf = data['cpf'] || '';
        this.usuario.dataNascimento = data['dataNascimento'] || '';
        this.usuario.cep = data['cep'] || '';
        this.usuario.photoURL = data['photoURL'] || '';
      }
    } catch (e) {
      console.error("Erro ao carregar perfil:", e);
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  // 🔥 NOVA LÓGICA: Transforma a foto em texto e salva de graça no Firestore!
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file || !this.usuario.uid) return;

    this.uploadingPhoto = true;
    this.cdr.detectChanges();

    try {
      // 1. Chama a função que espreme a imagem e transforma em TEXTO (Base64)
      const imagemComoTexto = await this.comprimirParaBase64(file);

      // 2. Salva o texto gigante direto no documento do usuário (junto com o nome dele)
      await updateDoc(doc(this.firestore, 'usuarios', this.usuario.uid), {
        photoURL: imagemComoTexto
      });

      // 3. Atualiza na tela
      this.usuario.photoURL = imagemComoTexto;
      this.mostrarAviso('⚡ Foto salva com sucesso (Sem cartão de crédito!)');
    } catch (e) {
      console.error(e);
      this.mostrarAviso('❌ Erro ao enviar a foto.');
    } finally {
      this.uploadingPhoto = false;
      this.cdr.detectChanges();
    }
  }

  // 🪄 O MOTOR DE COMPRESSÃO (Agora devolve um Texto DataURL)
  private comprimirParaBase64(file: File, maxSize: number = 400): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: any) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) { height *= maxSize / width; width = maxSize; }
          } else {
            if (height > maxSize) { width *= maxSize / height; height = maxSize; }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // 🔥 A MÁGICA TÁ AQUI: Isso converte o desenho em um texto tipo "data:image/webp;base64,iVBORw0KG..."
            resolve(canvas.toDataURL('image/webp', 0.8));
          } else {
            reject(new Error('Erro no Canvas'));
          }
        };
      };
      reader.onerror = error => reject(error);
    });
  }

  async salvarPerfil() {
    if (!this.usuario.uid) return;
    this.salvando = true;
    
    try {
      await updateDoc(doc(this.firestore, 'usuarios', this.usuario.uid), {
        nomeCompleto: this.usuario.nomeCompleto,
        telefone: this.usuario.telefone,
        dataNascimento: this.usuario.dataNascimento,
        cep: this.usuario.cep
      });
      
      this.mostrarAviso('✨ Perfil atualizado com sucesso!');
    } catch (e) {
      this.mostrarAviso('❌ Erro ao salvar dados.');
    }
    
    this.salvando = false;
    this.cdr.detectChanges();
  }

  mostrarAviso(mensagem: string) {
    this.snackBar.open(mensagem, 'OK', { 
      duration: 4000, 
      horizontalPosition: 'center', 
      verticalPosition: 'bottom',
      panelClass: ['premium-snackbar']
    });
  }

  get primeiroNome() {
    return this.usuario.nomeCompleto ? this.usuario.nomeCompleto.split(' ')[0] : 'VIP';
  }
}