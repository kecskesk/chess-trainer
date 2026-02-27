import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ChessPieceComponent } from './components/chess-piece/chess-piece.component';
import { ChessRulesService } from './services/chess-rules.service';
import { GlobalVariablesService } from './services/global-variables.service';
import { ChessBoardComponent } from './components/chess-board/chess-board.component';
import { ChessBoardValidationService } from './services/chess-board-validation.service';
import { ChessGameLoggerService } from './services/chess-game-logger.service';
import { ChessBoardAnalysisService } from './services/chess-board-analysis.service';


@NgModule({
  declarations: [
    AppComponent,
    ChessBoardComponent,
    ChessPieceComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    DragDropModule
  ],
  providers: [
    ChessRulesService,
    GlobalVariablesService,
    ChessBoardValidationService,
    ChessGameLoggerService,
    ChessBoardAnalysisService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
