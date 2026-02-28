import { ChessRulesService } from './chess-rules.service';
import { GlobalVariablesService } from './global-variables.service';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

describe('ChessRulesService instantiation', () => {
  it('creates service instance', () => {
    expect(new ChessRulesService()).toBeTruthy();
  });
});

describe('ChessRulesService pawn captures', () => {
  let globals: GlobalVariablesService;

  beforeEach(() => {
    globals = new GlobalVariablesService();
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('allows white pawn capture from d4 to e5 after d2d4 and e7e5 board state', () => {
    globals.field[6][3] = [];
    globals.field[4][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    globals.field[1][4] = [];
    globals.field[3][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];

    const target = globals.field[3][4];
    const canCapture = ChessRulesService.canStepThere(3, 4, target, 4, 3);

    expect(canCapture).toBeTrue();
    expect(globals.boardHelper.hits['34']).toEqual({ row: 3, col: 4 });
  });

  it('does not allow white pawn to move diagonally to empty square (without en passant)', () => {
    globals.field[6][3] = [];
    globals.field[4][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    globals.field[3][4] = [];

    const canMoveDiagonallyToEmpty = ChessRulesService.canStepThere(3, 4, globals.field[3][4], 4, 3);

    expect(canMoveDiagonallyToEmpty).toBeFalse();
  });
});

describe('ChessRulesService castling', () => {
  let globals: GlobalVariablesService;

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        globals.field[row][col] = [];
      }
    }
  };

  beforeEach(() => {
    globals = new GlobalVariablesService();
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
    globals.boardHelper.history = {};
    globals.boardHelper.justDidCastle = null;
    clearBoard();
    globals.field[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    globals.field[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
  });

  it('allows kingside castling when king and rook are unmoved and path is clear/safe', () => {
    globals.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(7, 6, globals.field[7][6], 7, 4);

    expect(canCastle).toBeTrue();
    expect(globals.boardHelper.justDidCastle).toEqual({ row: 7, col: 6 });
  });

  it('does not allow castling if king has moved earlier', () => {
    globals.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    globals.boardHelper.history = { 1: 'Ke1e2', 2: 'Ke8e7' };

    const canCastle = ChessRulesService.canStepThere(7, 6, globals.field[7][6], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow castling while king is in check', () => {
    globals.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    globals.field[5][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(7, 6, globals.field[7][6], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow castling through an attacked square', () => {
    globals.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    globals.field[0][5] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(7, 6, globals.field[7][6], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow castling into check', () => {
    globals.field[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    globals.field[0][6] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(7, 6, globals.field[7][6], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow queenside castling when b-file is occupied', () => {
    globals.field[7][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    globals.field[7][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];

    const canCastle = ChessRulesService.canStepThere(7, 2, globals.field[7][2], 7, 4);

    expect(canCastle).toBeFalse();
  });

  it('allows black kingside castling when king and rook are unmoved and path is clear/safe', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(0, 6, globals.field[0][6], 0, 4);

    expect(canCastle).toBeTrue();
    expect(globals.boardHelper.justDidCastle).toEqual({ row: 0, col: 6 });
  });

  it('does not allow black castling through an attacked square', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    globals.field[3][5] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(0, 6, globals.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black castling if king has moved earlier', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    globals.boardHelper.history = { 1: 'Ke1e2', 2: 'Ke8e7' };

    const canCastle = ChessRulesService.canStepThere(0, 6, globals.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black castling if rook has moved earlier', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    globals.boardHelper.history = { 1: 'Ke1e2', 2: 'Rh8h7' };

    const canCastle = ChessRulesService.canStepThere(0, 6, globals.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black castling while king is in check', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    globals.field[3][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(0, 6, globals.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black castling into check', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.field[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    globals.field[7][6] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const canCastle = ChessRulesService.canStepThere(0, 6, globals.field[0][6], 0, 4);

    expect(canCastle).toBeFalse();
  });

  it('does not allow black queenside castling when b-file is occupied', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.field[0][0] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    globals.field[0][1] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)];

    const canCastle = ChessRulesService.canStepThere(0, 2, globals.field[0][2], 0, 4);

    expect(canCastle).toBeFalse();
  });
});

describe('ChessRulesService king safety', () => {
  let globals: GlobalVariablesService;

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        globals.field[row][col] = [];
      }
    }
  };

  beforeEach(() => {
    globals = new GlobalVariablesService();
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
    clearBoard();
    globals.field[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    globals.field[0][0] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
  });

  it('does not allow moving a pinned piece that would expose own king to check', () => {
    globals.field[6][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    globals.field[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    const isValid = ChessRulesService.validateMove(6, 5, globals.field[6][5], 6, 4).isValid;

    expect(isValid).toBeFalse();
  });
});

describe('ChessRulesService branch coverage helpers', () => {
  let globals: GlobalVariablesService;

  beforeEach(() => {
    globals = new GlobalVariablesService();
  });

  it('returns invalid validation when source square has no piece', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
    const result = ChessRulesService.validateMove(4, 4, globals.field[4][4], 4, 4);

    expect(result.isValid).toBeFalse();
    expect(result.isEnemyPiece).toBeFalse();
    expect(result.isEmptyTarget).toBeTrue();
  });

  it('accepts unknown piece enum in valueOfPiece default branch', () => {
    expect(ChessRulesService.valueOfPiece(ChessPiecesEnum.Knight)).toBe(3);
    expect(ChessRulesService.valueOfPiece('Unknown' as any)).toBeUndefined();
  });

  it('handles unknown source piece in canStepThere default switch branch', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
    const canStep = ChessRulesService.canStepThere(
      4,
      4,
      globals.field[4][4],
      6,
      4,
      new ChessPieceDto(ChessColorsEnum.White, 'Dragon' as any)
    );

    expect(canStep).toBeTrue();
  });

  it('covers bishop notation parsing path through en-passant rights calculation', () => {
    const board = globals.field;
    const enPassant = ChessRulesService.getEnPassantRightsNotation(
      board,
      { 1: 'Bc1-e3' },
      ChessColorsEnum.Black
    );

    expect(enPassant).toBe('-');
  });

  it('simulates queenside castle king move path during legality check', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
    globals.boardHelper.history = {};
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        globals.field[row][col] = [];
      }
    }
    globals.field[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    globals.field[7][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    globals.field[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];

    const canCastleQueenSide = ChessRulesService.canStepThere(7, 2, globals.field[7][2], 7, 4);

    expect(canCastleQueenSide).toBeTrue();
    expect(globals.boardHelper.justDidCastle).toEqual({ row: 7, col: 2 });
  });

  it('returns unchanged board when simulating a move from empty source square', () => {
    const emptyBoard = globals.field.map(row => row.map(() => []));
    const simulated = (ChessRulesService as any).simulateMoveOnBoard(emptyBoard, 4, 4, 4, 5);

    expect(simulated[4][4]).toEqual([]);
    expect(simulated[4][5]).toEqual([]);
  });

  it('handles withBoardContext when BOARD_HELPER is temporarily null', () => {
    const previousHelper = GlobalVariablesService.BOARD_HELPER;
    try {
      GlobalVariablesService.BOARD_HELPER = null as any;
      const board = globals.field;
      const result = (ChessRulesService as any).withBoardContext(board, ChessColorsEnum.White, () => 'ok');
      expect(result).toBe('ok');
    } finally {
      GlobalVariablesService.BOARD_HELPER = previousHelper;
    }
  });
});
