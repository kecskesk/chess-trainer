/**
 * Chess Board Utilities and Constants
 * Centralized definitions for chess-specific values and helper functions
 */
import { ChessConstants } from '../constants/chess.constants';

/**
 * Utility functions for chess board operations
 */
export class ChessBoardUtils {
  private static readonly START_POSITIONS: { [key: string]: Array<{ row: number, col: number }> } = {
    'white-rook': [{ row: 7, col: 0 }, { row: 7, col: 7 }],
    'white-knight': [{ row: 7, col: 1 }, { row: 7, col: 6 }],
    'white-bishop': [{ row: 7, col: 2 }, { row: 7, col: 5 }],
    'white-queen': [{ row: 7, col: 3 }],
    'white-king': [{ row: 7, col: 4 }],
    'white-pawn': ChessConstants.COLS.map(col => ({ row: 6, col })),
    'black-rook': [{ row: 0, col: 0 }, { row: 0, col: 7 }],
    'black-knight': [{ row: 0, col: 1 }, { row: 0, col: 6 }],
    'black-bishop': [{ row: 0, col: 2 }, { row: 0, col: 5 }],
    'black-queen': [{ row: 0, col: 3 }],
    'black-king': [{ row: 0, col: 4 }],
    'black-pawn': ChessConstants.COLS.map(col => ({ row: 1, col }))
  };

  /**
   * Converts board indices to algebraic notation (e.g., [7, 0] -> "a1")
   */
  static toAlgebraic(row: number, col: number): string {
    const file = ChessConstants.FILES[col];
    const rank = ChessConstants.RANKS[row];
    return `${file}${rank}`;
  }

  /**
   * Converts algebraic notation to board indices (e.g., "a1" -> [7, 0])
   */
  static fromAlgebraic(algebraic: string): { row: number, col: number } | null {
    if (!algebraic || algebraic.length !== 2) {
      return null;
    }

    const file = algebraic.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = ChessConstants.BOARD_SIZE - parseInt(algebraic[1], 10);

    if (file < ChessConstants.MIN_INDEX || file > ChessConstants.MAX_INDEX ||
      rank < ChessConstants.MIN_INDEX || rank > ChessConstants.MAX_INDEX) {
      return null;
    }

    return { row: rank, col: file };
  }

  /**
   * Checks if a position is within board bounds
   */
  static isInBounds(row: number, col: number): boolean {
    return row >= ChessConstants.MIN_INDEX &&
           row <= ChessConstants.MAX_INDEX &&
           col >= ChessConstants.MIN_INDEX &&
           col <= ChessConstants.MAX_INDEX;
  }

  /**
   * Calculates distance between two squares (used for knight moves, etc.)
   */
  static getDistance(fromRow: number, fromCol: number, toRow: number, toCol: number): {
    rowDelta: number,
    colDelta: number,
    maxDelta: number
  } {
    return {
      rowDelta: Math.abs(toRow - fromRow),
      colDelta: Math.abs(toCol - fromCol),
      maxDelta: Math.max(Math.abs(toRow - fromRow), Math.abs(toCol - fromCol))
    };
  }

  /**
   * Checks if two squares are on the same diagonal
   */
  static isOnSameDiagonal(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    return rowDiff === colDiff && rowDiff > 0;
  }

  /**
   * Checks if two squares are on the same file (column)
   */
  static isOnSameFile(fromCol: number, toCol: number): boolean {
    return fromCol === toCol;
  }

  /**
   * Checks if two squares are on the same rank (row)
   */
  static isOnSameRank(fromRow: number, toRow: number): boolean {
    return fromRow === toRow;
  }

  /**
   * Gets the direction vector from one square to another
   * Returns normalized direction (-1, 0, or 1 for each axis)
   */
  static getDirection(fromRow: number, fromCol: number, toRow: number, toCol: number): {
    rowDir: number,
    colDir: number
  } {
    let rowDir = 0;
    let colDir = 0;

    if (toRow > fromRow) { rowDir = 1; } else if (toRow < fromRow) { rowDir = -1; }

    if (toCol > fromCol) { colDir = 1; } else if (toCol < fromCol) { colDir = -1; }

    return { rowDir, colDir };
  }

  /**
   * Gets the square color (light or dark) for a position
   */
  static getSquareColor(row: number, col: number): 'light' | 'dark' {
    return (row + col) % 2 === 0 ? 'light' : 'dark';
  }

