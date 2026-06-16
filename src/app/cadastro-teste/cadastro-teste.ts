import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-cadastro-teste',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './cadastro-teste.html',
  styleUrls: ['./cadastro-teste.scss']
})
export class CadastroTesteComponent implements AfterViewInit, OnDestroy {
  // Dados do Formulário
  nome = ''; cpf = ''; dataNascimento = ''; telefone = ''; cartaoSus = '';
  cep = ''; rua = ''; numero = ''; bairro = ''; cidade = ''; uf = '';
  email = ''; senha = '';

  // Controles da Tela
  erro = ''; mensagemSucesso = ''; isLoading = false; buscandoCep = false; mostrarSenha = false;

  // Variáveis para o LERP (60/120 FPS Fluid Animations)
  private mouseX = window.innerWidth / 2;
  private mouseY = window.innerHeight / 2;
  private cardShadowX = 0; private cardShadowY = 0;
  private btnPosX = 0; private btnPosY = 0;
  private btnTargetX = 0; private btnTargetY = 0;
  private animationFrameId!: number;
  private mouseMoveHandler: any;

  constructor(
    private auth: Auth, 
    private firestore: Firestore, 
    private router: Router,
    private cdr: ChangeDetectorRef // Adicionado para forçar a tela a mostrar o erro rápido
  ) {}

  ngAfterViewInit() {
    this.iniciarMotoresGpu();
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  private iniciarMotoresGpu() {
    const card = document.getElementById('cadastroCard');
    const btn = document.getElementById('btnFinalizar');

    this.mouseMoveHandler = (e: MouseEvent) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      if (btn) {
        const rect = btn.getBoundingClientRect();
        if (e.clientX > rect.left - 50 && e.clientX < rect.right + 50 && e.clientY > rect.top - 50 && e.clientY < rect.bottom + 50) {
          this.btnTargetX = (e.clientX - (rect.left + rect.width / 2)) * 0.3;
          this.btnTargetY = (e.clientY - (rect.top + rect.height / 2)) * 0.3;
        } else {
          this.btnTargetX = 0;
          this.btnTargetY = 0;
        }
      }
    };
    document.addEventListener('mousemove', this.mouseMoveHandler);

    const renderLoop = () => {
      const targetShadowX = (this.mouseX - window.innerWidth / 2) / 40;
      const targetShadowY = (this.mouseY - window.innerHeight / 2) / 40;
      this.cardShadowX += (targetShadowX - this.cardShadowX) * 0.05;
      this.cardShadowY += (targetShadowY - this.cardShadowY) * 0.05;

      if (card) { card.style.boxShadow = `${this.cardShadowX}px ${this.cardShadowY}px 50px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)`; }

      this.btnPosX += (this.btnTargetX - this.btnPosX) * 0.1;
      this.btnPosY += (this.btnTargetY - this.btnPosY) * 0.1;

      if (btn && !this.isLoading) { btn.style.transform = `translate3d(${this.btnPosX}px, ${this.btnPosY}px, 0)`; }
      this.animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }

  private dispararConfetes() {
    const container = document.getElementById('confettiEffect');
    if (!container) return;
    container.classList.add('active');
    const colors = ['#2563eb', '#60a5fa', '#10b981', '#f59e0b', '#ef4444'];
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'absolute';
      confetti.style.width = '8px'; confetti.style.height = '8px';
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = Math.random() * 100 + 'vw'; confetti.style.top = '-20px';
      confetti.style.animation = `confettiFall ${Math.random() * 2 + 1.5}s linear forwards`;
      confetti.style.opacity = (Math.random() * 0.5 + 0.5).toString();
      fragment.appendChild(confetti);
    }
    container.appendChild(fragment);
  }

  toggleSenha() { this.mostrarSenha = !this.mostrarSenha; }

  getForcaSenha(): string {
    if (!this.senha) return '';
    if (this.senha.length < 6) return 'weak';
    if (this.senha.length < 10) return 'medium';
    return 'strong';
  }

