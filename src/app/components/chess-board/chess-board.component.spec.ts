import { ChessBoardComponent } from './chess-board.component';
import { GlobalVariablesService } from '../../services/global-variables.service';
import { ChessColorsEnum } from '../../model/chess.colors';
import { ChessPiecesEnum } from '../../model/chess.pieces';

describe('ChessBoardComponent move sequence integration', () => {
  let globals: GlobalVariablesService;
  let component: ChessBoardComponent;

  const createDropLike = (srcRow: number, srcCol: number, targetRow: number, targetCol: number) => {
    return {
      previousContainer: {
        id: `field${srcRow}${srcCol}`,
        data: globals.field[srcRow][srcCol]
      },
      container: {
        id: `field${targetRow}${targetCol}`,
        data: globals.field[targetRow][targetCol]
      },
      previousIndex: 0,
      currentIndex: 0
    } as any;
  };

  const canDropLike = (srcRow: number, srcCol: number, targetRow: number, targetCol: number) => {
    return component.canDrop(
      {
        dropContainer: {
          id: `field${srcRow}${srcCol}`,
          data: globals.field[srcRow][srcCol]
        }
      } as any,
      {
        id: `field${targetRow}${targetCol}`,
        data: globals.field[targetRow][targetCol]
      } as any
    );
  };

  beforeEach(() => {
    globals = new GlobalVariablesService();
    component = new ChessBoardComponent(globals);
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('supports d2d4, e7e5, and d4xe5 with capture highlight', () => {
    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));

    expect(globals.boardHelper.colorTurn).toBe(ChessColorsEnum.Black);
    expect(globals.field[4][3][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(globals.field[4][3][0].color).toBe(ChessColorsEnum.White);

    expect(canDropLike(1, 4, 3, 4)).toBeTrue();
    component.onDrop(createDropLike(1, 4, 3, 4));

    expect(globals.boardHelper.colorTurn).toBe(ChessColorsEnum.White);
    expect(globals.field[3][4][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(globals.field[3][4][0].color).toBe(ChessColorsEnum.Black);

    expect(canDropLike(4, 3, 3, 4)).toBeTrue();
    expect(component.isHit(3, 4)).toBeTrue();

    component.onDrop(createDropLike(4, 3, 3, 4));

    expect(globals.field[4][3].length).toBe(0);
    expect(globals.field[3][4][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(globals.field[3][4][0].color).toBe(ChessColorsEnum.White);
  });

  it('detects Fool\'s Mate and ends the game', () => {
    expect(canDropLike(6, 5, 5, 5)).toBeTrue();
    component.onDrop(createDropLike(6, 5, 5, 5));

    expect(canDropLike(1, 4, 3, 4)).toBeTrue();
    component.onDrop(createDropLike(1, 4, 3, 4));

    expect(canDropLike(6, 6, 4, 6)).toBeTrue();
    component.onDrop(createDropLike(6, 6, 4, 6));

    expect(canDropLike(0, 3, 4, 7)).toBeTrue();
    component.onDrop(createDropLike(0, 3, 4, 7));

    const history = globals.history;
    const lastMove = history[history.length - 1];

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBe(ChessColorsEnum.White);
    expect(lastMove).toContain('#');
    expect(component.canDropPredicate(
      {
        dropContainer: {
          id: 'field60',
          data: globals.field[6][0]
        }
      } as any,
      {
        id: 'field50',
        data: globals.field[5][0]
      } as any
    )).toBeFalse();
  });

  it('supports d2d4 e7e5 d4d5 c7c5 d5xc6 e.p. d7xc6 sequence', () => {
    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));

    expect(canDropLike(1, 4, 3, 4)).toBeTrue();
    component.onDrop(createDropLike(1, 4, 3, 4));

    expect(canDropLike(4, 3, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(4, 3, 3, 3));

    expect(canDropLike(1, 2, 3, 2)).toBeTrue();
    component.onDrop(createDropLike(1, 2, 3, 2));

    expect(canDropLike(3, 3, 2, 2)).toBeTrue();
    component.onDrop(createDropLike(3, 3, 2, 2));
    expect(globals.field[3][2].length).toBe(0);
    expect(globals.field[2][2][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(globals.field[2][2][0].color).toBe(ChessColorsEnum.White);

    expect(canDropLike(1, 3, 2, 2)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 2, 2));

    expect(globals.field[1][3].length).toBe(0);
    expect(globals.field[2][2][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(globals.field[2][2][0].color).toBe(ChessColorsEnum.Black);
  });

  it('triggers and applies white promotion on back rank', () => {
    globals.field[1][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[0][0] = [];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    expect(canDropLike(1, 0, 0, 0)).toBeTrue();
    component.onDrop(createDropLike(1, 0, 0, 0));

    expect(globals.boardHelper.canPromote).toBe(0);
    component.promotePiece(ChessPiecesEnum.Queen);
    expect(globals.field[0][0][0].piece).toBe(ChessPiecesEnum.Queen);
    expect(globals.boardHelper.canPromote).toBeNull();
  });

  it('triggers and applies black promotion on back rank', () => {
    globals.field[6][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[7][7] = [];
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;

    expect(canDropLike(6, 7, 7, 7)).toBeTrue();
    component.onDrop(createDropLike(6, 7, 7, 7));

    expect(globals.boardHelper.canPromote).toBe(7);
    component.promotePiece(ChessPiecesEnum.Queen);
    expect(globals.field[7][7][0].piece).toBe(ChessPiecesEnum.Queen);
    expect(globals.boardHelper.canPromote).toBeNull();
  });
});