  /**
   * Checks if a piece is at its starting position
   */
  static isAtStartingPosition(row: number, col: number, piece: string, color: string): boolean {
    const key = `${color}-${piece}`;
    const positions = ChessBoardUtils.START_POSITIONS[key];

    if (!positions) {
      return false;
    }

    return positions.some(pos => pos.row === row && pos.col === col);
  }

  /**
   * Generates all squares between two positions (exclusive of endpoints)
   * Used for checking if path is clear
   */
  static getSquaresBetween(fromRow: number, fromCol: number, toRow: number, toCol: number): Array<{ row: number, col: number }> {
    const squares: Array<{ row: number, col: number }> = [];

    const rowDir = toRow === fromRow ? 0 : (toRow > fromRow ? 1 : -1);
    const colDir = toCol === fromCol ? 0 : (toCol > fromCol ? 1 : -1);

    let currentRow = fromRow + rowDir;
    let currentCol = fromCol + colDir;

    while (currentRow !== toRow || currentCol !== toCol) {
      squares.push({ row: currentRow, col: currentCol });
      currentRow += rowDir;
      currentCol += colDir;
    }

    return squares;
  }
}

/**
 * Notation utilities for move representation
 */
export class ChessMoveNotation {
  /**
   * Converts a move to long algebraic notation (e.g., "e2e4")
   */
  static toLongAlgebraic(fromRow: number, fromCol: number, toRow: number, toCol: number): string {
    return ChessBoardUtils.toAlgebraic(fromRow, fromCol) +
           ChessBoardUtils.toAlgebraic(toRow, toCol);
  }

  /**
   * Checks if notation is valid long notation format
   * Examples: e2e4, e2-e4, Ne2xe4+, O-O, O-O-O, exd6 e.p.
   */
  static isValidLongNotation(notation: string): boolean {
    const normalized = (notation || '').trim();
    if (!normalized) {
      return false;
    }

    const patterns: RegExp[] = [
      /^(O-O|O-O-O)([+#])?$/,
      /^[KQRBN][a-h][1-8][a-h][1-8]([+#])?$/,
      /^[a-h][1-8][a-h][1-8](=[QRBN])?([+#])?$/,
      /^[KQRBN](?:[a-h]|[1-8])?[a-h][1-8][-x][a-h][1-8]([+#])?(?: e\.p\.)?$/,
      /^[a-h][1-8][-x][a-h][1-8](=[QRBN])?([+#])?(?: e\.p\.)?$/,
    ];

    return patterns.some(pattern => pattern.test(normalized));
  }

  /**
   * Checks if notation is valid short (SAN-like) notation format
   * Examples: e4, Nf3, Rxe7+, exd8=Q#, O-O, O-O-O
   */
  static isValidShortNotation(notation: string): boolean {
    const normalized = (notation || '').trim();
    if (!normalized) {
      return false;
    }

    const patterns: RegExp[] = [
      /^(O-O|O-O-O)([+#])?$/,
      /^(?:[KQRBN])(?:[a-h]|[1-8]|[a-h][1-8])?x?[a-h][1-8]([+#])?$/,
      /^(?:[a-h]x)?[a-h][1-8](=[QRBN])?([+#])?$/
    ];

    return patterns.some(pattern => pattern.test(normalized));
  }

  /**
   * Backward-compatible umbrella validator (short OR long)
   */
  static isValidAlgebraic(notation: string): boolean {
    return ChessMoveNotation.isValidLongNotation(notation) || ChessMoveNotation.isValidShortNotation(notation);
  }

  /**
   * Gets promotion piece from notation if present
   */
  static getPromotionPiece(notation: string): string | null {
    const match = notation.match(/=([QRBN])/);
    if (!match) {
      return null;
    }

    const pieceMap: { [key: string]: string } = {
      'Q': 'queen',
      'R': 'rook',
      'B': 'bishop',
      'N': 'knight'
    };

    return pieceMap[match[1]] || null;
  }

  /**
   * Checks if notation indicates check
   */
  static isCheck(notation: string): boolean {
    return notation.endsWith('+');
  }

  /**
   * Checks if notation indicates checkmate
   */
  static isCheckmate(notation: string): boolean {
    return notation.endsWith('#');
  }
}

