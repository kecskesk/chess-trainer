import { Injectable } from '@angular/core';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessBoardHelperDto } from '../model/chess-board-helper.dto';
import { ChessArrowDto } from '../model/chess-arrow.dto';
import { ChessColorsEnum } from '../model/chess.colors';
import { ChessPiecesEnum } from '../model/chess.pieces';
import { ChessPositionDto } from '../model/chess-position.dto';
import { IBoardHighlight } from '../model/board-highlight.interface';
import { IVisualizationArrow } from '../model/visualization-arrow.interface';

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
              ChessColorsEnum.White,
              null,
              null,
              null,
              false,
              null);
  field = [
    [
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Queen)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)]
    ],
    [
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)]
    ],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)]
    ],
    [
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)],
      [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)]
    ]
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

  get boardHighlights(): IBoardHighlight[] {
    const possibleHighlights = this.possibles.map(({ row, col }) => ({ row, col, type: 'possible' as const }));
    const captureHighlights = this.hits.map(({ row, col }) => ({ row, col, type: 'capture' as const }));
    const checkHighlights = this.checks.map(({ row, col }) => ({ row, col, type: 'check' as const }));
    return [...possibleHighlights, ...captureHighlights, ...checkHighlights];
  }

  get history(): string[] {
    return Object.values(this.boardHelper.history);
  }

  static addPossible(newPossible: ChessPositionDto): void {
    if (!newPossible) {
      console.warn('Attempted to add null/undefined possible move');
      return;
    }
    if (!this.BOARD_HELPER) {
      console.error('BOARD_HELPER is not initialized');
      return;
    }
    this.BOARD_HELPER.possibles[`${newPossible.row}${newPossible.col}`] = newPossible;
  }

  static addHit(newHit: ChessPositionDto): void {
    if (!newHit) {
      console.warn('Attempted to add null/undefined hit position');
      return;
    }
    if (!this.BOARD_HELPER) {
      console.error('BOARD_HELPER is not initialized');
      return;
    }
    this.BOARD_HELPER.hits[`${newHit.row}${newHit.col}`] = newHit;
  }

  static addCheck(newCheck: ChessPositionDto): void {
    if (!newCheck) {
      console.warn('Attempted to add null/undefined check position');
      return;
    }
    if (!this.BOARD_HELPER) {
      console.error('BOARD_HELPER is not initialized');
      return;
    }
    this.BOARD_HELPER.checks[`${newCheck.row}${newCheck.col}`] = newCheck;
  }

  static addHighlight(highlight: IBoardHighlight): void {
    if (!highlight) {
      return;
    }
    switch (highlight.type) {
      case 'possible':
        GlobalVariablesService.addPossible({ row: highlight.row, col: highlight.col });
        break;
      case 'capture':
        GlobalVariablesService.addHit({ row: highlight.row, col: highlight.col });
        break;
      case 'check':
        GlobalVariablesService.addCheck({ row: highlight.row, col: highlight.col });
        break;
      default:
        break;
    }
  }

  static addArrow(arrowParam: ChessArrowDto): void {
    if (!arrowParam) {
      console.warn('Attempted to add null/undefined arrow');
      return;
    }
    if (!this.BOARD_HELPER) {
      console.error('BOARD_HELPER is not initialized');
      return;
    }
    const arrowKey = `${arrowParam.left}${arrowParam.top}${arrowParam.rotate}` +
      `${arrowParam.color}${arrowParam.length}${arrowParam.thickness}`;
    this.BOARD_HELPER.arrows[arrowKey] = arrowParam;
  }

  static createArrowFromVisualization(visualizationArrow: IVisualizationArrow): void {
    const boxSize = 76;
    const midX = (((visualizationArrow.fromCol + visualizationArrow.toCol) / 2) - 0.5) * boxSize;
    const midY = (8.5 - ((visualizationArrow.fromRow + visualizationArrow.toRow) / 2)) * boxSize;

    const stepRow = visualizationArrow.fromRow - visualizationArrow.toRow;
    const stepCol = visualizationArrow.toCol - visualizationArrow.fromCol;
    const deg = Math.atan2(stepRow, stepCol) * (180 / Math.PI);
    const distancePx = Math.sqrt((stepCol * boxSize) * (stepCol * boxSize) + (stepRow * boxSize) * (stepRow * boxSize));
    const thicknessPx = Math.max(2, Math.min(8, 2 + (visualizationArrow.intensity * 8)));

    const arTop = `${midY}px`;
    const arLeft = `${midX}px`;
    const arRot = `${deg}deg`;
    const arLength = `${Math.max(20, distancePx)}px`;
    const arThickness = `${thicknessPx}px`;
    const newArrow = new ChessArrowDto(
      arTop,
      arLeft,
      arRot,
      GlobalVariablesService.normalizeVisualizationArrowColor(visualizationArrow.color),
      arLength,
      arThickness
    );
    GlobalVariablesService.addArrow(newArrow);
  }

  private static normalizeVisualizationArrowColor(color: string): IVisualizationArrow['color'] {
    if (color === 'red') {
      return 'red';
    }
    if (color === 'green') {
      return 'green';
    }
    if (color === 'yellow') {
      return 'yellow';
    }
    if (color === 'gold') {
      return 'gold';
    }
    return 'blue';
  }

  static addHistory(newHistory: string): void {
    const historySize = Object.keys(this.BOARD_HELPER.history).length;
    const newItemIdx = historySize + 1;
    this.BOARD_HELPER.history[`${newItemIdx}`] = newHistory;
  }

  static translateNotation(targetRow: number, targetCol: number, srcRow: number, srcCol: number,
                    piece: ChessPiecesEnum, hit: boolean, check: boolean, match: boolean, ep: boolean, castleData: string): string {
    const pieceNotation = GlobalVariablesService.translatePieceNotation(piece);
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

  static translatePieceNotation(piece: ChessPiecesEnum): string {
    switch (piece) {
      case ChessPiecesEnum.Pawn: return '';
      case ChessPiecesEnum.Bishop: return 'B';
      case ChessPiecesEnum.King: return 'K';
      case ChessPiecesEnum.Queen: return 'Q';
      case ChessPiecesEnum.Rook: return 'R';
      case ChessPiecesEnum.Knight: return 'N';
      default: return '';
    }
  }

  static pieceIsInWay(targetRow: number, targetCol: number, srcRow: number, srcCol: number): boolean {
    // Validate board is initialized
    if (!GlobalVariablesService.CHESS_FIELD || GlobalVariablesService.CHESS_FIELD.length === 0) {
      console.error('CHESS_FIELD is not initialized');
      return false;
    }

    const stepRow = targetRow - srcRow;
    const stepCol = targetCol - srcCol;

    // If no movement, no piece can be in the way
    if (stepRow === 0 && stepCol === 0) {
      return false;
    }

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
      // Validate indices are within bounds
      if (nextStepRow < 0 || nextStepRow > 7 || nextStepCol < 0 || nextStepCol > 7) {
        return false;
      }

      const cell = GlobalVariablesService.CHESS_FIELD[nextStepRow] && GlobalVariablesService.CHESS_FIELD[nextStepRow][nextStepCol];
      if (!cell) {
        return false;
      }

      if (cell.length > 0) {
        return true;
      }

      if (nextStepRow !== targetRow) {
        nextStepRow += stepRow > 0 ? 1 : -1;
      }
      if (nextStepCol !== targetCol) {
        nextStepCol += stepCol > 0 ? 1 : -1;
      }

      cntr++;
      // Safety check to prevent infinite loops
      if (cntr > 8) {
        console.warn('Infinite loop detected in pieceIsInWay');
        return false;
      }
    }
    return false;
  }
}
