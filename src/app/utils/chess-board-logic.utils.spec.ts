import { ChessBoardStateService } from '../services/chess-board-state.service';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { IGameplaySnapshot } from '../model/interfaces/chess-board-gameplay-snapshot.interface';
import { ChessRulesService } from '../services/chess-rules.service';

function emptyBoard(): ChessPieceDto[][][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));
}

function boardWithKingsOnly(): ChessPieceDto[][][] {
  const board = emptyBoard();
  board[0][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
  board[7][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
  return board;
}

describe('ChessBoardLogicUtils snapshot and cloning', () => {
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

  it('delegates cloneBoard to cloneField', () => {
    const board = emptyBoard();
    board[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    const cloned = ChessBoardLogicUtils.cloneBoard(board);
    expect(cloned[1][1][0]).not.toBe(board[1][1][0]);
  });
});

describe('ChessBoardLogicUtils position keys and notation helpers', () => {
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

describe('ChessBoardLogicUtils move legality and simulation', () => {
  it('finds kings and evaluates check states with default and custom attack fn', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[7][0] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const whiteKing = ChessBoardLogicUtils.findKing(board, ChessColorsEnum.White);
    const blackKing = ChessBoardLogicUtils.findKing(board, ChessColorsEnum.Black);
    expect(whiteKing?.row).toBe(7);
    expect(whiteKing?.col).toBe(4);
    expect(blackKing?.row).toBe(0);
    expect(blackKing?.col).toBe(4);

    expect(ChessBoardLogicUtils.isKingInCheck(board, ChessColorsEnum.White)).toBeFalse();
    expect(ChessBoardLogicUtils.isKingInCheck(
      board,
      ChessColorsEnum.White,
      (targetRow, targetCol, _targetCell, sourceRow, sourceCol) =>
        sourceRow === 7 && sourceCol === 0 && targetRow === 7 && targetCol === 4
    )).toBeTrue();
    expect(ChessBoardLogicUtils.isKingInCheck(board, ChessColorsEnum.White, () => false)).toBeFalse();
    expect(ChessBoardLogicUtils.isKingInCheck(emptyBoard(), ChessColorsEnum.White)).toBeFalse();
  });

  it('detects legal-move availability with callback and default simulation paths', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[6][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    const hasLegal = ChessBoardLogicUtils.hasAnyLegalMove(
      board,
      ChessColorsEnum.White,
      (targetRow, targetCol, _targetCell, srcRow, srcCol) => srcRow === 6 && srcCol === 4 && targetRow === 5 && targetCol === 4,
      (b, srcRow, srcCol, targetRow, targetCol) => ChessBoardLogicUtils.simulateMove(b, srcRow, srcCol, targetRow, targetCol)
    );
    expect(hasLegal).toBeTrue();

    const hasNoLegal = ChessBoardLogicUtils.hasAnyLegalMove(
      board,
      ChessColorsEnum.White,
      () => false
    );
    expect(hasNoLegal).toBeFalse();
  });

  it('simulates normal moves, en-passant, castling, promotion and empty-source guard', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[3][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    board[3][5] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];

    const enPassant = ChessBoardLogicUtils.simulateMove(board, 3, 4, 2, 5);
    expect(enPassant[3][5]).toEqual([]);
    expect(enPassant[2][5][0].piece).toBe(ChessPiecesEnum.Pawn);

    const castled = ChessBoardLogicUtils.simulateMove(board, 7, 4, 7, 6);
    expect(castled[7][6][0].piece).toBe(ChessPiecesEnum.King);
    expect(castled[7][5][0].piece).toBe(ChessPiecesEnum.Rook);

    const promotionBoard = emptyBoard();
    promotionBoard[1][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    promotionBoard[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    promotionBoard[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    const promoted = ChessBoardLogicUtils.simulateMove(promotionBoard, 1, 0, 0, 0);
    expect(promoted[0][0][0].piece).toBe(ChessPiecesEnum.Queen);

    const unchanged = ChessBoardLogicUtils.simulateMove(promotionBoard, 4, 4, 4, 5);
    expect(unchanged[4][4]).toEqual([]);
    expect(unchanged[4][5]).toEqual([]);
  });
});

describe('ChessBoardLogicUtils legal move evaluation branches', () => {
  it('checks board bounds and legal-play filtering', () => {
    expect(ChessBoardLogicUtils.isWithinBoard(0, 0)).toBeTrue();
    expect(ChessBoardLogicUtils.isWithinBoard(-1, 0)).toBeFalse();
    expect(ChessBoardLogicUtils.isWithinBoard(0, 8)).toBeFalse();

    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[6][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    const source = new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn);
    const legal = ChessBoardLogicUtils.canPlayLegalMove(
      board,
      6,
      4,
      5,
      4,
      ChessColorsEnum.White,
      source,
      (targetRow, targetCol) => targetRow === 5 && targetCol === 4,
      (b, srcRow, srcCol, targetRow, targetCol) => ChessBoardLogicUtils.simulateMove(b, srcRow, srcCol, targetRow, targetCol)
    );
    expect(legal).toBeTrue();

    const illegal = ChessBoardLogicUtils.canPlayLegalMove(
      board,
      6,
      4,
      5,
      4,
      ChessColorsEnum.White,
      source,
      () => false
    );
    expect(illegal).toBeFalse();
  });

  it('covers default canStepThere/simulateMove branches in legal-move helpers', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[6][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    const stepSpy = spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol, _targetCell, srcRow, srcCol) =>
      srcRow === 6 && srcCol === 4 && targetRow === 5 && targetCol === 4
    );
    const simulateSpy = spyOn(ChessBoardLogicUtils, 'simulateMove').and.callFake((b, srcRow, srcCol, targetRow, targetCol) => {
      const cloned = ChessBoardLogicUtils.cloneField(b);
      cloned[srcRow][srcCol] = [];
      cloned[targetRow][targetCol] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
      return cloned;
    });

    expect(ChessBoardLogicUtils.hasAnyLegalMove(board, ChessColorsEnum.White)).toBeTrue();
    expect(stepSpy).toHaveBeenCalled();
    expect(simulateSpy).toHaveBeenCalled();

    const playable = ChessBoardLogicUtils.canPlayLegalMove(
      board,
      6,
      4,
      5,
      4,
      ChessColorsEnum.White,
      new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)
    );
    expect(playable).toBeTrue();
  });
});
