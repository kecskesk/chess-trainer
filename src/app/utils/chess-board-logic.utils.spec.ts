import { ChessBoardStateService } from '../services/chess-board-state.service';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { IGameplaySnapshot } from '../model/interfaces/chess-board-gameplay-snapshot.interface';

function emptyBoard(): ChessPieceDto[][][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));
}

function boardWithKingsOnly(): ChessPieceDto[][][] {
  const board = emptyBoard();
  board[0][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
  board[7][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
  return board;
}

describe('ChessBoardLogicUtils', () => {
  it('returns fallback FEN when snapshot is missing', () => {
    expect(ChessBoardLogicUtils.generateFenFromSnapshot(null as any)).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
  });

  it('generates FEN from snapshot with missing history object', () => {
    const state = new ChessBoardStateService();
    const snapshot = {
      field: state.field,
      boardHelper: {
        debugText: '',
        history: undefined as any,
        colorTurn: ChessColorsEnum.White,
        canPromote: null,
        justDidEnPassant: null,
        justDidCastle: null,
        gameOver: false,
        checkmateColor: null
      }
    } as IGameplaySnapshot;

    const fen = ChessBoardLogicUtils.generateFenFromSnapshot(snapshot);
    expect(fen.startsWith('rnbqkbnr/pppppppp/')).toBeTrue();
    expect(fen).toContain(' w KQkq - 0 1');
  });

  it('clones fields and positions including null branches', () => {
    expect(ChessBoardLogicUtils.cloneField(null as any)).toEqual([]);
    expect(ChessBoardLogicUtils.clonePosition(null)).toBeNull();

    const board = emptyBoard();
    board[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    const cloned = ChessBoardLogicUtils.cloneField(board);
    expect(cloned[1][1][0]).not.toBe(board[1][1][0]);
    expect(cloned[1][1][0].piece).toBe(ChessPiecesEnum.Queen);

    const clonedPos = ChessBoardLogicUtils.clonePosition({ row: 2, col: 3 } as any);
    expect(clonedPos).toEqual({ row: 2, col: 3 });
  });

  it('counts pieces and builds position keys with null history fallback', () => {
    const board = emptyBoard();
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    board[3][3] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)];

    expect(ChessBoardLogicUtils.getCurrentPieceCount(board)).toBe(2);

    const keyWithHistory = ChessBoardLogicUtils.getPositionKey(board, ChessColorsEnum.White, {});
    expect(keyWithHistory).toContain('44:whiteknight');

    const keyWithNullHistory = ChessBoardLogicUtils.getPositionKey(board, ChessColorsEnum.Black, null as any);
    expect(typeof keyWithNullHistory).toBe('string');
    expect(keyWithNullHistory.startsWith('black|')).toBeTrue();
  });

  it('classifies non-pawn non-capture notation across all branches', () => {
    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('')).toBeFalse();
    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('e4')).toBeFalse();
    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('Nf3x')).toBeFalse();
    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('O-O')).toBeTrue();
    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('O-O-O')).toBeTrue();
    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('Ng1-f3')).toBeTrue();
    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('a3')).toBeFalse();
  });

  it('covers insufficient-material outcomes for all conditional branches', () => {
    const majorBoard = boardWithKingsOnly();
    majorBoard[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(majorBoard)).toBeFalse();

    const onlyKings = boardWithKingsOnly();
    expect(ChessBoardLogicUtils.isInsufficientMaterial(onlyKings)).toBeTrue();

    const singleMinor = boardWithKingsOnly();
    singleMinor[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(singleMinor)).toBeTrue();

    const oneMinorEach = boardWithKingsOnly();
    oneMinorEach[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];
    oneMinorEach[6][6] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(oneMinorEach)).toBeTrue();

    const twoWhiteKnights = boardWithKingsOnly();
    twoWhiteKnights[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    twoWhiteKnights[1][2] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(twoWhiteKnights)).toBeTrue();

    const twoBlackKnights = boardWithKingsOnly();
    twoBlackKnights[6][6] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)];
    twoBlackKnights[6][5] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(twoBlackKnights)).toBeTrue();

    const bishopKnightSameSide = boardWithKingsOnly();
    bishopKnightSameSide[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];
    bishopKnightSameSide[1][2] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(bishopKnightSameSide)).toBeFalse();

    const threeMinors = boardWithKingsOnly();
    threeMinors[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    threeMinors[1][2] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    threeMinors[6][6] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(threeMinors)).toBeFalse();
  });
});
