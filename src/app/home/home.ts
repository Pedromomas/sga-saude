import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  
  // ✨ Frases ajustadas: removido o foco mobile, mantendo a métrica perfeita
  frasesDestaque = [
    'em Tempo Real.',
    'sem Burocracia.',
    'Totalmente Segura.'
  ];
  fraseAtual = this.frasesDestaque[0];
  animarTexto = false;
  private intervaloVisual: any;

  isScrolled = false;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  ngOnInit() {
    this.iniciarRotacaoDeTexto();
  }

  ngOnDestroy() {
    if (this.intervaloVisual) clearInterval(this.intervaloVisual);
  }

  iniciarRotacaoDeTexto() {
    let index = 0;
    this.intervaloVisual = setInterval(() => {
      this.animarTexto = true; 
      setTimeout(() => {
        index = (index + 1) % this.frasesDestaque.length;
        this.fraseAtual = this.frasesDestaque[index]; 
        this.animarTexto = false; 
      }, 400); 
    }, 3500); 
  }

  rolarParaServicos() {
    document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}