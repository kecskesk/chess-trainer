import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessConstants } from '../constants/chess.constants';

export class ChessFenUtils {
  static generateFen(
    board: ChessPieceDto[][][],
    activeColor: ChessColorsEnum,
    castlingRights: string,
    enPassantSquare: string,
    halfmoveClock: number,
    fullmoveNumber: number
  ): string {
    const placement = this.toPiecePlacement(board);
    const turn = activeColor === ChessColorsEnum.Black ? 'b' : 'w';
    const castling = this.normalizeCastlingRights(castlingRights);
    const enPassant = this.normalizeEnPassant(enPassantSquare);
    const safeHalfmove = Math.max(0, Math.floor(halfmoveClock || 0));
    const safeFullmove = Math.max(1, Math.floor(fullmoveNumber || 1));
    return `${placement} ${turn} ${castling} ${enPassant} ${safeHalfmove} ${safeFullmove}`;
  }

  static getPlyCountFromHistory(history: string[]): number {
    return this.getMovesFromHistory(history).length;
  }

  static getFullmoveNumberFromPlyCount(plyCount: number): number {
    return Math.floor(Math.max(0, plyCount) / 2) + 1;
  }

  static getHalfmoveClockFromHistory(history: string[]): number {
    const moves = this.getMovesFromHistory(history);
    let halfmoveClock = 0;
    for (let idx = moves.length - 1; idx >= 0; idx--) {
      const move = moves[idx];
      const isCapture = move.indexOf('x') >= 0;
      const isPawnMove = this.isPawnMove(move);
      if (isCapture || isPawnMove) {
        return halfmoveClock;
      }
      halfmoveClock += 1;
    }
    return halfmoveClock;
  }

  private static toPiecePlacement(board: ChessPieceDto[][][]): string {
    if (!board || board.length < ChessConstants.BOARD_SIZE) {
      return '8/8/8/8/8/8/8/8';
    }

    const rows: string[] = [];
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      let emptyCount = 0;
      let fenRow = '';
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row] && board[row][col] ? board[row][col] : [];
        const piece = cell[0];
        if (!piece) {
          emptyCount += 1;
          continue;
        }
        if (emptyCount > 0) {
          fenRow += `${emptyCount}`;
          emptyCount = 0;
        }
        fenRow += this.toFenPieceChar(piece);
      }
      if (emptyCount > 0) {
        fenRow += `${emptyCount}`;
      }
      rows.push(fenRow || '8');
    }
    return rows.join('/');
  }

  private static toFenPieceChar(piece: ChessPieceDto): string {
    const upper = this.pieceToUpperLetter(piece.piece);
    if (!upper) {
      return '';
    }
    return piece.color === ChessColorsEnum.White ? upper : upper.toLowerCase();
  }

  private static pieceToUpperLetter(piece: ChessPiecesEnum): string {
    switch (piece) {
      case ChessPiecesEnum.King:
        return 'K';
      case ChessPiecesEnum.Queen:
        return 'Q';
      case ChessPiecesEnum.Rook:
        return 'R';
      case ChessPiecesEnum.Bishop:
        return 'B';
      case ChessPiecesEnum.Knight:
        return 'N';
      case ChessPiecesEnum.Pawn:
        return 'P';
      default:
        return '';
    }
  }

  private static normalizeCastlingRights(castlingRights: string): string {
    const normalized = (castlingRights || '').replace(/[^KQkq]/g, '');
    if (!normalized) {
      return '-';
    }

    const order = ['K', 'Q', 'k', 'q'];
    return order.filter(flag => normalized.indexOf(flag) >= 0).join('');
  }

  private static normalizeEnPassant(enPassantSquare: string): string {
    const normalized = (enPassantSquare || '-').trim();
    if (normalized === '-') {
      return '-';
    }
    return /^[a-h][1-8]$/.test(normalized) ? normalized : '-';
  }

  private static getMovesFromHistory(history: string[]): string[] {
    if (!history || history.length < 1) {
      return [];
    }
    return history
      .map(entry => this.extractMoveFromHistoryEntry(entry))
      .filter((entry): entry is string => !!entry);
  }

  private static extractMoveFromHistoryEntry(entry: string): string | null {
    const normalized = (entry || '').trim();
    if (!normalized) {
      return null;
    }

    let withoutResult = normalized.replace(/\s+(?:1-0|0-1|1\/2-1\/2)\s*\{[^}]*\}\s*$/u, '').trim();
    if (/^(?:1-0|0-1|1\/2-1\/2)(?:\s*\{[^}]*\})?$/u.test(withoutResult)) {
      return null;
    }
    if (!withoutResult) {
      withoutResult = normalized.replace(/\b(?:1-0|0-1|1\/2-1\/2)\b.*$/u, '').trim();
    }
    return withoutResult || null;
  }

  private static isPawnMove(move: string): boolean {
    if (!move || move.startsWith('O-O')) {
      return false;
    }
    const first = move.charAt(0);
    return first >= 'a' && first <= 'h';
  }
}
