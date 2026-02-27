import { AfterViewInit, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, transferArrayItem } from '@angular/cdk/drag-drop';
import { ChessPieceDto } from 'src/app/model/chess-piece.dto';
import { GlobalVariablesService } from '../../services/global-variables.service';
import { ChessRulesService } from '../../services/chess-rules.service';
import { ChessPositionDto } from '../../model/chess-position.dto';
import { ChessColorsEnum } from '../../model/chess.colors';
import { ChessPiecesEnum } from '../../model/chess.pieces';
import { IBoardHighlight } from '../../model/board-highlight.interface';
import { IVisualizationArrow } from '../../model/visualization-arrow.interface';

@Component({
  selector: 'app-chess-board',
  templateUrl: './chess-board.component.html',
  styleUrls: ['./chess-board.component.less']
})
export class ChessBoardComponent implements AfterViewInit {
  @ViewChild('chessField') chessField: ElementRef;
  @ViewChildren(CdkDropList) dropListElements: QueryList<CdkDropList>;

  dropLists: CdkDropList[] = [];
  mateInOneTargets: {[key: string]: boolean} = {};
  canDropPredicate = (drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean =>
    this.canDrop(drag, drop);

  constructor(public globalVariablesService: GlobalVariablesService) {}

  ngAfterViewInit(): void {
    if (this.dropListElements) {
      setTimeout(() => {
        this.dropLists = this.dropListElements.toArray();
      }, 0);
    }
  }

  canDrop(drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return false;
    }
    if (this.globalVariablesService.boardHelper.gameOver) {
      return false;
    }
    if (!drag || !drop || !drag.dropContainer || !drop.data || !drag.dropContainer.data) {
      return false;
    }
    if (!drag.dropContainer.data[0]) {
      return false;
    }

    const targetLocSplit = drop.id.split('field');
    const targetRow = Number(targetLocSplit[1][0]);
    const targetCol = Number(targetLocSplit[1][1]);
    const sourceLocSplit = drag.dropContainer.id.split('field');
    const sourceRow = Number(sourceLocSplit[1][0]);
    const sourceCol = Number(sourceLocSplit[1][1]);

    return ChessRulesService.validateMove(targetRow, targetCol, drop.data , sourceRow, sourceCol).isValid;
  }

  onDrop(event: CdkDragDrop<ChessPieceDto[]>): void {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return;
    }
    if (this.globalVariablesService.boardHelper.gameOver) {
      return;
    }
    if (!event || !event.previousContainer || !event.container || !event.previousContainer.data || !event.container.data) {
      return;
    }
    if (!event.previousContainer.data[0]) {
      return;
    }

    // Reset drops and hits
    this.globalVariablesService.boardHelper.debugText = '';
    this.globalVariablesService.boardHelper.possibles = {};
    this.globalVariablesService.boardHelper.hits = {};
    this.globalVariablesService.boardHelper.checks = {};
    this.globalVariablesService.boardHelper.arrows = {};
    this.mateInOneTargets = {};
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
      const srcColor = event.previousContainer.data[0].color;
      const promotionTargetRow = srcColor === ChessColorsEnum.White ? 0 : 7;
      if (srcPiece === ChessPiecesEnum.Pawn && targetRow === promotionTargetRow) {
        this.globalVariablesService.boardHelper.canPromote = targetCell;
      }

