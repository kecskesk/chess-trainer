import { ChessConstants } from '../constants/chess.constants';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ICctRecommendation, ICctRecommendationScored } from '../model/interfaces/cct-recommendation.interface';

export class ChessBoardCctUtils {
  static parseSuggestedMove(move: string): { piece: ChessPiecesEnum, targetRow: number, targetCol: number } | null {
    const normalized = move.replace(/^\.\.\./, '').replace(/[+#?!]/g, '');
    const targetMatch = normalized.match(/([a-h][1-8])$/);
    if (!targetMatch) {
      return null;
    }

    const targetSquare = targetMatch[1];
    const fileChar = targetSquare.charAt(0);
    const rankChar = targetSquare.charAt(1);
    const targetCol = fileChar.charCodeAt(0) - 'a'.charCodeAt(0);
    const targetRow = ChessConstants.BOARD_SIZE - Number(rankChar);
    if (targetCol < ChessConstants.MIN_INDEX || targetCol > ChessConstants.MAX_INDEX ||
      targetRow < ChessConstants.MIN_INDEX || targetRow > ChessConstants.MAX_INDEX) {
      return null;
    }

    const pieceChar = normalized.charAt(0);
    let piece = ChessPiecesEnum.Pawn;
    if (pieceChar === 'K') {
      piece = ChessPiecesEnum.King;
    } else if (pieceChar === 'Q') {
      piece = ChessPiecesEnum.Queen;
    } else if (pieceChar === 'R') {
      piece = ChessPiecesEnum.Rook;
    } else if (pieceChar === 'B') {
      piece = ChessPiecesEnum.Bishop;
    } else if (pieceChar === 'N') {
      piece = ChessPiecesEnum.Knight;
    }

    return { piece, targetRow, targetCol };
  }

  static pickTopRecommendations(items: ICctRecommendationScored[]): ICctRecommendation[] {
    const bestByMove: {[move: string]: ICctRecommendationScored} = {};
    items.forEach(item => {
      const existing = bestByMove[item.move];
      if (!existing || item.score > existing.score) {
        bestByMove[item.move] = item;
      }
    });

    return Object.values(bestByMove)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => ({ move: item.move, tooltip: item.tooltip }));
  }

  static getThreatenedEnemyPiecesByMovedPiece(
    board: ChessPieceDto[][][],
    sourceRow: number,
    sourceCol: number,
    attackerColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum,
    canAttack: (
      targetRow: number,
      targetCol: number,
      targetCell: ChessPieceDto[],
      sourceRowArg: number,
      sourceColArg: number,
      sourcePiece: ChessPieceDto,
      attackerColorArg: ChessColorsEnum
    ) => boolean
  ): ChessPiecesEnum[] {
    const sourceCell = board[sourceRow][sourceCol];
    if (!(sourceCell && sourceCell[0])) {
      return [];
    }

    const sourcePiece = sourceCell[0];
    const threatenedPieces: ChessPiecesEnum[] = [];
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        const targetCell = board[targetRow][targetCol];
        if (!(targetCell && targetCell[0] && targetCell[0].color === enemyColor)) {
          continue;
        }

        if (canAttack(targetRow, targetCol, targetCell, sourceRow, sourceCol, sourcePiece, attackerColor)) {
          threatenedPieces.push(targetCell[0].piece);
        }
      }
    }

    return threatenedPieces;
  }

  static formatCctMove(
    piece: ChessPiecesEnum,
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number,
    isCapture: boolean,
    isCheck: boolean
  ): string {
    const to = this.toAlgebraicSquare(targetRow, targetCol);
    const pieceNotation = this.pieceNotation(piece);
    let notation = '';

    if (piece === ChessPiecesEnum.Pawn) {
      const from = this.toAlgebraicSquare(srcRow, srcCol);
      notation = isCapture ? `${from.charAt(0)}x${to}` : to;
    } else {
      notation = `${pieceNotation}${isCapture ? 'x' : ''}${to}`;
    }

    if (isCheck) {
      notation += '+';
    }

    return notation;
  }

  static toAlgebraicSquare(row: number, col: number): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + col);
    const rank = ChessConstants.BOARD_SIZE - row;
    return `${file}${rank}`;
  }

  static pieceNotation(piece: ChessPiecesEnum): string {
    if (piece === ChessPiecesEnum.King) {
      return 'K';
    }
    if (piece === ChessPiecesEnum.Queen) {
      return 'Q';
    }
    if (piece === ChessPiecesEnum.Rook) {
      return 'R';
    }
    if (piece === ChessPiecesEnum.Bishop) {
      return 'B';
    }
    if (piece === ChessPiecesEnum.Knight) {
      return 'N';
    }
    return '';
  }

  static pieceName(piece: ChessPiecesEnum): string {
    if (piece === ChessPiecesEnum.King) {
      return 'king';
    }
    if (piece === ChessPiecesEnum.Queen) {
      return 'queen';
    }
    if (piece === ChessPiecesEnum.Rook) {
      return 'rook';
    }
    if (piece === ChessPiecesEnum.Bishop) {
      return 'bishop';
    }
    if (piece === ChessPiecesEnum.Knight) {
      return 'knight';
    }
    return 'pawn';
  }
}
