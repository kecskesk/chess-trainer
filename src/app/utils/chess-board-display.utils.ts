import { ChessConstants } from '../constants/chess.constants';

export class ChessBoardDisplayUtils {
  static getBoardIndexForDisplay(displayIndex: number, isBoardFlipped: boolean): number {
    return isBoardFlipped ? ChessConstants.BOARD_SIZE - 1 - displayIndex : displayIndex;
  }

  static mapPercentCoordinateForDisplay(value: string, isBoardFlipped: boolean): string {
    if (!isBoardFlipped || !value) {
      return value;
    }
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)%$/);
    if (!match) {
      return value;
    }
    const parsed = Number(match[1]);
    return `${Number((100 - parsed).toFixed(4))}%`;
  }

  static mapRotationForDisplay(value: string, isBoardFlipped: boolean): string {
    if (!isBoardFlipped || !value) {
      return value;
    }
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (!match) {
      return value;
    }
    const parsed = Number(match[1]);
    let rotated = parsed + 180;
    while (rotated >= 360) {
      rotated -= 360;
    }
    while (rotated < 0) {
      rotated += 360;
    }
    return `${Number(rotated.toFixed(4))}deg`;
  }
}
