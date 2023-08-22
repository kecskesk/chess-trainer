import { Injectable } from '@angular/core';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessBoardHelperDto } from '../model/chess-board-helper.dto';
import { ChessArrowDto } from '../model/chess-arrow.dto';
import { ChessPositionDto } from '../model/chess-position.dto';

@Injectable()
export class GlobalVariablesService {
  public static BOARD_HELPER: ChessBoardHelperDto = null;
  public static CHESS_FIELD: ChessPieceDto[][][] = [];
  boardHelper = new ChessBoardHelperDto(
              '',
              {},
              {},
              {},
              {},
              {},
              'white',
              null,
              null,
              null);
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

  constructor() {
    GlobalVariablesService.CHESS_FIELD = this.field;
    GlobalVariablesService.BOARD_HELPER = this.boardHelper;
  }

  get possibles(): ChessPositionDto[] {
    return Object.values(this.boardHelper.possibles);
  }

  get hits(): ChessPositionDto[] {
    return Object.values(this.boardHelper.hits);
  }

  get checks(): ChessPositionDto[] {
    return Object.values(this.boardHelper.checks);
  }

  get arrows(): ChessArrowDto[] {
    return Object.values(this.boardHelper.arrows);
  }

  get history(): string[] {
    return Object.values(this.boardHelper.history);
  }

  static addPossible(newPossible: ChessPositionDto): void {
    this.BOARD_HELPER.possibles[`${newPossible.row}${newPossible.col}`] = newPossible;
  }

  static addHit(newHit: ChessPositionDto): void {
    this.BOARD_HELPER.hits[`${newHit.row}${newHit.col}`] = newHit;
  }

  static addCheck(newCheck: ChessPositionDto): void {
    this.BOARD_HELPER.checks[`${newCheck.row}${newCheck.col}`] = newCheck;
  }

  static addArrow(arrowParam: ChessArrowDto, idx: number): void {
    this.BOARD_HELPER.arrows[`${idx}`] = arrowParam;
  }

  static addHistory(newHistory: string): void {
    const historySize = Object.keys(this.BOARD_HELPER.history).length;
    const newItemIdx = historySize + 1;
    this.BOARD_HELPER.history[`${newItemIdx}`] = newHistory;
  }

  static translateNotation(targetRow: number, targetCol: number, srcRow: number, srcCol: number,
                    piece: string, hit: boolean, check: boolean, match: boolean, ep: boolean, castleData: string): string {
    let pieceNotation = GlobalVariablesService.translatePieceNotation(piece);
    // A = 0 - H = 7
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + targetCol);
    const letterCharSrc = String.fromCharCode('a'.charCodeAt(0) + srcCol);
    // Flip table count bottom-up
    const numberChar = (8 - targetRow);
    const numberCharSrc = (8 - srcRow);
    if (castleData) {
      return castleData;
    }
    return `${pieceNotation}${letterCharSrc}${numberCharSrc}${hit ? 'x' : ''}` +
      `${letterChar}${numberChar}${check ? '+' : ''}${match ? '#' : ''}${ep ? ' e.p.' : ''}`;
  }

  static translatePieceNotation(piece: string): string {
    switch(piece) {
      case 'pawn': return '';
      case 'bishop': return 'B';
      case 'king': return 'K';
      case 'queen': return 'Q';
      case 'rook': return 'R';
      case 'knight': return 'N';
    }
  }

  static pieceIsInWay(targetRow: number, targetCol: number, srcRow: number, srcCol: number): boolean {
    const stepRow = targetRow - srcRow;
    const stepCol = targetCol - srcCol;
    let nextStepRow = srcRow;
    let nextStepCol = srcCol;
    if (nextStepRow !== targetRow) {
      nextStepRow += stepRow > 0 ? 1 : -1;
    }
    if (nextStepCol !== targetCol) {
      nextStepCol += stepCol > 0 ? 1 : -1;
    }
    let cntr = 0;
    while (nextStepRow !== targetRow || nextStepCol !== targetCol) {
      if (!GlobalVariablesService.CHESS_FIELD || !GlobalVariablesService.CHESS_FIELD[nextStepRow] ||
        !GlobalVariablesService.CHESS_FIELD[nextStepRow][nextStepCol]) {
        return false;
      }
      if (GlobalVariablesService.CHESS_FIELD[nextStepRow][nextStepCol].length > 0) {
        return true;
      }
      if (nextStepRow !== targetRow) {
        nextStepRow += stepRow > 0 ? 1 : -1;
      }
      if (nextStepCol !== targetCol) {
        nextStepCol += stepCol > 0 ? 1 : -1;
      }
      cntr++;
      if (cntr > 7) {
        return false;
      }
    }
    return false;
  }
}
