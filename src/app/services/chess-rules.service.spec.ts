import { ChessRulesService } from './chess-rules.service';
import { GlobalVariablesService } from './global-variables.service';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/chess.colors';
import { ChessPiecesEnum } from '../model/chess.pieces';

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
