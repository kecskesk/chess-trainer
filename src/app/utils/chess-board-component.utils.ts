import { ChessBoardUiConstants, ChessConstants } from '../constants/chess.constants';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessBoardDisplayUtils } from './chess-board-display.utils';

export class ChessBoardComponentUtils {
  static movePieceBetweenCells(sourceCell: ChessPieceDto[], targetCell: ChessPieceDto[]): void {
    if (!sourceCell || !targetCell || !sourceCell[0]) {
      return;
    }
    const movingPiece = sourceCell[0];
    sourceCell.splice(0, sourceCell.length);
    targetCell.splice(0, targetCell.length);
    targetCell.push(movingPiece);
  }

  static parseFieldId(fieldId: string): { row: number, col: number } | null {
    if (!fieldId || !fieldId.startsWith(ChessBoardUiConstants.FIELD_ID_PREFIX) ||
      fieldId.length < ChessBoardUiConstants.FIELD_ID_MIN_LENGTH) {
      return null;
    }
    const row = Number(fieldId.charAt(ChessBoardUiConstants.FIELD_ID_ROW_INDEX));
    const col = Number(fieldId.charAt(ChessBoardUiConstants.FIELD_ID_COL_INDEX));
    if (isNaN(row) || isNaN(col) ||
      row < ChessConstants.MIN_INDEX || row > ChessConstants.MAX_INDEX ||
      col < ChessConstants.MIN_INDEX || col > ChessConstants.MAX_INDEX) {
      return null;
    }
    return { row, col };
  }

  static getDisplayBoardPosition(displayRow: number, displayCol: number, isBoardFlipped: boolean): { row: number, col: number } {
    return {
      row: ChessBoardDisplayUtils.getBoardIndexForDisplay(displayRow, isBoardFlipped),
      col: ChessBoardDisplayUtils.getBoardIndexForDisplay(displayCol, isBoardFlipped)
    };
  }

  static getPieceColorPreviewCell(
    displayRow: number,
    displayCol: number,
    renderedBoardRows: number[],
    renderedBoardCols: number[]
  ): ChessPieceDto[] {
    const rowIndex = renderedBoardRows.indexOf(displayRow);
    const colIndex = renderedBoardCols.indexOf(displayCol);
    if (rowIndex < 0 || colIndex < 0) {
      return [];
    }

    if (rowIndex === 0 && colIndex === 0) {
      return [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    }
    if (rowIndex === 0 && colIndex === 1) {
      return [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)];
    }
    if (rowIndex === 1 && colIndex === 0) {
      return [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    }
    if (rowIndex === 1 && colIndex === 1) {
      return [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    }
    return [];
  }

  static parseEvaluationPawns(
    evalText: string,
    pendingEvaluationPlaceholder: string,
    evaluationErrorPlaceholder: string,
    naPlaceholder: string,
    analysisClampPawns: number
  ): number | null {
    if (!evalText || evalText === pendingEvaluationPlaceholder ||
      evalText === evaluationErrorPlaceholder || evalText === naPlaceholder) {
      return null;
    }
    if (evalText.startsWith('#')) {
      return evalText.includes('-') ? -analysisClampPawns : analysisClampPawns;
    }
    const numeric = Number(evalText);
    if (Number.isNaN(numeric)) {
      return null;
    }
    return numeric;
  }

  static getMoveQuality(halfMoveIndex: number, previousEval: number | null, currentEval: number | null): { label: string; className: string } | null {
    if (halfMoveIndex < 1 || previousEval === null || currentEval === null) {
      return null;
    }

    const movedByWhite = (halfMoveIndex % 2) === 0;
    const improvement = movedByWhite
      ? (currentEval - previousEval)
      : (previousEval - currentEval);

    if (improvement >= 3) {
      return { label: 'genius', className: 'history-quality--genius' };
    }
    if (improvement >= 1) {
      return { label: 'great', className: 'history-quality--great' };
    }
    if (improvement >= 0.5) {
      return { label: 'good', className: 'history-quality--good' };
    }
    if (improvement >= 0) {
      return { label: 'best', className: 'history-quality--best' };
    }
    if (improvement <= -3) {
      return { label: 'blunder', className: 'history-quality--blunder' };
    }
    if (improvement <= -1) {
      return { label: 'mistake', className: 'history-quality--mistake' };
    }
    if (improvement <= -0.5) {
      return { label: 'small error', className: 'history-quality--small-error' };
    }
    return null;
  }
}
