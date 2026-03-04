import { APP_INITIALIZER, enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { buildInfo } from './environments/build-info';
import { provideHttpClient } from '@angular/common/http';
import { ChessRulesService } from './app/services/chess-rules.service';
import { ChessBoardStateService } from './app/services/chess-board-state.service';
import { provideRouter } from '@angular/router';
import { routes } from './app/app-routing.module';
import { UiTextLoaderService } from './app/services/ui-text-loader.service';

if (environment.production) {
  enableProdMode();
}

// eslint-disable-next-line no-console
console.log(`[chess-trainer] last build: ${buildInfo.builtAtIso} | commit: ${buildInfo.commitHash}`);

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
