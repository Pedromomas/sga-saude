import { Component, AfterViewInit, OnDestroy } from '@angular/core';
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

  constructor(private auth: Auth, private firestore: Firestore, private router: Router) {}

  // --- INTERATIVIDADE JAVASCRIPT (Os detalhes bobos mágicos) ---
  ngAfterViewInit() {
    this.ativarEfeitoSombraCard();
    this.ativarEfeitoMagneticoBotao();
  }

  ngOnDestroy() {
    // Removemos os ouvintes para não pesar a memória
    document.removeEventListener('mousemove', this.mouseMoveHandler);
  }

  // Ouvinte do mouse salvo para remoção posterior
  private mouseMoveHandler: any;

  // 1. Sombra do Card que persegue o mouse
  private ativarEfeitoSombraCard() {
    const card = document.getElementById('cadastroCard');
    if (!card) return;

    this.mouseMoveHandler = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;

      const xOffset = (clientX - innerWidth / 2) / 40;
      const yOffset = (clientY - innerHeight / 2) / 40;

      card.style.boxShadow = `${xOffset}px ${yOffset}px 50px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.8)`;
    };

    document.addEventListener('mousemove', this.mouseMoveHandler);
  }

  // 2. Botão que persegue levemente o mouse (Efeito Magnético)
  private ativarEfeitoMagneticoBotao() {
    const btn = document.getElementById('btnFinalizar');
    if (!btn) return;

    btn.addEventListener('mousemove', (e: MouseEvent) => {
      const { x, y, width, height } = btn.getBoundingClientRect();
      const mx = e.clientX - (x + width / 2);
      const my = e.clientY - (y + height / 2);
      
      btn.style.transform = `translate(${mx * 0.2}px, ${my * 0.2}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = `translate(0px, 0px)`;
    });
  }

  // 3. Chuva de Confetes no Sucesso
  private dispararConfetes() {
    const container = document.getElementById('confettiEffect');
    if (!container) return;

    container.classList.add('active');
    
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'absolute';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      
      const colors = ['#2563eb', '#60a5fa', '#10b981', '#f59e0b', '#ef4444'];
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.top = Math.random() * -20 + 'px';
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      confetti.style.animation = `confettiFall ${Math.random() * 2 + 1}s linear forwards`;
      confetti.style.opacity = (Math.random() * 0.5 + 0.5).toString();

      container.appendChild(confetti);
    }
  }

  // --- LÓGICA DO FORMULÁRIO ---
  
  toggleSenha() { this.mostrarSenha = !this.mostrarSenha; }

  // 4. Força da senha visual
  getForcaSenha(): string {
    if (!this.senha) return '';
    if (this.senha.length < 6) return 'weak';
    if (this.senha.length < 10) return 'medium';
    return 'strong';
  }

  // 5. Máscaras Dinâmicas Visuais (CPF e Telefone)
  formatarCPF(event: string) {
    let valor = event.replace(/\D/g, '');
    if (valor.length <= 11) {
      this.cpf = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '\$1.\$2.\$3-\$4');
    }
  }

  formatarTelefone(event: string) {
    let valor = event.replace(/\D/g, '');
    if (valor.length === 11) {
      this.telefone = valor.replace(/(\d{2})(\d{5})(\d{4})/g, '(\$1) \$2-\$3');
    } else if (valor.length === 10) {
      this.telefone = valor.replace(/(\d{2})(\d{4})(\d{4})/g, '(\$1) \$2-\$3');
    } else {
      this.telefone = valor;
    }
  }

  // Busca CEP Automatizada ViaCEP
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

  // Cadastro Seguro no Firebase (Integrado ao Banco Antigo)
  async cadastrar() {
    this.erro = ''; this.mensagemSucesso = '';
    const cpfLimpo = this.cpf.replace(/\D/g, '');
    
    // Validações simples
    if (!this.nome || cpfLimpo.length !== 11 || !this.email || this.senha.length < 6 || !this.numero) {
      this.erro = 'Revise os campos. Nome completo, CPF válido e senha forte são obrigatórios.';
      return;
    }

    this.isLoading = true;

    try {
      // 1. Auth: Criar login
      const cred = await createUserWithEmailAndPassword(this.auth, this.email, this.senha);
      
      // Limpar as máscaras para salvar só os números (igual ao banco antigo)
      const telefoneLimpo = this.telefone.replace(/\D/g, ''); 
      const cepLimpo = this.cep.replace(/\D/g, '');

      // 2. Firestore: Salvar dados com a EXATA estrutura do usuário antigo
      await setDoc(doc(this.firestore, 'usuarios', cred.user.uid), {
        nomeCompleto: this.nome,             
        cpf: cpfLimpo,
        cns: this.cartaoSus || '',           
        telefone: telefoneLimpo,
        email: this.email,
        
        // Endereço no padrão antigo
        cep: cepLimpo,
        endereco: this.rua,                  
        numero: this.numero,
        
        // Campos de sistema do banco antigo
        criadoEm: new Date().toLocaleString('pt-BR'), 
        cargo: 'paciente',                   
        unidadeTrabalho: 'Nenhuma',          
        photoURL: '',                        
        
        // Bônus: Mantemos a data de nascimento e os dados extras de endereço
        // caso você precise melhorar o sistema no futuro sem quebrar nada agora
        dataNascimento: this.dataNascimento,
        bairro: this.bairro,
        cidade: this.cidade,
        uf: this.uf
      });

      // MÁGICA FINAL: Confetes e Sucesso
      this.dispararConfetes();
      this.mensagemSucesso = 'Conta criada com sucesso! O Portal SUS te dá as boas-vindas.';
      
      setTimeout(() => {
        this.router.navigate(['/dashboard-teste']);
      }, 2500);

    } catch (e: any) {
      this.isLoading = false;
      if (e.code === 'auth/email-already-in-use') { this.erro = 'Este e-mail já possui cadastro.'; }
      else { this.erro = 'Erro desconhecido no Firebase.'; }
    }
  }

  voltarParaLogin() { this.router.navigate(['/login-teste']); }
}