import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { provideHttpClient } from '@angular/common/http';
import { ChessRulesService } from './app/services/chess-rules.service';
import { ChessBoardStateService } from './app/services/chess-board-state.service';
import { provideRouter } from '@angular/router';
import { routes } from './app/app-routing.module';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    ChessRulesService,
    ChessBoardStateService
  ]
}).catch(err => console.error(err));
