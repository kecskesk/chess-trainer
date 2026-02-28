import { ChessBoardComponent } from './chess-board.component';
import { GlobalVariablesService } from '../../services/global-variables.service';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../../model/enums/chess-pieces.enum';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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
    component = new ChessBoardComponent(globals, {
      get: () => of([])
    } as any);
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('updates opening recognition on first half-move when opening line has one step', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Queen\'s Pawn Opening',
        steps: ['d2-d4'],
        raw: {
          name: 'Queen\'s Pawn Opening',
          long_algebraic_notation: '1. d2-d4'
        }
      }
    ];

    expect(component.getMockOpeningRecognition()).toBe('Waiting for opening line...');

    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));
    expect(component.getMockOpeningRecognition()).toBe('Queen\'s Pawn Opening');
  });

  it('prefers a complete one-step opening over a longer partial prefix match', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Queen\'s Gambit',
        steps: ['d2-d4', 'd7-d5', 'c2-c4'],
        raw: {
          name: 'Queen\'s Gambit',
          long_algebraic_notation: '1. d2-d4 d7-d5 2. c2-c4'
        }
      },
      {
        name: 'Queen\'s Pawn Opening',
        steps: ['d2-d4'],
        raw: {
          name: 'Queen\'s Pawn Opening',
          long_algebraic_notation: '1. d2-d4'
        }
      }
    ];

    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));

    expect(component.getMockOpeningRecognition()).toBe('Queen\'s Pawn Opening');
    expect(globals.boardHelper.debugText).toContain('Opening: Queen\'s Pawn Opening');
  });

  it('shows matched sequence and next expected move for partial opening match', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Queen\'s Gambit',
        steps: ['d2-d4', 'd7-d5', 'c2-c4'],
        raw: {
          name: 'Queen\'s Gambit',
          long_algebraic_notation: '1. d2-d4 d7-d5 2. c2-c4',
          suggested_best_response_name: 'Queen\'s Gambit Declined',
          suggested_best_response_notation_step: '2... e7-e6',
          short_description: 'A fundamental d4 opening where White offers a pawn.'
        }
      }
    ];

    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));
    expect(canDropLike(1, 3, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 3, 3));

    expect(component.getMockOpeningRecognition()).toBe('Queen\'s Gambit');
    expect(globals.boardHelper.debugText).toContain('Matched steps: 2/3');
    expect(globals.boardHelper.debugText).toContain('Book recommendation (White now): c2-c4');
    expect(globals.boardHelper.debugText).toContain('Book recommendation (Black after): Queen\'s Gambit Declined (2... e7-e6)');
  });

  it('does not repeat suggested response after it has been played', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Queen\'s Gambit',
        steps: ['d2-d4', 'd7-d5', 'c2-c4'],
        raw: {
          name: 'Queen\'s Gambit',
          long_algebraic_notation: '1. d2-d4 d7-d5 2. c2-c4',
          suggested_best_response_name: 'Queen\'s Gambit Declined',
          suggested_best_response_notation_step: '2... e7-e6',
          short_description: 'A fundamental d4 opening where White offers a pawn.'
        }
      }
    ];

    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));
    expect(canDropLike(1, 3, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 3, 3));
    expect(canDropLike(6, 2, 4, 2)).toBeTrue();
    component.onDrop(createDropLike(6, 2, 4, 2));
    expect(canDropLike(1, 4, 2, 4)).toBeTrue();
    component.onDrop(createDropLike(1, 4, 2, 4));

    expect(component.getMockOpeningRecognition()).toBe('Queen\'s Gambit Declined');
    expect(globals.boardHelper.debugText).toContain('Opening: Queen\'s Gambit Declined');
    expect(globals.boardHelper.debugText).toContain('Book recommendation (White now): —');
    expect(globals.boardHelper.debugText).not.toContain('Book recommendation (Black now): Queen\'s Gambit Declined (2... e7-e6)');
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
    expect(globals.history[globals.history.length - 1]).toContain('1/2-1/2 {Draw by stalemate}');
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

    expect(globals.boardHelper.gameOver).toBeFalse();
    expect(component.canClaimDraw()).toBeTrue();

    component.claimDraw();

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by threefold repetition (claimed).');
    expect(globals.history[globals.history.length - 1]).toContain('1/2-1/2 {Draw by threefold repetition}');
  });

  it('declares draw by fivefold repetition', () => {
    clearBoard();
    globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    globals.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    const knight = globals.field[7][6][0];
    globals.field[5][5] = [knight];
    globals.field[7][6] = [];
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    const targetPositionKey = component.getDebugPositionKey();
    globals.field[7][6] = [knight];
    globals.field[5][5] = [];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    (component as any).repetitionCounts = { [targetPositionKey]: 4 };
    (component as any).trackedHistoryLength = globals.history.length;

    expect(canDropLike(7, 6, 5, 5)).toBeTrue();
    component.onDrop(createDropLike(7, 6, 5, 5));

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by fivefold repetition.');
    expect(globals.history[globals.history.length - 1]).toContain('1/2-1/2 {Draw by fivefold repetition}');
  });

  it('declares draw by 50-move rule after 100 non-pawn non-capture half-moves', () => {
    clearBoard();
    globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    globals.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    globals.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.boardHelper.history = {};
    for (let i = 1; i <= 99; i++) {
      globals.boardHelper.history[`${i}`] = 'Ng1-f3';
    }

    expect(canDropLike(0, 1, 2, 0)).toBeTrue();
    component.onDrop(createDropLike(0, 1, 2, 0));

    expect(globals.boardHelper.gameOver).toBeFalse();
    expect(component.canClaimDraw()).toBeTrue();

    component.claimDraw();

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by fifty-move rule (claimed).');
    expect(globals.history[globals.history.length - 1]).toContain('1/2-1/2 {Draw by fifty-move rule}');
  });

  it('declares draw by 75-move rule after 150 non-pawn non-capture half-moves', () => {
    clearBoard();
    globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    globals.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    globals.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    globals.boardHelper.history = {};
    for (let i = 1; i <= 149; i++) {
      globals.boardHelper.history[`${i}`] = 'Ng1-f3';
    }

    expect(canDropLike(0, 1, 2, 0)).toBeTrue();
    component.onDrop(createDropLike(0, 1, 2, 0));

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by seventy-five-move rule.');
    expect(globals.history[globals.history.length - 1]).toContain('1/2-1/2 {Draw by seventy-five-move rule}');
  });

  [
    {
      name: 'K+N vs K',
      setup: () => {
        globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
        globals.field[7][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
        globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
      },
      move: [7, 1, 5, 0] as [number, number, number, number]
    },
    {
      name: 'K+N vs K+N',
      setup: () => {
        globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
        globals.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
        globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
        globals.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
      },
      move: [7, 6, 5, 5] as [number, number, number, number]
    },
    {
      name: 'K+B vs K+N',
      setup: () => {
        globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
        globals.field[7][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Bishop } as any];
        globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
        globals.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
      },
      move: [7, 2, 6, 3] as [number, number, number, number]
    },
    {
      name: 'K+2N vs K',
      setup: () => {
        globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
        globals.field[7][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
        globals.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
        globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
      },
      move: [7, 1, 5, 0] as [number, number, number, number]
    }
  ].forEach(testCase => {
    it(`declares draw by insufficient material for ${testCase.name}`, () => {
      clearBoard();
      testCase.setup();
      globals.boardHelper.colorTurn = ChessColorsEnum.White;

      const [srcRow, srcCol, targetRow, targetCol] = testCase.move;
      expect(canDropLike(srcRow, srcCol, targetRow, targetCol)).toBeTrue();
      component.onDrop(createDropLike(srcRow, srcCol, targetRow, targetCol));

      expect(globals.boardHelper.gameOver).toBeTrue();
      expect(globals.boardHelper.checkmateColor).toBeNull();
      expect(globals.boardHelper.debugText).toBe('Draw by insufficient material.');
    });
  });

  it('creates a pending draw offer instead of ending game immediately', () => {
    expect(globals.boardHelper.gameOver).toBeFalse();

    component.offerDraw();

    expect(globals.boardHelper.gameOver).toBeFalse();
    expect(component.pendingDrawOfferBy).toBe(ChessColorsEnum.Black);
    expect(component.canRespondToDrawOffer()).toBeTrue();
  });

  it('accepts a pending draw offer as draw by agreement', () => {
    component.offerDraw();
    expect(component.canRespondToDrawOffer()).toBeTrue();

    component.acceptDrawOffer();

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Draw by agreement.');
    expect(globals.history[globals.history.length - 1]).toContain('1/2-1/2 {Draw agreed}');
    expect(component.pendingDrawOfferBy).toBeNull();
  });

  it('declines a pending draw offer without ending the game', () => {
    component.offerDraw();
    expect(component.canRespondToDrawOffer()).toBeTrue();

    component.declineDrawOffer();

    expect(globals.boardHelper.gameOver).toBeFalse();
    expect(component.pendingDrawOfferBy).toBeNull();
  });

  it('records white resignation as 0-1 with long result notation', () => {
    component.resign(ChessColorsEnum.White);

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('White resigns.');
    expect(globals.history[globals.history.length - 1]).toContain('0-1 {White resigns}');
  });

  it('records black resignation as 1-0 with long result notation', () => {
    component.resign(ChessColorsEnum.Black);

    expect(globals.boardHelper.gameOver).toBeTrue();
    expect(globals.boardHelper.checkmateColor).toBeNull();
    expect(globals.boardHelper.debugText).toBe('Black resigns.');
    expect(globals.history[globals.history.length - 1]).toContain('1-0 {Black resigns}');
  });

  it('auto-declines pending draw offer when responder makes a move', () => {
    component.offerDraw();
    expect(component.pendingDrawOfferBy).toBe(ChessColorsEnum.Black);

    expect(canDropLike(6, 4, 4, 4)).toBeTrue();
    component.onDrop(createDropLike(6, 4, 4, 4));

    expect(globals.boardHelper.gameOver).toBeFalse();
    expect(component.pendingDrawOfferBy).toBeNull();
  });

  it('returns ambient background theme by turn and pending draw state', () => {
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
    expect(component.getAmbientThemeClass()).toBe('ambient-math--white-turn');

    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    expect(component.getAmbientThemeClass()).toBe('ambient-math--black-turn');

    component.offerDraw();
    expect(component.getAmbientThemeClass()).toBe('ambient-math--draw-pending');
  });

  it('ignores onDrop when move would leave own king in check', () => {
    clearBoard();
    globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[6][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    component.onDrop(createDropLike(6, 4, 6, 5));

    expect(globals.field[6][4][0].piece).toBe(ChessPiecesEnum.Rook);
    expect(globals.field[6][4][0].color).toBe(ChessColorsEnum.White);
    expect(globals.field[6][5].length).toBe(0);
    expect(globals.boardHelper.colorTurn).toBe(ChessColorsEnum.White);
    expect(globals.history.length).toBe(0);
  });

  it('writes debug reason when drag target is invalid', () => {
    const canDrop = canDropLike(6, 0, 5, 1);

    expect(canDrop).toBeFalse();
    expect(globals.boardHelper.debugText).toBe('');
  });

  it('writes zero-target reason when dragged piece has no legal targets', () => {
    clearBoard();
    globals.field[0][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[0][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[1][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[1][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    globals.field[7][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;

    component.onDragStarted({
      source: {
        dropContainer: {
          id: 'field00',
          data: globals.field[0][0]
        }
      }
    } as any);

    expect(globals.boardHelper.debugText).toBe('· No legal targets for this king.');
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
      providers: [GlobalVariablesService, provideHttpClient(), provideHttpClientTesting()],
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

  it('shows claim draw button only when draw can be claimed', () => {
    fixture.detectChanges();
    let claimButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('claim draw'));
    expect(claimButton).toBeUndefined();

    clearBoard();
    globals.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    globals.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    globals.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    globals.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    globals.boardHelper.colorTurn = ChessColorsEnum.White;
    globals.boardHelper.history = {};
    for (let i = 1; i <= 100; i++) {
      globals.boardHelper.history[`${i}`] = 'Ng1-f3';
    }

    fixture.detectChanges();
    claimButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('claim draw'));
    expect(claimButton).toBeDefined();
  });

  it('shows accept/decline buttons for pending draw offer', () => {
    fixture.detectChanges();

    let offerDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('offer draw'));
    expect(offerDrawButton).toBeDefined();

    offerDrawButton.triggerEventHandler('click', {});
    fixture.detectChanges();

    offerDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('offer draw'));
    const acceptDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('accept draw'));
    const declineDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('decline draw'));

    expect(offerDrawButton).toBeUndefined();
    expect(acceptDrawButton).toBeDefined();
    expect(declineDrawButton).toBeDefined();
  });

  it('applies animated ambient class for white, black, and pending draw states', () => {
    fixture.detectChanges();

    let ambient = fixture.debugElement.query(By.css('.ambient-math')).nativeElement as HTMLElement;
    expect(ambient.classList.contains('ambient-math--white-turn')).toBeTrue();

    globals.boardHelper.colorTurn = ChessColorsEnum.Black;
    fixture.detectChanges();
    ambient = fixture.debugElement.query(By.css('.ambient-math')).nativeElement as HTMLElement;
    expect(ambient.classList.contains('ambient-math--black-turn')).toBeTrue();

    const offerDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('offer draw'));
    expect(offerDrawButton).toBeDefined();
    offerDrawButton.triggerEventHandler('click', {});
    fixture.detectChanges();

    ambient = fixture.debugElement.query(By.css('.ambient-math')).nativeElement as HTMLElement;
    expect(ambient.classList.contains('ambient-math--draw-pending')).toBeTrue();
  });
});
