import { Injectable } from '@angular/core';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessBoardHelperDto } from '../model/chess-board-helper.dto';
import { ChessArrowDto } from '../model/chess-arrow.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessPositionDto } from '../model/chess-position.dto';
import { IBoardHighlight } from '../model/interfaces/board-highlight.interface';
import { IVisualizationArrow } from '../model/interfaces/visualization-arrow.interface';
import { ChessConstants, VisualizationConstants } from '../constants/chess.constants';

@Injectable()
export class ChessBoardStateService {
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
    ChessBoardStateService.CHESS_FIELD = this.field;
    ChessBoardStateService.BOARD_HELPER = this.boardHelper;
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
    this.addPositionToCollection('possibles', newPossible);
  }

  static addHit(newHit: ChessPositionDto): void {
    if (!newHit) {
      console.warn('Attempted to add null/undefined hit position');
      return;
    }
    this.addPositionToCollection('hits', newHit);
  }

  static addCheck(newCheck: ChessPositionDto): void {
    if (!newCheck) {
      console.warn('Attempted to add null/undefined check position');
      return;
    }
    this.addPositionToCollection('checks', newCheck);
  }

  static addHighlight(highlight: IBoardHighlight): void {
    if (!highlight) {
      return;
    }
    switch (highlight.type) {
      case 'possible':
        ChessBoardStateService.addPossible({ row: highlight.row, col: highlight.col });
        break;
      case 'capture':
        ChessBoardStateService.addHit({ row: highlight.row, col: highlight.col });
        break;
      case 'check':
        ChessBoardStateService.addCheck({ row: highlight.row, col: highlight.col });
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
    if (!this.ensureBoardHelperInitialized()) {
      return;
    }
    const arrowKey = `${arrowParam.left}${arrowParam.top}${arrowParam.rotate}` +
      `${arrowParam.color}${arrowParam.length}${arrowParam.thickness}`;
    this.BOARD_HELPER.arrows[arrowKey] = arrowParam;
  }

  private static ensureBoardHelperInitialized(): boolean {
    if (this.BOARD_HELPER) {
      return true;
    }
    console.error('BOARD_HELPER is not initialized');
    return false;
  }

  private static addPositionToCollection(
    collectionName: 'possibles' | 'hits' | 'checks',
    position: ChessPositionDto
  ): void {
    if (!this.ensureBoardHelperInitialized()) {
      return;
    }
    this.BOARD_HELPER[collectionName][`${position.row}${position.col}`] = position;
  }

  static createArrowFromVisualization(visualizationArrow: IVisualizationArrow): void {
    const halfSquareOffset = 0.5;
    const boardCenterOffset = 8.5;
    const boardSquares = ChessConstants.BOARD_SIZE;
    const midXPercent = ((((visualizationArrow.fromCol + visualizationArrow.toCol) / 2) - halfSquareOffset) / boardSquares) * 100;
    const midYPercent = ((boardCenterOffset - ((visualizationArrow.fromRow + visualizationArrow.toRow) / 2)) / boardSquares) * 100;

    const stepRow = visualizationArrow.fromRow - visualizationArrow.toRow;
    const stepCol = visualizationArrow.toCol - visualizationArrow.fromCol;
    const deg = Math.atan2(stepRow, stepCol) * (180 / Math.PI);
    const distanceSquares = Math.sqrt((stepCol * stepCol) + (stepRow * stepRow));
    const minLengthPercent = (VisualizationConstants.ARROW_MIN_LENGTH_SQUARES / boardSquares) * 100;
    const distancePercent = (distanceSquares / boardSquares) * 100;
    const thicknessPx = Math.max(
      VisualizationConstants.ARROW_MIN_THICKNESS,
      Math.min(
        VisualizationConstants.ARROW_MAX_THICKNESS,
        VisualizationConstants.ARROW_MIN_THICKNESS + (visualizationArrow.intensity * VisualizationConstants.ARROW_MAX_THICKNESS)
      )
    );

    const arTop = `${midYPercent}%`;
    const arLeft = `${midXPercent}%`;
    const arRot = `${deg}deg`;
    const arLength = `${Math.max(minLengthPercent, distancePercent)}%`;
    const arThickness = `${thicknessPx}px`;
    const newArrow = new ChessArrowDto(
      arTop,
      arLeft,
      arRot,
      ChessBoardStateService.normalizeVisualizationArrowColor(visualizationArrow.color),
      arLength,
      arThickness
    );
    ChessBoardStateService.addArrow(newArrow);
  }

  private static normalizeVisualizationArrowColor(color: string): IVisualizationArrow['color'] {
    if (VisualizationConstants.SUPPORTED_ARROW_COLORS.indexOf(color as IVisualizationArrow['color']) >= 0) {
      return color as IVisualizationArrow['color'];
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
    const pieceNotation = ChessBoardStateService.translatePieceNotation(piece);
    const letterChar = ChessBoardStateService.toFileChar(targetCol);
    const letterCharSrc = ChessBoardStateService.toFileChar(srcCol);
    const numberChar = (8 - targetRow);
    const numberCharSrc = (8 - srcRow);
    if (castleData) {
      return castleData;
    }
    return `${pieceNotation}${letterCharSrc}${numberCharSrc}${hit ? 'x' : '-'}` +
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
    if (!ChessBoardStateService.CHESS_FIELD || ChessBoardStateService.CHESS_FIELD.length === 0) {
      console.error('CHESS_FIELD is not initialized');
      return false;
    }

    const stepRow = targetRow - srcRow;
    const stepCol = targetCol - srcCol;

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

    let iterationCount = 0;
    while (nextStepRow !== targetRow || nextStepCol !== targetCol) {
      if (
        nextStepRow < ChessConstants.MIN_INDEX || nextStepRow > ChessConstants.MAX_INDEX ||
        nextStepCol < ChessConstants.MIN_INDEX || nextStepCol > ChessConstants.MAX_INDEX
      ) {
        return false;
      }

      const cell = ChessBoardStateService.CHESS_FIELD[nextStepRow] && ChessBoardStateService.CHESS_FIELD[nextStepRow][nextStepCol];
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

      iterationCount++;
      if (iterationCount > VisualizationConstants.MAX_PATH_ITERATIONS) {
        console.warn('Infinite loop detected in pieceIsInWay');
        return false;
      }
    }
    return false;
  }

  private static toFileChar(col: number): string {
    return String.fromCharCode('a'.charCodeAt(0) + col);
  }
}
