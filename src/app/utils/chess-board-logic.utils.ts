import { ChessConstants } from '../constants/chess.constants';
import { ChessPositionDto } from '../model/chess-position.dto';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { IGameplaySnapshot } from '../model/interfaces/chess-board-gameplay-snapshot.interface';
import { ChessRulesService } from '../services/chess-rules.service';
import { ChessFenUtils } from './chess-fen.utils';
import { ChessMoveNotation } from './chess-utils';

export class ChessBoardLogicUtils {
  static generateFenFromSnapshot(snapshot: IGameplaySnapshot): string {
    if (!(snapshot && snapshot.boardHelper && snapshot.field)) {
      return '8/8/8/8/8/8/8/8 w - - 0 1';
    }
    const historyEntries = snapshot.boardHelper.history || {};
    const history = Object.values(historyEntries);
    const castlingRights = ChessRulesService.getCastlingRightsNotation(snapshot.field, historyEntries);
    const enPassantRights = ChessRulesService.getEnPassantRightsNotation(
      snapshot.field,
      historyEntries,
      snapshot.boardHelper.colorTurn
    );
    const plyCount = ChessFenUtils.getPlyCountFromHistory(history);
    const fullmoveNumber = ChessFenUtils.getFullmoveNumberFromPlyCount(plyCount);
    const halfmoveClock = ChessFenUtils.getHalfmoveClockFromHistory(history);
    return ChessFenUtils.generateFen(
      snapshot.field,
      snapshot.boardHelper.colorTurn,
      castlingRights,
      enPassantRights,
      halfmoveClock,
      fullmoveNumber
    );
  }

  static cloneField(field: ChessPieceDto[][][]): ChessPieceDto[][][] {
    if (!field) {
      return [];
    }
    return field.map(row => row.map(cell => {
      if (!(cell && cell[0])) {
        return [];
      }
      return [new ChessPieceDto(cell[0].color, cell[0].piece)];
    }));
  }

  static clonePosition(position: ChessPositionDto | null): ChessPositionDto | null {
    if (!position) {
      return null;
    }
    return { row: position.row, col: position.col };
  }

  static getCurrentPieceCount(field: ChessPieceDto[][][]): number {
    let totalPieces = 0;
    field.forEach(row => {
      row.forEach(cell => {
        if (cell && cell[0]) {
          totalPieces += 1;
        }
      });
    });
    return totalPieces;
  }

  static getPositionKey(board: ChessPieceDto[][][], turn: ChessColorsEnum, history: {[name: string]: string}): string {
    const squares: string[] = [];
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (!(cell && cell[0])) {
          continue;
        }
        const piece = cell[0];
        squares.push(`${row}${col}:${piece.color}${piece.piece}`);
      }
    }
    const castlingRights = ChessRulesService.getCastlingRightsNotation(board, history);
    const enPassantRights = ChessRulesService.getEnPassantRightsNotation(board, history, turn);
    return `${turn}|${castlingRights}|${enPassantRights}|${squares.join('|')}`;
  }

  static isNonPawnNonCaptureMove(notation: string): boolean {
    if (!notation || !ChessMoveNotation.isValidLongNotation(notation) || notation.includes('x')) {
      return false;
    }

    if (notation === 'O-O' || notation === 'O-O-O') {
      return true;
    }

    const pieceMovePrefix = notation.charAt(0);
    return pieceMovePrefix === 'K' || pieceMovePrefix === 'Q' || pieceMovePrefix === 'R' ||
      pieceMovePrefix === 'B' || pieceMovePrefix === 'N';
  }

  static isInsufficientMaterial(board: ChessPieceDto[][][]): boolean {
    const whiteMinorPieces: {piece: ChessPiecesEnum, row: number, col: number}[] = [];
    const blackMinorPieces: {piece: ChessPiecesEnum, row: number, col: number}[] = [];
    let whiteHasMajorOrPawn = false;
    let blackHasMajorOrPawn = false;

    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (!(cell && cell[0])) {
          continue;
        }
        const piece = cell[0];
        if (piece.piece === ChessPiecesEnum.King) {
          continue;
        }
        const isMinorPiece = piece.piece === ChessPiecesEnum.Bishop || piece.piece === ChessPiecesEnum.Knight;
        if (!isMinorPiece) {
          if (piece.color === ChessColorsEnum.White) {
            whiteHasMajorOrPawn = true;
          } else {
            blackHasMajorOrPawn = true;
          }
          continue;
        }
        if (piece.color === ChessColorsEnum.White) {
          whiteMinorPieces.push({ piece: piece.piece, row, col });
        } else {
          blackMinorPieces.push({ piece: piece.piece, row, col });
        }
      }
    }

    if (whiteHasMajorOrPawn || blackHasMajorOrPawn) {
      return false;
    }

    const totalMinorCount = whiteMinorPieces.length + blackMinorPieces.length;
    if (totalMinorCount === 0 || totalMinorCount === 1) {
      return true;
    }

    if (totalMinorCount === 2) {
      if (whiteMinorPieces.length === 1 && blackMinorPieces.length === 1) {
        return true;
      }
      const sameSideMinorPieces = whiteMinorPieces.concat(blackMinorPieces);
      return sameSideMinorPieces.every(minorPiece => minorPiece.piece === ChessPiecesEnum.Knight);
    }

    return false;
  }
}
