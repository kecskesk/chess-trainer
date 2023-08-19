import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ChessPieceComponent } from './components/chess-piece/chess-piece.component';
import { ChessRulesService } from './services/chess-rules.service';
import { DebugObjectService } from './services/debug-object.service';
import { ChessBoardComponent } from './components/chess-board/chess-board.component';


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
    DebugObjectService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
