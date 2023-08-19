import { AfterViewInit, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ChessPieceDto } from './model/chess-piece.dto';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent implements AfterViewInit {
  @ViewChild('chessField') chessField: ElementRef;
  @ViewChildren(CdkDropList) dropListElements: QueryList<CdkDropList>;

  dropLists: CdkDropList[] = undefined;
  title = 'chess-trainer';
  field = [
    [[new ChessPieceDto('white', 'pawn')], [], [], [], [], [], [], []],
    [[], [], [], [new ChessPieceDto('white', 'pawn')], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[new ChessPieceDto('white', 'pawn')], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []]
  ];

  ngAfterViewInit(): void {
    if (this.dropListElements) {
      setTimeout(() => {
        this.dropLists = this.dropListElements.toArray();
      }, 0);
    }
  }

  canDrop(item: CdkDrag<ChessPieceDto[]>, list: CdkDropList<ChessPieceDto[]>): boolean {
    return list.data.length < 2;
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
