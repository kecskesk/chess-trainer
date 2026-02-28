import { APP_INITIALIZER, enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { provideHttpClient } from '@angular/common/http';
import { ChessRulesService } from './app/services/chess-rules.service';
import { ChessBoardStateService } from './app/services/chess-board-state.service';
import { provideRouter } from '@angular/router';
import { routes } from './app/app-routing.module';
import { UiTextLoaderService } from './app/services/ui-text-loader.service';

if (environment.production) {
  enableProdMode();
}

function initializeUiText(uiTextLoaderService: UiTextLoaderService): () => Promise<void> {
  return () => uiTextLoaderService.initialize();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    ChessRulesService,
    ChessBoardStateService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUiText,
      deps: [UiTextLoaderService],
      multi: true
    }
  ]
}).catch(err => console.error(err));
