import { ChessBoardComponent } from './chess-board.component';
import { GlobalVariablesService } from '../../services/global-variables.service';
import { ChessColorsEnum } from '../../model/chess.colors';
import { ChessPiecesEnum } from '../../model/chess.pieces';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NO_ERRORS_SCHEMA } from '@angular/core';

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

  const createEnterLike = (srcRow: number, srcCol: number, targetRow: number, targetCol: number) => {
    return {
      item: {
        dropContainer: {
          id: `field${srcRow}${srcCol}`
        }
      },
      container: {
        id: `field${targetRow}${targetCol}`
      }
    } as any;
  };

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        globals.field[row][col] = [];
      }
    }
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
    expect(globals.history[globals.history.length - 1]).toContain('=Q');
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
    expect(globals.history[globals.history.length - 1]).toContain('=Q');
  });

  it('declares draw by stalemate when side to move has no legal moves and is not in check', () => {
    clearBoard();
    globals.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[1][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    globals.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    expect(canDropLike(1, 3, 1, 2)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 1, 2));

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by stalemate.');
    expect(globals.history[globals.history.length - 1]).toContain('½-½');
  });

  it('declares draw by threefold repetition', () => {
    const sequence = [
      [7, 6, 5, 5],
      [0, 6, 2, 5],
      [5, 5, 7, 6],
      [2, 5, 0, 6],
      [7, 6, 5, 5],
      [0, 6, 2, 5],
      [5, 5, 7, 6],
      [2, 5, 0, 6]
    ];

    sequence.forEach(([srcRow, srcCol, targetRow, targetCol]) => {
      expect(canDropLike(srcRow, srcCol, targetRow, targetCol)).toBeTrue();
      component.onDrop(createDropLike(srcRow, srcCol, targetRow, targetCol));
    });

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by threefold repetition.');
  });

  it('declares draw by 50-move rule after 100 non-pawn non-capture half-moves', () => {
    clearBoard();
    globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.boardHelper.history = {};
    for (let i = 1; i <= 99; i++) {
      globals.boardHelper.history[`${i}`] = 'Ng1-f3';
    }

    expect(canDropLike(0, 1, 2, 0)).toBeTrue();
    component.onDrop(createDropLike(0, 1, 2, 0));

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by 50-move rule.');
  });

  it('declares draw by insufficient material', () => {
    clearBoard();
    globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[7][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    expect(canDropLike(7, 1, 5, 0)).toBeTrue();
    component.onDrop(createDropLike(7, 1, 5, 0));

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by insufficient material.');
  });

  it('shows protection arrows for defended targets in threat view', () => {
    clearBoard();
    globals.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    globals.field[2][2] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);

    const arrows = Object.values(globals.boardHelper.arrows);
    const hasThreatArrow = arrows.some(arrow => arrow.color === 'blue');
    const hasProtectionArrow = arrows.some(arrow => arrow.color === 'gold');

    expect(hasThreatArrow).toBeTrue();
    expect(hasProtectionArrow).toBeTrue();
  });

  it('shows cyan threat arrows for unprotected targets in threat view', () => {
    clearBoard();
    globals.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);

    const arrows = Object.values(globals.boardHelper.arrows);
    const hasCyanThreatArrow = arrows.some(arrow => arrow.color === 'cyan');
    const hasProtectionArrow = arrows.some(arrow => arrow.color === 'gold');

    expect(hasCyanThreatArrow).toBeTrue();
    expect(hasProtectionArrow).toBeFalse();
  });

  it('shows red threat arrows when the target is the king (check)', () => {
    clearBoard();
    globals.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);

    const arrows = Object.values(globals.boardHelper.arrows);
    const hasRedCheckArrow = arrows.some(arrow => arrow.color === 'red');

    expect(hasRedCheckArrow).toBeTrue();
  });

  it('drag-enter preview marks dangerous move that allows mate in one', () => {
    clearBoard();
    globals.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[6][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[6][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[5][6] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Queen } as any];
    globals.field[3][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    component.onDropListEntered(createEnterLike(7, 0, 6, 0));
    expect(component.isMateInOneBlunderTarget(6, 0)).toBeTrue();
  });

  it('drag-enter preview highlights mate-in-one winning target', () => {
    clearBoard();
    globals.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[2][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    component.onDropListEntered(createEnterLike(2, 1, 1, 1));
    expect(component.isMateInOneTarget(1, 1)).toBeTrue();
  });

  it('canDrop legality check does not mutate mate preview state', () => {
    clearBoard();
    globals.field[6][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    expect(canDropLike(6, 4, 5, 4)).toBeTrue();
    expect(component.isMateInOneTarget(5, 4)).toBeFalse();
    expect(component.isMateInOneBlunderTarget(5, 4)).toBeFalse();
  });

  it('returns highlight class with mate danger priority over other layers', () => {
    clearBoard();
    globals.boardHelper.possibles['44'] = { row: 4, col: 4 } as any;
    globals.boardHelper.hits['44'] = { row: 4, col: 4 } as any;
    component.mateInOneTargets['44'] = true;
    component.mateInOneBlunderTargets['44'] = true;

    expect(component.getSquareHighlightClass(4, 4)).toBe('mate-one-danger');
    delete component.mateInOneBlunderTargets['44'];
    expect(component.getSquareHighlightClass(4, 4)).toBe('mate-one');
    delete component.mateInOneTargets['44'];
    expect(component.getSquareHighlightClass(4, 4)).toBe('killer');
    delete globals.boardHelper.hits['44'];
    expect(component.getSquareHighlightClass(4, 4)).toBe('shaded');
  });
});

describe('ChessBoardComponent template drag-enter integration', () => {
  let fixture: ComponentFixture<ChessBoardComponent>;
  let component: ChessBoardComponent;
  let globals: GlobalVariablesService;

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        globals.field[row][col] = [];
      }
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChessBoardComponent],
      imports: [DragDropModule],
      providers: [GlobalVariablesService],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ChessBoardComponent);
    component = fixture.componentInstance;
    globals = TestBed.inject(GlobalVariablesService);
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('applies mate-one-danger class on target square when cdkDropListEntered fires for a blunder move', () => {
    clearBoard();
    globals.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[6][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[6][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[5][6] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Queen } as any];
    globals.field[3][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    fixture.detectChanges();

    const targetSquare = fixture.debugElement.query(By.css('#field60'));
    targetSquare.triggerEventHandler('cdkDropListEntered', {
      item: { dropContainer: { id: 'field70' } },
      container: { id: 'field60' }
    } as any);
    fixture.detectChanges();

    expect(component.isMateInOneBlunderTarget(6, 0)).toBeTrue();
    expect((targetSquare.nativeElement as HTMLElement).classList.contains('mate-one-danger')).toBeTrue();
  });

  it('applies mate-one class on target square when cdkDropListEntered fires for a winning mate move', () => {
    clearBoard();
    globals.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[2][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    fixture.detectChanges();

    const targetSquare = fixture.debugElement.query(By.css('#field11'));
    targetSquare.triggerEventHandler('cdkDropListEntered', {
      item: { dropContainer: { id: 'field21' } },
      container: { id: 'field11' }
    } as any);
    fixture.detectChanges();

    expect(component.isMateInOneTarget(1, 1)).toBeTrue();
    expect((targetSquare.nativeElement as HTMLElement).classList.contains('mate-one')).toBeTrue();
  });
});