      let isHit = false;
      let isCheck = false;
      let isMatch = false;
      let isEP = false;
      let castleData = null;
      // Remove target on hit before moving the item in the container
      if (event.container && event.container.data && event.container.data[0]) {
        this.globalVariablesService.field[targetRow][targetCell].splice(0, 1);
        isHit = true;
      }
      const isPawnDiagonalToEmpty = srcPiece === ChessPiecesEnum.Pawn
        && Math.abs(targetCell - srcCell) === 1
        && (!event.container.data || event.container.data.length < 1);
      const targetDirectionStep = srcColor === ChessColorsEnum.White ? -1 : 1;
      const enemyFirstStep = srcColor === ChessColorsEnum.Black ? 5 : 2;
      if (isPawnDiagonalToEmpty && (targetRow - srcRow) === targetDirectionStep && targetRow === enemyFirstStep) {
        const epTargetRow = srcColor === ChessColorsEnum.White ? 3 : 4;
        const epSourceRow = srcColor === ChessColorsEnum.White ? 1 : 6;
        const lastHistory = this.globalVariablesService.history[this.globalVariablesService.history.length - 1];
        const possibleEP = GlobalVariablesService.translateNotation(
          epTargetRow, targetCell, epSourceRow, targetCell, ChessPiecesEnum.Pawn, false, false, false, false, null);
        if (lastHistory === possibleEP && this.globalVariablesService.field[epTargetRow][targetCell].length > 0) {
          this.globalVariablesService.field[epTargetRow][targetCell].splice(0, 1);
          isHit = true;
          isEP = true;
        }
      }
      this.globalVariablesService.boardHelper.justDidEnPassant = null;
      const justDidCastle = this.globalVariablesService.boardHelper.justDidCastle;
      if (justDidCastle) {
        const rookCol = justDidCastle.col === 2 ? 0 : 7;
        const rookDestCol = justDidCastle.col === 2 ? 3 : 5;
        const castleRook = this.globalVariablesService.field[justDidCastle.row][rookCol];
        if (castleRook && castleRook[0]) {
          const sourceColor = castleRook[0].color as ChessColorsEnum;
          this.globalVariablesService.field[justDidCastle.row][rookCol].splice(0, 1);
          const newCastleRook = new ChessPieceDto(sourceColor, ChessPiecesEnum.Rook);
          this.globalVariablesService.field[justDidCastle.row][rookDestCol].push(newCastleRook);
          this.globalVariablesService.boardHelper.justDidCastle = null;
          castleData = justDidCastle.col === 2 ? 'O-O-O' : 'O-O';
        }
      }

      if (!event.previousContainer.data || !event.container.data) {
        return;
      }
      transferArrayItem(event.previousContainer.data,
        event.container.data,
        event.previousIndex, event.currentIndex);

      const enemyColor = srcColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
      isCheck = this.isKingInCheck(this.globalVariablesService.field, enemyColor);
      if (isCheck) {
        const hasLegalMoves = this.hasAnyLegalMove(this.globalVariablesService.field, enemyColor);
        isMatch = !hasLegalMoves;
        if (isMatch) {
          this.globalVariablesService.boardHelper.gameOver = true;
          this.globalVariablesService.boardHelper.checkmateColor = enemyColor;
          this.globalVariablesService.boardHelper.debugText =
            `Checkmate! ${srcColor === ChessColorsEnum.White ? 'White' : 'Black'} wins.`;
        }
      }

