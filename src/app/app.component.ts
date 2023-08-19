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
  debugObj = { debugText: '', possibles: [] };
  title = 'chess-trainer';
  field = [
    [[new ChessPieceDto('black', 'rook')], [new ChessPieceDto('black', 'knight')], [new ChessPieceDto('black', 'bishop')], [new ChessPieceDto('black', 'queen')], [new ChessPieceDto('black', 'king')], [new ChessPieceDto('black', 'bishop')], [new ChessPieceDto('black', 'knight')], [new ChessPieceDto('black', 'rook')]],
    [[new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')]],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')]],
    [[new ChessPieceDto('white', 'rook')], [new ChessPieceDto('white', 'knight')], [new ChessPieceDto('white', 'bishop')], [new ChessPieceDto('white', 'queen')], [new ChessPieceDto('white', 'king')], [new ChessPieceDto('white', 'bishop')], [new ChessPieceDto('white', 'knight')], [new ChessPieceDto('white', 'rook')]]
  ];

  ngAfterViewInit(): void {
    if (this.dropListElements) {
      setTimeout(() => {
        this.dropLists = this.dropListElements.toArray();
        window['field'] = this.field;
        window['debugObj'] = this.debugObj;
      }, 0);
    }
  }

  canDrop(drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean {
    let targetObj = null;
    let targetPiece = null;
    let targetColor = null;
    if (drop && drop.data && drop.data[0]) {
      targetObj = drop.data[0];
      targetColor = targetObj.color;
      targetPiece = targetObj.piece;
    }
    const targetLoc = drop.id;
    const targetLocSplit = targetLoc.split('field');
    const targetRow = Number(targetLocSplit[1][0]);
    const targetCell = Number(targetLocSplit[1][1]);
    const sourceLocation = drag.dropContainer.id;
    let sourceObj = null;
    let sourcePiece = null;
    let sourceColor = null;
    const sourceLocSplit = sourceLocation.split('field');
    const sourceRow = Number(sourceLocSplit[1][0]);
    const sourceCell = Number(sourceLocSplit[1][1]);
    if (window['field']) {
      sourceObj = window['field'][sourceRow][sourceCell];
      if (sourceObj && sourceObj[0]) {
        sourceColor = sourceObj[0].color;
        sourcePiece = sourceObj[0].piece;
      }
    }
    let canDrop = drop.data.length < 1;
    switch (sourcePiece) {
      case 'pawn': {
        const stepY = targetRow - sourceRow;
        const targetDirectionStep = sourceColor === 'white' ? -1 : 1;
        const homeRow = sourceColor === 'white' ? 6 : 1;
        const homeRowStep = sourceColor === 'white' ? -2 : 2;
        const sameColumn = targetCell === sourceCell;
        if (!sameColumn || !((stepY === targetDirectionStep) || (sourceRow == homeRow && stepY === homeRowStep))) {
          canDrop = false;
        }
        break;
      }
      case 'knight': {
        const stepX = Math.abs(targetCell - sourceCell);
        const stepY = Math.abs(targetRow - sourceRow);
        if (!(stepX === 2 && stepY === 1) && !(stepX === 1 && stepY === 2)) {
          canDrop = false;
        }
        break;
      }
      case 'king': {
        if (Math.abs(targetCell - sourceCell) > 1) {
          canDrop = false;
        }
        if (Math.abs(targetRow - sourceRow) > 1) {
          canDrop = false;
        }
        break;
      }
      case 'queen': {
        if (Math.abs(targetCell - sourceCell) !== Math.abs(targetRow - sourceRow) && targetCell !== sourceCell && targetRow !== sourceRow) {
          canDrop = false;
        }
        break;
      }
      case 'rook': {
        if (targetCell !== sourceCell && targetRow !== sourceRow) {
          canDrop = false;
        }
        break;
      }
      case 'bishop': {
        if (Math.abs(targetCell - sourceCell) !== Math.abs(targetRow - sourceRow)) {
          canDrop = false;
        }
        break;
      }
      default:
        break;
    }
    if (window['debugObj'] && canDrop) {
      // window['debugObj'].debugText += `source c${sourceCell}r${sourceRow}`
      const letterChar = String.fromCharCode('a'.charCodeAt(0) + targetCell);
      const numberChar = (8 - targetRow);
      if (!window['debugObj'].possibles) {
        window['debugObj'].possibles = [];
      }
      window['debugObj'].possibles.push(targetLoc)
    }
    return canDrop;
  }

  onDrop(event: CdkDragDrop<ChessPieceDto[]>) {
    window['debugObj'].debugText = '';
    window['debugObj'].possibles = [];
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

  isTarget(id: string) {
    return this.debugObj.possibles && this.debugObj.possibles.includes(id);
  }

  translate(idxX: number, idxY: number) {
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + idxY);
    const numberChar = (8 - idxX);
    return `${letterChar}${numberChar}`
  }
}
