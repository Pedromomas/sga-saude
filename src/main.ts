import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app'; // <-- Trocamos para o nome exato da classe!

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));