  formatarCPF(event: string) {
    let valor = event.replace(/\D/g, '');
    if (valor.length <= 11) { this.cpf = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '\$1.\$2.\$3-\$4'); }
  }

  formatarTelefone(event: string) {
    let valor = event.replace(/\D/g, '');
    if (valor.length === 11) { this.telefone = valor.replace(/(\d{2})(\d{5})(\d{4})/g, '(\$1) \$2-\$3'); } 
    else if (valor.length === 10) { this.telefone = valor.replace(/(\d{2})(\d{4})(\d{4})/g, '(\$1) \$2-\$3'); } 
    else { this.telefone = valor; }
  }

  async buscarCep() {
    this.buscandoCep = true;
    const cepLimpo = this.cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          this.rua = data.logradouro; this.bairro = data.bairro; this.cidade = data.localidade; this.uf = data.uf;
          this.erro = '';
        } else { this.erro = 'CEP inválido.'; this.rua = ''; }
      } catch (e) { this.erro = 'Erro ao conectar no ViaCEP.'; }
    }
    this.buscandoCep = false;
  }

  async cadastrar() {
    this.erro = ''; this.mensagemSucesso = '';
    
    // Tratamento de espaços acidentais no email
    this.email = this.email.trim();
    const cpfLimpo = this.cpf.replace(/\D/g, '');
    
    // Validações bem específicas para você saber exatamente o que faltou digitar
    if (!this.nome || this.nome.length < 5) { this.erro = 'Digite o nome completo (mín. 5 letras).'; return; }
    if (cpfLimpo.length !== 11) { this.erro = 'Digite um CPF válido com 11 números.'; return; }
    if (!this.dataNascimento) { this.erro = 'Preencha a data de nascimento.'; return; }
    if (!this.email || !this.email.includes('@')) { this.erro = 'Digite um e-mail válido com @.'; return; }
    if (!this.senha || this.senha.length < 6) { this.erro = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    if (!this.cep || !this.rua || !this.numero) { this.erro = 'Preencha o CEP e o Número do seu endereço.'; return; }

    this.isLoading = true;
    this.cdr.detectChanges(); // Força a tela a atualizar e mostrar o loading

    try {
      const cred = await createUserWithEmailAndPassword(this.auth, this.email, this.senha);
      
      const telefoneLimpo = this.telefone.replace(/\D/g, ''); 
      const cepLimpo = this.cep.replace(/\D/g, '');

      await setDoc(doc(this.firestore, 'usuarios', cred.user.uid), {
        nomeCompleto: this.nome,             
        cpf: cpfLimpo,
        cns: this.cartaoSus || '',           
        telefone: telefoneLimpo,
        email: this.email,
        cep: cepLimpo,
        endereco: this.rua,                  
        numero: this.numero,
        criadoEm: new Date().toLocaleString('pt-BR'), 
        cargo: 'paciente',                   
        unidadeTrabalho: 'Nenhuma',          
        photoURL: '',                        
        dataNascimento: this.dataNascimento,
        bairro: this.bairro,
        cidade: this.cidade,
        uf: this.uf
      });

      this.dispararConfetes();
      this.mensagemSucesso = 'Conta criada com sucesso! Redirecionando...';
      this.cdr.detectChanges();
      
      setTimeout(() => {
        this.router.navigate(['/dashboard-teste']);
      }, 2000);

    } catch (e: any) {
      console.error(e);
      // 🔥 AQUI O CÓDIGO TE AVISA SE VOCÊ ESQUECEU DE APAGAR O AUTH DO FIREBASE 🔥
      if (e.code === 'auth/email-already-in-use') { 
        this.erro = 'Este e-mail já existe no Firebase Authentication. Exclua a conta lá também!'; 
      } else if (e.code === 'auth/invalid-email') {
        this.erro = 'Formato de e-mail inválido.';
      } else { 
        this.erro = 'Erro de conexão com o banco. Tente novamente.'; 
      }
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  voltarParaLogin() { this.router.navigate(['/login-teste']); }
}