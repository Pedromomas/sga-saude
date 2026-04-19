import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Procura a pulseira VIP
  const usuarioLogado = localStorage.getItem('user_token'); 

  if (usuarioLogado) {
    return true; // Deixa passar
  } else {
    router.navigate(['/login']); // Chuta pro login
    return false;
  }
};