      const lastNotation = GlobalVariablesService.translateNotation(
        targetRow, targetCell, srcRow, srcCell, srcPiece, isHit, isCheck, isMatch, isEP, castleData);
      GlobalVariablesService.addHistory(lastNotation);
      this.globalVariablesService.boardHelper.colorTurn =
        this.globalVariablesService.boardHelper.colorTurn === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    }
  }

  isTarget(targetRow: number, targetCol: number): boolean {
    return this.hasBoardHighlight(targetRow, targetCol, 'possible');
  }

  isHit(targetRow: number, targetCol: number): boolean {
    return this.hasBoardHighlight(targetRow, targetCol, 'capture');
  }

  isCheck(targetRow: number, targetCol: number): boolean {
    return this.hasBoardHighlight(targetRow, targetCol, 'check');
  }

  isMateInOneTarget(targetRow: number, targetCol: number): boolean {
    return !!this.mateInOneTargets[`${targetRow}${targetCol}`];
  }

  translateFieldNames(idxX: number, idxY: number): string {
    // A = 0 - H = 7
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + idxY);
    // Flip table count bottom-up
    const numberChar = (8 - idxX);
    return `${letterChar}${numberChar}`;
  }

  promotePiece(toPiece: ChessPiecesEnum): void {
    if (this.globalVariablesService.boardHelper.canPromote !== null) {
      const targetCol = Number(this.globalVariablesService.boardHelper.canPromote);
      const whitePromotionSquare = this.globalVariablesService.field[0][targetCol];
      const blackPromotionSquare = this.globalVariablesService.field[7][targetCol];
      let targetSquare = null;
      if (whitePromotionSquare && whitePromotionSquare[0] && whitePromotionSquare[0].piece === ChessPiecesEnum.Pawn) {
        targetSquare = whitePromotionSquare;
      } else if (blackPromotionSquare && blackPromotionSquare[0] && blackPromotionSquare[0].piece === ChessPiecesEnum.Pawn) {
        targetSquare = blackPromotionSquare;
      }
      if (targetSquare && targetSquare[0]) {
        targetSquare[0].piece = toPiece;
        const history = this.globalVariablesService.history;
        const lastHistory = history[history.length - 1];
        history[history.length - 1] = lastHistory + '=' + GlobalVariablesService.translatePieceNotation(toPiece);
        this.globalVariablesService.boardHelper.canPromote = null;
      }
    }
  }

  showPossibleMoves(ofColor: ChessColorsEnum): void {
    // Clear
    this.globalVariablesService.boardHelper.possibles = {};
    this.globalVariablesService.boardHelper.hits = {};
    this.globalVariablesService.boardHelper.checks = {};
    this.globalVariablesService.boardHelper.arrows = {};
    this.mateInOneTargets = {};
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowIdx) => {
        row.forEach((cell, cellIdx) => {
          // All pieces of the color
          if (cell && cell[0] && cell[0].color === ofColor) {
            for (let targetRow = 0; targetRow <= 7; targetRow++) {
              for (let targetCol = 0; targetCol <= 7; targetCol++) {
                const data = this.globalVariablesService.field[targetRow][targetCol];
                ChessRulesService.canStepThere(targetRow, targetCol, data, rowIdx, cellIdx);
              }
            }
          }
        });
      });
    }
  }

  showMateInOne(): void {
    this.globalVariablesService.boardHelper.possibles = {};
    this.globalVariablesService.boardHelper.hits = {};
    this.globalVariablesService.boardHelper.checks = {};
    this.globalVariablesService.boardHelper.arrows = {};
    this.mateInOneTargets = {};

    const forColor = this.globalVariablesService.boardHelper.colorTurn as ChessColorsEnum;
    const enemyColor = forColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const board = this.cloneBoard(this.globalVariablesService.field);

    for (let srcRow = 0; srcRow <= 7; srcRow++) {
      for (let srcCol = 0; srcCol <= 7; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === forColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = 0; targetRow <= 7; targetRow++) {
          for (let targetCol = 0; targetCol <= 7; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }
            const canMove = this.withBoardContext(board, forColor, () =>
              ChessRulesService.canStepThere(
                targetRow,
                targetCol,
                board[targetRow][targetCol],
                srcRow,
                srcCol,
                new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
              )
            );

            if (!canMove) {
              continue;
            }

            const afterOurMove = this.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
            if (this.isKingInCheck(afterOurMove, forColor)) {
              continue;
            }

            const enemyInCheck = this.isKingInCheck(afterOurMove, enemyColor);
            if (!enemyInCheck) {
              continue;
            }

            const enemyHasResponse = this.hasAnyLegalMove(afterOurMove, enemyColor);
            if (!enemyHasResponse) {
              this.mateInOneTargets[`${targetRow}${targetCol}`] = true;
            }
          }
        }
      }
    }

    const mateCount = Object.keys(this.mateInOneTargets).length;
    this.globalVariablesService.boardHelper.debugText = mateCount > 0
      ? `Mate in one found: ${mateCount} move${mateCount > 1 ? 's' : ''}`
      : 'No mate in one found.';
  }

  showThreats(ofEnemy = false): void {
    this.globalVariablesService.boardHelper.arrows = {};
    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowIdx) => {
        row.forEach((cell, cellIdx) => {
          // All pieces of the color
          if (cell && cell[0] && cell[0].color === ofColor) {
            const threats = this.getThreatsBy(cell, rowIdx, cellIdx, ofColor, enemyColor);
            threats.forEach(threat => {
              let scaryThreat = 0.25;
              const attacker = ChessRulesService.valueOfPiece(threat.piece);
              const defender = ChessRulesService.valueOfPiece(cell[0].piece);
              if (attacker / defender > 1) {
                scaryThreat += 0.15;
              }
              if (attacker / defender < 1) {
                scaryThreat -= 0.15;
              }
              const posFrom = new ChessPositionDto(8 - rowIdx, cellIdx + 1);
              const posTo = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
              GlobalVariablesService.createArrowFromVisualization(
                this.createVisualizationArrow(posFrom, posTo, 'blue', scaryThreat)
              );
            });
          }
        });
      });
    }
  }

  getThreatsBy(
    cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    for (let targetRow = 0; targetRow <= 7; targetRow++) {
      for (let targetCol = 0; targetCol <= 7; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const targetCell = this.globalVariablesService.field[targetRow][targetCol];
          const currentPiece = { color: ofColor, piece: cell[0].piece } as ChessPieceDto;
          const canStepThere = ChessRulesService.canStepThere(
            targetRow,
            targetCol,
            targetCell,
            rowIdx,
            cellIdx,
            currentPiece
          );
          if (canStepThere && targetCell && targetCell[0]) {
            threats.push({pos: new ChessPositionDto(targetRow, targetCol), piece: targetCell[0].piece});
          }
        }
      }
    }
    return threats;
  }

  getThreatsOn(
    cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    for (let targetRow = 0; targetRow <= 7; targetRow++) {
      for (let targetCol = 0; targetCol <= 7; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const targetCell = this.globalVariablesService.field[targetRow][targetCol];
          const currentPiece = { color: ofColor, piece: cell[0].piece } as ChessPieceDto;
          const canStepThere = ChessRulesService.canStepThere(
            rowIdx, cellIdx,
            [ currentPiece ],
            targetRow, targetCol,
            targetCell[0]);
          if (canStepThere && targetCell && targetCell[0]) {
            threats.push({pos: new ChessPositionDto(targetRow, targetCol), piece: targetCell[0].piece});
          }
        }
      }
    }
    return threats;
  }

  showProtected(ofEnemy = false): void {
    this.globalVariablesService.boardHelper.arrows = {};
    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowAIdx) => {
        row.forEach((cellA, cellAIdx) => {
          // All pieces of the color
          if (cellA && cellA[0] && cellA[0].color === ofColor) {
            const protectors = this.getProtectors(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
            protectors.forEach(cellB => {
              const posFrom = new ChessPositionDto(8 - cellB.row, cellB.col + 1);
              const posTo = new ChessPositionDto(8 - rowAIdx, cellAIdx + 1);
              GlobalVariablesService.createArrowFromVisualization(
                this.createVisualizationArrow(posFrom, posTo, 'gold', 0.25)
              );
            });
          }
        });
      });
    }
  }

  getProtectors(
    cellA: ChessPieceDto[],
    rowAIdx: number,
    cellAIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): ChessPositionDto[] {
    const protectors = [] as ChessPositionDto[];
    const currentPiece = { color: ofColor, piece: cellA[0].piece } as ChessPieceDto;
    this.globalVariablesService.field.forEach((rowB, rowBIdx) => {
      rowB.forEach((cellB, cellBIdx) => {
        // All pieces of the color
        if (cellB && cellB[0] && cellB[0].color === ofColor) {
          if (cellAIdx !== cellBIdx || rowAIdx !== rowBIdx) {
            if (ChessRulesService.canStepThere(
              rowAIdx,
              cellAIdx,
              [{ color: enemyColor, piece: cellA[0].piece }],
              rowBIdx,
              cellBIdx,
              { color: ofColor, piece: cellB[0].piece })) {
              protectors.push(new ChessPositionDto(rowBIdx, cellBIdx));
            }
          }
        }
      });
    });
    return protectors;
  }

  showHangingPieces(ofEnemy = false): void {
    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    this.globalVariablesService.boardHelper.arrows = {};
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowAIdx) => {
        row.forEach((cellA, cellAIdx) => {
          // All pieces of the color
          if (cellA && cellA[0] && cellA[0].color === ofColor) {
            const protectedBy = this.getProtectors(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
            const isProtected = protectedBy.length > 0;
            if (!isProtected) {
              const threatsOnCell = this.getThreatsOn(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
              threatsOnCell.forEach(threat => {
                let scaryThreat = 0.25;
                const attacker = ChessRulesService.valueOfPiece(cellA[0].piece);
                const defender = ChessRulesService.valueOfPiece(threat.piece);
                if (attacker / defender > 1) {
                  scaryThreat += 0.15;
                }
                if (attacker / defender < 1) {
                  scaryThreat -= 0.15;
                }
                const posFrom = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
                const posTo = new ChessPositionDto(8 - rowAIdx, cellAIdx + 1);
                GlobalVariablesService.createArrowFromVisualization(
                  this.createVisualizationArrow(posFrom, posTo, 'blue', scaryThreat)
                );
              });
            }
          }
        });
      });
    }
  }

  private initColors(ofEnemy: boolean): { ofColor: ChessColorsEnum, enemyColor: ChessColorsEnum} {
    let ofColor: ChessColorsEnum;
    let enemyColor: ChessColorsEnum;
    if (!ofEnemy) {
      ofColor = this.globalVariablesService.boardHelper.colorTurn as ChessColorsEnum;
      enemyColor = ofColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    } else {
      enemyColor = this.globalVariablesService.boardHelper.colorTurn as ChessColorsEnum;
      ofColor = enemyColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    }
    return {ofColor, enemyColor};
  }

  private hasBoardHighlight(targetRow: number, targetCol: number, type: IBoardHighlight['type']): boolean {
    return this.globalVariablesService.boardHighlights
      .some(highlight => highlight.type === type && highlight.row === targetRow && highlight.col === targetCol);
  }

  private createVisualizationArrow(
    from: ChessPositionDto,
    to: ChessPositionDto,
    color: IVisualizationArrow['color'],
    intensity: number
  ): IVisualizationArrow {
    return {
      fromRow: from.row,
      fromCol: from.col,
      toRow: to.row,
      toCol: to.col,
      color,
      intensity: Math.max(0, Math.min(1, intensity))
    };
  }

  private withBoardContext<T>(board: ChessPieceDto[][][], turn: ChessColorsEnum, callback: () => T): T {
    const previousField = GlobalVariablesService.CHESS_FIELD;
    const previousTurn = this.globalVariablesService.boardHelper.colorTurn;
    const previousCastle = this.globalVariablesService.boardHelper.justDidCastle;
    try {
      GlobalVariablesService.CHESS_FIELD = board;
      this.globalVariablesService.boardHelper.colorTurn = turn;
      this.globalVariablesService.boardHelper.justDidCastle = null;
      return callback();
    } finally {
      GlobalVariablesService.CHESS_FIELD = previousField;
      this.globalVariablesService.boardHelper.colorTurn = previousTurn;
      this.globalVariablesService.boardHelper.justDidCastle = previousCastle;
    }
  }

  private cloneBoard(board: ChessPieceDto[][][]): ChessPieceDto[][][] {
    return board.map(row => row.map(cell => {
      if (!cell || cell.length < 1) {
        return [];
      }
      return [new ChessPieceDto(cell[0].color, cell[0].piece)];
    }));
  }

  private simulateMove(
    board: ChessPieceDto[][][],
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number
  ): ChessPieceDto[][][] {
    const nextBoard = this.cloneBoard(board);
    const movingPiece = nextBoard[srcRow][srcCol] && nextBoard[srcRow][srcCol][0]
      ? new ChessPieceDto(nextBoard[srcRow][srcCol][0].color, nextBoard[srcRow][srcCol][0].piece)
      : null;
    nextBoard[srcRow][srcCol] = [];
    nextBoard[targetRow][targetCol] = movingPiece ? [movingPiece] : [];
    return nextBoard;
  }

  private findKing(board: ChessPieceDto[][][], color: ChessColorsEnum): ChessPositionDto | null {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        const cell = board[row][col];
        if (cell && cell[0] && cell[0].color === color && cell[0].piece === ChessPiecesEnum.King) {
          return new ChessPositionDto(row, col);
        }
      }
    }
    return null;
  }

  private isKingInCheck(board: ChessPieceDto[][][], kingColor: ChessColorsEnum): boolean {
    const king = this.findKing(board, kingColor);
    if (!king) {
      return false;
    }
    const attackerColor = kingColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        const attackerCell = board[row][col];
        if (!(attackerCell && attackerCell[0] && attackerCell[0].color === attackerColor)) {
          continue;
        }
        const attacker = attackerCell[0];
        const canHitKing = this.withBoardContext(board, attackerColor, () =>
          ChessRulesService.canStepThere(
            king.row,
            king.col,
            [new ChessPieceDto(kingColor, ChessPiecesEnum.King)],
            row,
            col,
            new ChessPieceDto(attacker.color, attacker.piece)
          )
        );
        if (canHitKing) {
          return true;
        }
      }
    }
    return false;
  }

  private hasAnyLegalMove(board: ChessPieceDto[][][], forColor: ChessColorsEnum): boolean {
    for (let srcRow = 0; srcRow <= 7; srcRow++) {
      for (let srcCol = 0; srcCol <= 7; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === forColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = 0; targetRow <= 7; targetRow++) {
          for (let targetCol = 0; targetCol <= 7; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }
            const canMove = this.withBoardContext(board, forColor, () =>
              ChessRulesService.canStepThere(
                targetRow,
                targetCol,
                board[targetRow][targetCol],
                srcRow,
                srcCol,
                new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
              )
            );
            if (!canMove) {
              continue;
            }
            const afterMove = this.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
            if (!this.isKingInCheck(afterMove, forColor)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
}
