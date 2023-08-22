import { AfterViewInit, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, transferArrayItem } from '@angular/cdk/drag-drop';
import { ChessPieceDto } from 'src/app/model/chess-piece.dto';
import { GlobalVariablesService } from '../../services/global-variables.service';
import { ChessRulesService } from '../../services/chess-rules.service';
import { DomSanitizer, SafeScript, SafeStyle } from '@angular/platform-browser';

@Component({
  selector: 'app-chess-board',
  templateUrl: './chess-board.component.html',
  styleUrls: ['./chess-board.component.less']
})
export class ChessBoardComponent implements AfterViewInit {
  @ViewChild('chessField') chessField: ElementRef;
  @ViewChildren(CdkDropList) dropListElements: QueryList<CdkDropList>;

  dropLists: CdkDropList[] = undefined;

  constructor(public globalVariablesService: GlobalVariablesService,
              private sanitizer: DomSanitizer) {}

  ngAfterViewInit(): void {
    if (this.dropListElements) {
      setTimeout(() => {
        this.dropLists = this.dropListElements.toArray();
      }, 0);
    }
  }

  canDrop(drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean {

    const targetLocSplit = drop.id.split('field');
    const targetRow = Number(targetLocSplit[1][0]);
    const targetCol = Number(targetLocSplit[1][1]);
    const sourceLocSplit = drag.dropContainer.id.split('field');
    const sourceRow = Number(sourceLocSplit[1][0]);
    const sourceCol = Number(sourceLocSplit[1][1]);

    return ChessRulesService.canStepThere(targetRow, targetCol, drop.data ,sourceRow, sourceCol);
  }

  onDrop(event: CdkDragDrop<ChessPieceDto[]>): void {
    // Reset drops and hits
    this.globalVariablesService.boardHelper.debugText = '';
    this.globalVariablesService.boardHelper.possibles = {};
    this.globalVariablesService.boardHelper.hits = {};
    this.globalVariablesService.boardHelper.checks = {};
    this.globalVariablesService.boardHelper.arrows = {};
    if (event.previousContainer === event.container) {
      return;
    } else {
      const targetId = event.container.id;
      const targetLocSplit = targetId.split('field');
      const targetRow = Number(targetLocSplit[1][0]);
      const targetCell = Number(targetLocSplit[1][1]);

      const srcId = event.previousContainer.id;
      const srcLocSplit = srcId.split('field');
      const srcRow = Number(srcLocSplit[1][0]);
      const srcCell = Number(srcLocSplit[1][1]);
      const srcPiece = event.previousContainer.data[0].piece;
      if (srcPiece === 'pawn' && targetRow === 0) {
        this.globalVariablesService.boardHelper.canPromote = targetCell;
      }

      let isHit = false;
      let isCheck = false;
      let isMatch = false;
      let isEP = false;
      let castleData = null;
      // Remove target on hit before moving the item in the container
      if (event.container && event.container.data && event.container.data[0]) {
        this.globalVariablesService.field[targetRow][targetCell].splice(0,1);
        isHit = true;
      }
      const justDidEP = this.globalVariablesService.boardHelper.justDidEnPassant;
      if (justDidEP) {
        this.globalVariablesService.field[justDidEP.row][justDidEP.col].splice(0,1);
        isHit = true;
        isEP = true;
        this.globalVariablesService.boardHelper.justDidEnPassant = null;
      }
      const justDidCastle = this.globalVariablesService.boardHelper.justDidCastle;
      if (justDidCastle) {
        const rookCol = justDidCastle.col === 2 ? 0 : 7;
        const rookDestCol = justDidCastle.col === 2 ? 3 : 5;
        const castleRook = this.globalVariablesService.field[justDidCastle.row][rookCol];
        let sourceColor = '';
        if (castleRook && castleRook[0]) {
          sourceColor = castleRook[0].color;
          this.globalVariablesService.field[justDidCastle.row][rookCol].splice(0,1);
        }
        const newCastleRook = new ChessPieceDto(sourceColor, 'rook');
        this.globalVariablesService.field[justDidCastle.row][rookDestCol].push(newCastleRook);
        this.globalVariablesService.boardHelper.justDidCastle = null;
        castleData = justDidCastle.col === 2 ? 'O-O-O' : 'O-O';
      }
      const lastNotation = GlobalVariablesService.translateNotation(
        targetRow, targetCell, srcRow, srcCell, srcPiece, isHit, isCheck, isMatch, isEP, castleData);
      GlobalVariablesService.addHistory(lastNotation);
      this.globalVariablesService.boardHelper.colorTurn = this.globalVariablesService.boardHelper.colorTurn === 'white' ? 'black' : 'white';
      transferArrayItem(event.previousContainer.data,
        event.container.data,
        event.previousIndex, event.currentIndex);
    }
  }

  isTarget(targetRow: number, targetCol: number): boolean {
    return this.globalVariablesService.boardHelper.possibles && this.globalVariablesService.possibles
      .some(({row, col}) => row === targetRow && col === targetCol);
  }

  isHit(targetRow: number, targetCol: number): boolean {
    return this.globalVariablesService.boardHelper.hits && this.globalVariablesService.hits
      .some(({row, col}) => row === targetRow && col === targetCol);
  }

  isCheck(targetRow: number, targetCol: number): boolean {
    return this.globalVariablesService.boardHelper.checks && this.globalVariablesService.checks
      .some(({row, col}) => row === targetRow && col === targetCol);
  }

  translateFieldNames(idxX: number, idxY: number): string {
    // A = 0 - H = 7
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + idxY);
    // Flip table count bottom-up
    const numberChar = (8 - idxX);
    return `${letterChar}${numberChar}`
  }

  promotePiece(toPiece: string): void {
    if (this.globalVariablesService.boardHelper.canPromote !== null) {
      const targetCol = Number(this.globalVariablesService.boardHelper.canPromote);
      const targetSquare = this.globalVariablesService.field[0][targetCol];
      if (targetSquare && targetSquare[0]) {
        targetSquare[0].piece = toPiece;
        const history = this.globalVariablesService.history;
        let lastHistory = history[history.length - 1];
        history[history.length - 1] = lastHistory + '=' + GlobalVariablesService.translatePieceNotation(toPiece);
        this.globalVariablesService.boardHelper.canPromote = null;
      }
    }
  }

  showPossibleMoves(ofColor: string): void {
    // Clear
    this.globalVariablesService.boardHelper.possibles = {};
    this.globalVariablesService.boardHelper.hits = {};
    this.globalVariablesService.boardHelper.checks = {};
    this.globalVariablesService.boardHelper.arrows = {};
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowIdx) => {
        row.forEach((cell, cellIdx) => {
          // All pieces of the color
          if (cell && cell[0] && cell[0].color === ofColor) {
            for (let targetRow = 0; targetRow <= 7; targetRow++) {
              for (let targetCol = 0; targetCol <= 7; targetCol++) {
                let data = this.globalVariablesService.field[targetRow][targetCol];
                ChessRulesService.canStepThere(targetRow, targetCol, data, rowIdx, cellIdx);
              }
            }
          }
        });
      });
    }
  }

  sanitizeScale(text: string): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(text);
  }
}
