import { ChessRulesService } from './chess-rules.service';
import { ChessBoardStateService } from './chess-board-state.service';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

describe('ChessRulesService instantiation', () => {
  it('creates service instance', () => {
    expect(new ChessRulesService()).toBeTruthy();
  });
});
describe('ChessRulesService pawn captures', () => {
  let chessBoardStateService: ChessBoardStateService;

  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('allows white pawn capture from d4 to e5 after d2d4 and e7e5 board state', () => {
    chessBoardStateService.field[6][3] = [];
    chessBoardStateService.field[4][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    chessBoardStateService.field[1][4] = [];
    chessBoardStateService.field[3][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];

    const target = chessBoardStateService.field[3][4];
    const canCapture = ChessRulesService.canStepThere(3, 4, target, 4, 3);

    expect(canCapture).toBeTrue();
    expect(chessBoardStateService.boardHelper.hits['34']).toEqual({ row: 3, col: 4 });
  });

  it('does not allow white pawn to move diagonally to empty square (without en passant)', () => {
    chessBoardStateService.field[6][3] = [];
    chessBoardStateService.field[4][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    chessBoardStateService.field[3][4] = [];

    const canMoveDiagonallyToEmpty = ChessRulesService.canStepThere(3, 4, chessBoardStateService.field[3][4], 4, 3);

    expect(canMoveDiagonallyToEmpty).toBeFalse();
  });
});

describe('ChessRulesService castling', () => {
  let chessBoardStateService: ChessBoardStateService;

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
  };

  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    chessBoardStateService.boardHelper.history = {};
    chessBoardStateService.boardHelper.justDidCastle = null;
    clearBoard();
    chessBoardStateService.field[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    chessBoardStateService.field[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
  });

  it('allows kingside castling when king and rook are unmoved and path is clear/safe', () => {
    chessBoardStateService.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(7, 6, chessBoardStateService.field[7][6], 7, 4);

    expect(canCastle).toBeTrue();
    expect(chessBoardStateService.boardHelper.justDidCastle).toEqual({ row: 7, col: 6 });
  });

  it('does not allow castling if king has moved earlier', () => {
    chessBoardStateService.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    chessBoardStateService.boardHelper.history = { 1: 'Ke1e2', 2: 'Ke8e7' };

    const canCastle = ChessRulesService.canStepThere(7, 6, chessBoardStateService.field[7][6], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow castling while king is in check', () => {
    chessBoardStateService.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[5][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(7, 6, chessBoardStateService.field[7][6], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow castling through an attacked square', () => {
    chessBoardStateService.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[0][5] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(7, 6, chessBoardStateService.field[7][6], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow castling into check', () => {
    chessBoardStateService.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[0][6] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(7, 6, chessBoardStateService.field[7][6], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow queenside castling when b-file is occupied', () => {
    chessBoardStateService.field[7][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[7][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];

    const canCastle = ChessRulesService.canStepThere(7, 2, chessBoardStateService.field[7][2], 7, 4);

    expect(canCastle).toBeFalse();
  });

});

describe('ChessRulesService castling (black side)', () => {
  let chessBoardStateService: ChessBoardStateService;

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
  };

  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    chessBoardStateService.boardHelper.history = {};
    chessBoardStateService.boardHelper.justDidCastle = null;
    clearBoard();
    chessBoardStateService.field[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    chessBoardStateService.field[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
  });

  it('allows black kingside castling when king and rook are unmoved and path is clear/safe', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(0, 6, chessBoardStateService.field[0][6], 0, 4);

    expect(canCastle).toBeTrue();
    expect(chessBoardStateService.boardHelper.justDidCastle).toEqual({ row: 0, col: 6 });
  });

  it('does not allow black castling through an attacked square', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[3][5] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(0, 6, chessBoardStateService.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black castling if king has moved earlier', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    chessBoardStateService.boardHelper.history = { 1: 'Ke1e2', 2: 'Ke8e7' };

    const canCastle = ChessRulesService.canStepThere(0, 6, chessBoardStateService.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black castling if rook has moved earlier', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    chessBoardStateService.boardHelper.history = { 1: 'Ke1e2', 2: 'Rh8h7' };

    const canCastle = ChessRulesService.canStepThere(0, 6, chessBoardStateService.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black castling while king is in check', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[3][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(0, 6, chessBoardStateService.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black castling into check', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[7][6] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(0, 6, chessBoardStateService.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black queenside castling when b-file is occupied', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.field[0][0] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[0][1] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)];

    const canCastle = ChessRulesService.canStepThere(0, 2, chessBoardStateService.field[0][2], 0, 4);

    expect(canCastle).toBeFalse();
  });
});

describe('ChessRulesService king safety', () => {
  let chessBoardStateService: ChessBoardStateService;

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
  };

  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    clearBoard();
    chessBoardStateService.field[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    chessBoardStateService.field[0][0] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
  });

  it('does not allow moving a pinned piece that would expose own king to check', () => {
    chessBoardStateService.field[6][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const isValid = ChessRulesService.validateMove(6, 5, chessBoardStateService.field[6][5], 6, 4).isValid;

    expect(isValid).toBeFalse();
  });
});

describe('ChessRulesService branch coverage helpers', () => {
  let chessBoardStateService: ChessBoardStateService;

  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
  });

  it('returns invalid validation when source square has no piece', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    const result = ChessRulesService.validateMove(4, 4, chessBoardStateService.field[4][4], 4, 4);

    expect(result.isValid).toBeFalse();
    expect(result.isEnemyPiece).toBeFalse();
    expect(result.isEmptyTarget).toBeTrue();
  });

  it('accepts unknown piece enum in valueOfPiece default branch', () => {
    expect(ChessRulesService.valueOfPiece(ChessPiecesEnum.Knight)).toBe(3);
    expect(ChessRulesService.valueOfPiece('Unknown' as any)).toBeUndefined();
  });

  it('handles unknown source piece in canStepThere default switch branch', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    const canStep = ChessRulesService.canStepThere(
      4,
      4,
      chessBoardStateService.field[4][4],
      6,
      4,
      new ChessPieceDto(ChessColorsEnum.White, 'Dragon' as any)
    );

    expect(canStep).toBeTrue();
  });

  it('covers bishop notation parsing path through en-passant rights calculation', () => {
    const board = chessBoardStateService.field;
    const enPassant = ChessRulesService.getEnPassantRightsNotation(
      board,
      { 1: 'Bc1-e3' },
      ChessColorsEnum.Black
    );

    expect(enPassant).toBe('-');
  });

  it('simulates queenside castle king move path during legality check', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    chessBoardStateService.boardHelper.history = {};
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
    chessBoardStateService.field[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    chessBoardStateService.field[7][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];

    const canCastleQueenSide = ChessRulesService.canStepThere(7, 2, chessBoardStateService.field[7][2], 7, 4);

    expect(canCastleQueenSide).toBeTrue();
    expect(chessBoardStateService.boardHelper.justDidCastle).toEqual({ row: 7, col: 2 });
  });

  it('returns unchanged board when simulating a move from empty source square', () => {
    const emptyBoard = chessBoardStateService.field.map(row => row.map(() => []));
    const simulated = (ChessRulesService as any).simulateMoveOnBoard(emptyBoard, 4, 4, 4, 5);

    expect(simulated[4][4]).toEqual([]);
    expect(simulated[4][5]).toEqual([]);
  });

  it('returns null errorMessage for a valid move in validateMove', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    const result = ChessRulesService.validateMove(4, 4, chessBoardStateService.field[4][4], 6, 4);

    expect(result.isValid).toBeTrue();
    expect(result.errorMessage).toBeNull();
  });

});

describe('ChessRulesService branch coverage helpers (notation and context)', () => {
  let chessBoardStateService: ChessBoardStateService;

  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
  });

  it('returns dash castling rights when board is missing', () => {
    const rights = ChessRulesService.getCastlingRightsNotation(null as any, {});
    expect(rights).toBe('-');
  });

  it('removes black castling rights after black has castled in history', () => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
    chessBoardStateService.field[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    chessBoardStateService.field[0][0] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    chessBoardStateService.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const rights = ChessRulesService.getCastlingRightsNotation(
      chessBoardStateService.field,
      { 2: 'O-O' }
    );

    expect(rights).not.toContain('k');
    expect(rights).not.toContain('q');
  });

  it('returns en-passant target when last move enables capture', () => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
    chessBoardStateService.field[3][3] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];
    chessBoardStateService.field[3][2] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    const ep = ChessRulesService.getEnPassantRightsNotation(
      chessBoardStateService.field,
      { 2: 'd7-d5' },
      ChessColorsEnum.White
    );

    expect(ep).toBe('d6');
  });

  it('returns dash en-passant rights when turn does not match capturing side', () => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
    chessBoardStateService.field[3][3] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];
    chessBoardStateService.field[3][2] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    const ep = ChessRulesService.getEnPassantRightsNotation(
      chessBoardStateService.field,
      { 2: 'd7-d5' },
      ChessColorsEnum.Black
    );

    expect(ep).toBe('-');
  });

  it('handles withBoardContext when BOARD_HELPER is temporarily null', () => {
    const previousHelper = ChessBoardStateService.BOARD_HELPER;
    try {
      ChessBoardStateService.BOARD_HELPER = null as any;
      const board = chessBoardStateService.field;
      const result = (ChessRulesService as any).withBoardContext(board, ChessColorsEnum.White, () => 'ok');
      expect(result).toBe('ok');
    } finally {
      ChessBoardStateService.BOARD_HELPER = previousHelper;
    }
  });
});

