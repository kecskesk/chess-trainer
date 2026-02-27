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
        dropContainer: { id: `field${srcRow}${srcCol}` }
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
});
