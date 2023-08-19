import { Component } from '@angular/core';
import { ChessPieceDto } from './model/chess-piece.dto';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent {
  title = 'chess-trainer';
  whites = [
    new ChessPieceDto('white', 'rook'),
    new ChessPieceDto('white', 'pawn'),
    new ChessPieceDto('white', 'pawn'),
    new ChessPieceDto('white', 'queen')
  ];
  blacks = [
    new ChessPieceDto('black', 'knight'),
    new ChessPieceDto('black', 'pawn'),
    new ChessPieceDto('black', 'king'),
    new ChessPieceDto('black', 'queen')
  ];

  canDrop(item: CdkDrag<ChessPieceDto[]>, list: CdkDropList<ChessPieceDto[]>): boolean {
    return list.data.length < 5;
  }

  onDrop(event: CdkDragDrop<ChessPieceDto[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data,
        event.previousIndex,
        event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data,
        event.container.data,
        event.previousIndex, event.currentIndex);
    }
  }
}
