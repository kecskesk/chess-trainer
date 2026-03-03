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

  static findKing(board: ChessPieceDto[][][], color: ChessColorsEnum): ChessPositionDto | null {
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (cell && cell[0] && cell[0].color === color && cell[0].piece === ChessPiecesEnum.King) {
          return new ChessPositionDto(row, col);
        }
      }
    }
    return null;
  }

  static isKingInCheck(
    board: ChessPieceDto[][][],
    kingColor: ChessColorsEnum,
    canStepThereFn?: (
      targetRow: number,
      targetCol: number,
      targetCell: ChessPieceDto[],
      sourceRow: number,
      sourceCol: number,
      sourcePiece: ChessPieceDto
    ) => boolean
  ): boolean {
    const king = ChessBoardLogicUtils.findKing(board, kingColor);
    if (!king) {
      return false;
    }
    const attackerColor = kingColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const attackerCell = board[row][col];
        if (!(attackerCell && attackerCell[0] && attackerCell[0].color === attackerColor)) {
          continue;
        }
        const attacker = attackerCell[0];
        
        let canHitKing: boolean;
        if (canStepThereFn) {
          canHitKing = canStepThereFn(
            king.row,
            king.col,
            [new ChessPieceDto(kingColor, ChessPiecesEnum.King)],
            row,
            col,
            new ChessPieceDto(attacker.color, attacker.piece)
          );
        } else {
          canHitKing = ChessRulesService.canStepThere(
            king.row,
            king.col,
            [new ChessPieceDto(kingColor, ChessPiecesEnum.King)],
            row,
            col,
            new ChessPieceDto(attacker.color, attacker.piece)
          );
        }
        if (canHitKing) {
          return true;
        }
      }
    }
    return false;
  }

  static hasAnyLegalMove(
    board: ChessPieceDto[][][],
    forColor: ChessColorsEnum,
    canStepThereFn?: (
      targetRow: number,
      targetCol: number,
      targetCell: ChessPieceDto[],
      srcRow: number,
      srcCol: number,
      sourcePiece: ChessPieceDto
    ) => boolean,
    simulateMoveFn?: (
      board: ChessPieceDto[][][],
      srcRow: number,
      srcCol: number,
      targetRow: number,
      targetCol: number
    ) => ChessPieceDto[][][]
  ): boolean {
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === forColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
          for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }
            
            let canMove: boolean;
            if (canStepThereFn) {
              canMove = canStepThereFn(
                targetRow,
                targetCol,
                board[targetRow][targetCol],
                srcRow,
                srcCol,
                new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
              );
            } else {
              canMove = ChessRulesService.canStepThere(
                targetRow,
                targetCol,
                board[targetRow][targetCol],
                srcRow,
                srcCol,
                new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
              );
            }
            if (!canMove) {
              continue;
            }
            
            let afterMove: ChessPieceDto[][][];
            if (simulateMoveFn) {
              afterMove = simulateMoveFn(board, srcRow, srcCol, targetRow, targetCol);
            } else {
              afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
            }
            if (!ChessBoardLogicUtils.isKingInCheck(afterMove, forColor)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  static simulateMove(
    board: ChessPieceDto[][][],
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number
  ): ChessPieceDto[][][] {
    const nextBoard = ChessBoardLogicUtils.cloneField(board);
    const movingPiece = nextBoard[srcRow][srcCol] && nextBoard[srcRow][srcCol][0]
      ? new ChessPieceDto(nextBoard[srcRow][srcCol][0].color, nextBoard[srcRow][srcCol][0].piece)
      : null;
    if (!movingPiece) {
      return nextBoard;
    }

    if (movingPiece.piece === ChessPiecesEnum.Pawn && srcCol !== targetCol && nextBoard[targetRow][targetCol].length < 1) {
      nextBoard[srcRow][targetCol] = [];
    }

    nextBoard[srcRow][srcCol] = [];
    nextBoard[targetRow][targetCol] = [movingPiece];

    if (movingPiece.piece === ChessPiecesEnum.King && srcRow === targetRow && Math.abs(targetCol - srcCol) === 2) {
      const isKingSideCastle = targetCol > srcCol;
      const rookSourceCol = isKingSideCastle ? 7 : 0;
      const rookTargetCol = isKingSideCastle ? 5 : 3;
      const rookCell = nextBoard[targetRow][rookSourceCol];
      if (rookCell && rookCell[0] && rookCell[0].piece === ChessPiecesEnum.Rook) {
        const rook = new ChessPieceDto(rookCell[0].color, rookCell[0].piece);
        nextBoard[targetRow][rookSourceCol] = [];
        nextBoard[targetRow][rookTargetCol] = [rook];
      }
    }

    const promotionRow = movingPiece.color === ChessColorsEnum.White ? ChessConstants.MIN_INDEX : ChessConstants.MAX_INDEX;
    if (movingPiece.piece === ChessPiecesEnum.Pawn && targetRow === promotionRow) {
      nextBoard[targetRow][targetCol][0].piece = ChessPiecesEnum.Queen;
    }

    return nextBoard;
  }

  static isWithinBoard(row: number, col: number): boolean {
    return row >= ChessConstants.MIN_INDEX
      && row <= ChessConstants.MAX_INDEX
      && col >= ChessConstants.MIN_INDEX
      && col <= ChessConstants.MAX_INDEX;
  }

  static canPlayLegalMove(
    board: ChessPieceDto[][][],
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number,
    forColor: ChessColorsEnum,
    sourcePiece: ChessPieceDto,
    canStepThereFn?: (
      targetRow: number,
      targetCol: number,
      targetCell: ChessPieceDto[],
      srcRow: number,
      srcCol: number,
      sourcePiece: ChessPieceDto
    ) => boolean,
    simulateMoveFn?: (
      board: ChessPieceDto[][][],
      srcRow: number,
      srcCol: number,
      targetRow: number,
      targetCol: number
    ) => ChessPieceDto[][][]
  ): boolean {
    const targetCell = board[targetRow][targetCol];
    
    let canStepThere: boolean;
    if (canStepThereFn) {
      canStepThere = canStepThereFn(
        targetRow,
        targetCol,
        targetCell,
        srcRow,
        srcCol,
        new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
      );
    } else {
      canStepThere = ChessRulesService.canStepThere(
        targetRow,
        targetCol,
        targetCell,
        srcRow,
        srcCol,
        new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
      );
    }
    if (!canStepThere) {
      return false;
    }

    let afterMove: ChessPieceDto[][][];
    if (simulateMoveFn) {
      afterMove = simulateMoveFn(board, srcRow, srcCol, targetRow, targetCol);
    } else {
      afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
    }
    return !ChessBoardLogicUtils.isKingInCheck(afterMove, forColor);
  }
}
