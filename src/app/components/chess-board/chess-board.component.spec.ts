import { ChessBoardComponent } from './chess-board.component';
import { ChessBoardStateService } from '../../services/chess-board-state.service';
import { ChessRulesService } from '../../services/chess-rules.service';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../../model/enums/chess-pieces.enum';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ChessBoardComponent move sequence integration', () => {
  let chessBoardStateService: ChessBoardStateService;
  let component: ChessBoardComponent;

  const createDropLike = (srcRow: number, srcCol: number, targetRow: number, targetCol: number) => {
    return {
      previousContainer: {
        id: `field${srcRow}${srcCol}`,
        data: chessBoardStateService.field[srcRow][srcCol]
      },
      container: {
        id: `field${targetRow}${targetCol}`,
        data: chessBoardStateService.field[targetRow][targetCol]
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
          data: chessBoardStateService.field[srcRow][srcCol]
        }
      } as any,
      {
        id: `field${targetRow}${targetCol}`,
        data: chessBoardStateService.field[targetRow][targetCol]
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
        chessBoardStateService.field[row][col] = [];
      }
    }
  };

  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    component = new ChessBoardComponent(chessBoardStateService, {
      get: () => of([])
    } as any);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
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
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Queen\'s Pawn Opening');
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
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 2/3');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (White now): c2-c4');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (Black after): Queen\'s Gambit Declined (2... e7-e6)');
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
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Queen\'s Gambit Declined');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (White now): —');
    expect(chessBoardStateService.boardHelper.debugText).not.toContain('Book recommendation (Black now): Queen\'s Gambit Declined (2... e7-e6)');
  });

  it('extends Dutch line with first variation move and labels the opening as Dutch Defense: Classical Variation', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Dutch Defense',
        steps: ['d2-d4', 'f7-f5'],
        raw: {
          name: 'Dutch Defense',
          long_algebraic_notation: '1. d2-d4 f7-f5',
          suggested_best_response_name: 'Classical Variation',
          suggested_best_response_notation_step: '2. c2-c4 Ng8-f6 3. g2-g3',
          short_description: 'An aggressive defense aiming for kingside chances.'
        }
      }
    ];

    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));
    expect(canDropLike(1, 5, 3, 5)).toBeTrue();
    component.onDrop(createDropLike(1, 5, 3, 5));
    expect(canDropLike(6, 2, 4, 2)).toBeTrue();
    component.onDrop(createDropLike(6, 2, 4, 2));

    expect(component.getMockOpeningRecognition()).toBe('Dutch Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Dutch Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 3/5');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Line: 1. d2-d4 f7-f5 2. c2-c4 Ng8-f6 3. g2-g3');
  });

  it('labels Alekhine line as Alekhine\'s Defense: Four Pawns Attack when the suggested move is played', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Alekhine\'s Defense',
        steps: ['e2-e4', 'Ng8-f6'],
        raw: {
          name: 'Alekhine\'s Defense',
          long_algebraic_notation: '1. e2-e4 Ng8-f6',
          suggested_best_response_name: 'Four Pawns Attack',
          suggested_best_response_notation_step: '2. e4-e5 Nf6-d5 3. d2-d4 d7-d6 4. c2-c4',
          short_description: 'A provocative defense inviting White to overextend the center.'
        }
      }
    ];

    expect(canDropLike(6, 4, 4, 4)).toBeTrue();
    component.onDrop(createDropLike(6, 4, 4, 4));
    expect(canDropLike(0, 6, 2, 5)).toBeTrue();
    component.onDrop(createDropLike(0, 6, 2, 5));
    expect(canDropLike(4, 4, 3, 4)).toBeTrue();
    component.onDrop(createDropLike(4, 4, 3, 4));

    expect(component.getMockOpeningRecognition()).toBe('Alekhine\'s Defense: Four Pawns Attack');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Alekhine\'s Defense: Four Pawns Attack');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 3/7');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Line: 1. e2-e4 Ng8-f6 2. e4-e5 Nf6-d5 3. d2-d4 d7-d6 4. c2-c4');
  });

  it('shows prefixed response name in recommendation text for Alekhine\'s Defense', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Alekhine\'s Defense',
        steps: ['e2-e4', 'Ng8-f6'],
        raw: {
          name: 'Alekhine\'s Defense',
          long_algebraic_notation: '1. e2-e4 Ng8-f6',
          suggested_best_response_name: 'Four Pawns Attack',
          suggested_best_response_notation_step: '2. e4-e5 Nf6-d5 3. d2-d4 d7-d6 4. c2-c4',
          short_description: 'A provocative defense inviting White to overextend the center.'
        }
      }
    ];

    expect(canDropLike(6, 4, 4, 4)).toBeTrue();
    component.onDrop(createDropLike(6, 4, 4, 4));
    expect(canDropLike(0, 6, 2, 5)).toBeTrue();
    component.onDrop(createDropLike(0, 6, 2, 5));

    component.getMockOpeningRecognition();

    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (White now): e4-e5');
  });

  it('does not repeat Scandinavian main line recommendation after the projected line is fully played', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Scandinavian Defense',
        steps: ['e2-e4', 'd7-d5'],
        raw: {
          name: 'Scandinavian Defense',
          long_algebraic_notation: '1. e2-e4 d7-d5',
          suggested_best_response_name: 'Main Line',
          suggested_best_response_notation_step: '2. e4xd5 Qd8xd5',
          short_description: 'An immediate central challenge where Black activates the queen.'
        }
      }
    ];

    expect(canDropLike(6, 4, 4, 4)).toBeTrue();
    component.onDrop(createDropLike(6, 4, 4, 4));
    expect(canDropLike(1, 3, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 3, 3));
    expect(canDropLike(4, 4, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(4, 4, 3, 3));
    expect(canDropLike(0, 3, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(0, 3, 3, 3));

    component.getMockOpeningRecognition();

    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Scandinavian Defense: Main Line');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 4/4');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Line: 1. e2-e4 d7-d5 2. e4xd5 Qd8xd5');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (White now): —');
  });

  it('does not show redundant white-after recommendation while projecting Scandinavian main line', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Scandinavian Defense',
        steps: ['e2-e4', 'd7-d5'],
        raw: {
          name: 'Scandinavian Defense',
          long_algebraic_notation: '1. e2-e4 d7-d5',
          suggested_best_response_name: 'Main Line',
          suggested_best_response_notation_step: '2. e4xd5 Qd8xd5',
          short_description: 'An immediate central challenge where Black activates the queen.'
        }
      }
    ];

    expect(canDropLike(6, 4, 4, 4)).toBeTrue();
    component.onDrop(createDropLike(6, 4, 4, 4));
    expect(canDropLike(1, 3, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 3, 3));
    expect(canDropLike(4, 4, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(4, 4, 3, 3));

    component.getMockOpeningRecognition();

    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Scandinavian Defense: Main Line');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 3/4');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (Black now): Qd8xd5');
    expect(chessBoardStateService.boardHelper.debugText).not.toContain('Book recommendation (White after):');
  });

  it('keeps Caro-Kann as Classical Variation before e5 is played', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Caro-Kann Defense',
        steps: ['e2-e4', 'c7-c6'],
        raw: {
          name: 'Caro-Kann Defense',
          long_algebraic_notation: '1. e2-e4 c7-c6',
          suggested_best_response_name: 'Classical Variation',
          suggested_best_response_notation_step: '2. d2-d4 d7-d5 3. Nb1-c3',
          short_description: 'A solid defense known for its strong pawn structure.'
        }
      },
      {
        name: 'Caro-Kann Defense: Advance Variation',
        steps: ['e2-e4', 'c7-c6', 'd2-d4', 'd7-d5', 'e4-e5'],
        raw: {
          name: 'Caro-Kann Defense: Advance Variation',
          long_algebraic_notation: '1. e2-e4 c7-c6 2. d2-d4 d7-d5 3. e4-e5',
          suggested_best_response_name: 'Main Line',
          suggested_best_response_notation_step: '3... Bc8-f5',
          short_description: 'White gains space while Black targets the d4 chain base.'
        }
      }
    ];

    expect(canDropLike(6, 4, 4, 4)).toBeTrue();
    component.onDrop(createDropLike(6, 4, 4, 4));
    expect(canDropLike(1, 2, 2, 2)).toBeTrue();
    component.onDrop(createDropLike(1, 2, 2, 2));
    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));

    expect(component.getMockOpeningRecognition()).toBe('Caro-Kann Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Caro-Kann Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 3/5');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Line: 1. e2-e4 c7-c6 2. d2-d4 d7-d5 3. Nb1-c3');

    expect(canDropLike(1, 3, 3, 3)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 3, 3));

    expect(component.getMockOpeningRecognition()).toBe('Caro-Kann Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Caro-Kann Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 4/5');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Line: 1. e2-e4 c7-c6 2. d2-d4 d7-d5 3. Nb1-c3');
  });

  it('supports d2d4, e7e5, and d4xe5 with capture highlight', () => {
    expect(canDropLike(6, 3, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(6, 3, 4, 3));

    expect(chessBoardStateService.boardHelper.colorTurn).toBe(ChessColorsEnum.Black);
    expect(chessBoardStateService.field[4][3][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[4][3][0].color).toBe(ChessColorsEnum.White);

    expect(canDropLike(1, 4, 3, 4)).toBeTrue();
    component.onDrop(createDropLike(1, 4, 3, 4));

    expect(chessBoardStateService.boardHelper.colorTurn).toBe(ChessColorsEnum.White);
    expect(chessBoardStateService.field[3][4][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[3][4][0].color).toBe(ChessColorsEnum.Black);

    expect(canDropLike(4, 3, 3, 4)).toBeTrue();
    expect(component.isHit(3, 4)).toBeTrue();

    component.onDrop(createDropLike(4, 3, 3, 4));

    expect(chessBoardStateService.field[4][3].length).toBe(0);
    expect(chessBoardStateService.field[3][4][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[3][4][0].color).toBe(ChessColorsEnum.White);
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

    const history = chessBoardStateService.history;
    const lastMove = history[history.length - 1];

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBe(ChessColorsEnum.White);
    expect(lastMove).toContain('#');
    expect(component.canDropPredicate(
      {
        dropContainer: {
          id: 'field60',
          data: chessBoardStateService.field[6][0]
        }
      } as any,
      {
        id: 'field50',
        data: chessBoardStateService.field[5][0]
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
    expect(chessBoardStateService.field[3][2].length).toBe(0);
    expect(chessBoardStateService.field[2][2][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[2][2][0].color).toBe(ChessColorsEnum.White);

    expect(canDropLike(1, 3, 2, 2)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 2, 2));

    expect(chessBoardStateService.field[1][3].length).toBe(0);
    expect(chessBoardStateService.field[2][2][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[2][2][0].color).toBe(ChessColorsEnum.Black);
  });

  it('triggers and applies white promotion on back rank', () => {
    chessBoardStateService.field[1][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[0][0] = [];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    expect(canDropLike(1, 0, 0, 0)).toBeTrue();
    component.onDrop(createDropLike(1, 0, 0, 0));

    expect(chessBoardStateService.boardHelper.canPromote).toBe(0);
    component.promotePiece(ChessPiecesEnum.Queen);
    expect(chessBoardStateService.field[0][0][0].piece).toBe(ChessPiecesEnum.Queen);
    expect(chessBoardStateService.boardHelper.canPromote).toBeNull();
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('=Q');
  });

  it('triggers and applies black promotion on back rank', () => {
    chessBoardStateService.field[6][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[7][7] = [];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;

    expect(canDropLike(6, 7, 7, 7)).toBeTrue();
    component.onDrop(createDropLike(6, 7, 7, 7));

    expect(chessBoardStateService.boardHelper.canPromote).toBe(7);
    component.promotePiece(ChessPiecesEnum.Queen);
    expect(chessBoardStateService.field[7][7][0].piece).toBe(ChessPiecesEnum.Queen);
    expect(chessBoardStateService.boardHelper.canPromote).toBeNull();
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('=Q');
  });

  it('declares draw by stalemate when side to move has no legal moves and is not in check', () => {
    clearBoard();
    chessBoardStateService.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[1][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    expect(canDropLike(1, 3, 1, 2)).toBeTrue();
    component.onDrop(createDropLike(1, 3, 1, 2));

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by stalemate.');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1/2-1/2 {Draw by stalemate}');
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

    expect(chessBoardStateService.boardHelper.gameOver).toBeFalse();
    expect(component.canClaimDraw()).toBeTrue();

    component.claimDraw();

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by threefold repetition (claimed).');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1/2-1/2 {Draw by threefold repetition}');
  });

  it('declares draw by fivefold repetition', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    const knight = chessBoardStateService.field[7][6][0];
    chessBoardStateService.field[5][5] = [knight];
    chessBoardStateService.field[7][6] = [];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    const targetPositionKey = component.getDebugPositionKey();
    chessBoardStateService.field[7][6] = [knight];
    chessBoardStateService.field[5][5] = [];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    (component as any).repetitionCounts = { [targetPositionKey]: 4 };
    (component as any).trackedHistoryLength = chessBoardStateService.history.length;

    expect(canDropLike(7, 6, 5, 5)).toBeTrue();
    component.onDrop(createDropLike(7, 6, 5, 5));

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by fivefold repetition.');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1/2-1/2 {Draw by fivefold repetition}');
  });

  it('declares draw by 50-move rule after 100 non-pawn non-capture half-moves', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.boardHelper.history = {};
    for (let i = 1; i <= 99; i++) {
      chessBoardStateService.boardHelper.history[`${i}`] = 'Ng1-f3';
    }

    expect(canDropLike(0, 1, 2, 0)).toBeTrue();
    component.onDrop(createDropLike(0, 1, 2, 0));

    expect(chessBoardStateService.boardHelper.gameOver).toBeFalse();
    expect(component.canClaimDraw()).toBeTrue();

    component.claimDraw();

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by fifty-move rule (claimed).');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1/2-1/2 {Draw by fifty-move rule}');
  });

  it('declares draw by 75-move rule after 150 non-pawn non-capture half-moves', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.boardHelper.history = {};
    for (let i = 1; i <= 149; i++) {
      chessBoardStateService.boardHelper.history[`${i}`] = 'Ng1-f3';
    }

    expect(canDropLike(0, 1, 2, 0)).toBeTrue();
    component.onDrop(createDropLike(0, 1, 2, 0));

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by seventy-five-move rule.');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1/2-1/2 {Draw by seventy-five-move rule}');
  });

  [
    {
      name: 'K+N vs K',
      setup: () => {
        chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
        chessBoardStateService.field[7][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
        chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
      },
      move: [7, 1, 5, 0] as [number, number, number, number]
    },
    {
      name: 'K+N vs K+N',
      setup: () => {
        chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
        chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
        chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
        chessBoardStateService.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
      },
      move: [7, 6, 5, 5] as [number, number, number, number]
    },
    {
      name: 'K+B vs K+N',
      setup: () => {
        chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
        chessBoardStateService.field[7][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Bishop } as any];
        chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
        chessBoardStateService.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
      },
      move: [7, 2, 6, 3] as [number, number, number, number]
    },
    {
      name: 'K+2N vs K',
      setup: () => {
        chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
        chessBoardStateService.field[7][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
        chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
        chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
      },
      move: [7, 1, 5, 0] as [number, number, number, number]
    }
  ].forEach(testCase => {
    it(`declares draw by insufficient material for ${testCase.name}`, () => {
      clearBoard();
      testCase.setup();
      chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

      const [srcRow, srcCol, targetRow, targetCol] = testCase.move;
      expect(canDropLike(srcRow, srcCol, targetRow, targetCol)).toBeTrue();
      component.onDrop(createDropLike(srcRow, srcCol, targetRow, targetCol));

      expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
      expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
      expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by insufficient material.');
    });
  });

  it('creates a pending draw offer instead of ending game immediately', () => {
    expect(chessBoardStateService.boardHelper.gameOver).toBeFalse();

    component.offerDraw();

    expect(chessBoardStateService.boardHelper.gameOver).toBeFalse();
    expect(component.pendingDrawOfferBy).toBe(ChessColorsEnum.Black);
    expect(component.canRespondToDrawOffer()).toBeTrue();
  });

  it('accepts a pending draw offer as draw by agreement', () => {
    component.offerDraw();
    expect(component.canRespondToDrawOffer()).toBeTrue();

    component.acceptDrawOffer();

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by agreement.');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1/2-1/2 {Draw agreed}');
    expect(component.pendingDrawOfferBy).toBeNull();
  });

  it('declines a pending draw offer without ending the game', () => {
    component.offerDraw();
    expect(component.canRespondToDrawOffer()).toBeTrue();

    component.declineDrawOffer();

    expect(chessBoardStateService.boardHelper.gameOver).toBeFalse();
    expect(component.pendingDrawOfferBy).toBeNull();
  });

  it('records white resignation as 0-1 with long result notation', () => {
    component.resign(ChessColorsEnum.White);

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('White resigns.');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('0-1 {White resigns}');
  });

  it('records black resignation as 1-0 with long result notation', () => {
    component.resign(ChessColorsEnum.Black);

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Black resigns.');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1-0 {Black resigns}');
  });

  it('auto-declines pending draw offer when responder makes a move', () => {
    component.offerDraw();
    expect(component.pendingDrawOfferBy).toBe(ChessColorsEnum.Black);

    expect(canDropLike(6, 4, 4, 4)).toBeTrue();
    component.onDrop(createDropLike(6, 4, 4, 4));

    expect(chessBoardStateService.boardHelper.gameOver).toBeFalse();
    expect(component.pendingDrawOfferBy).toBeNull();
  });

  it('returns ambient background theme by turn and pending draw state', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect(component.getAmbientThemeClass()).toBe('ambient-math--white-turn');

    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    expect(component.getAmbientThemeClass()).toBe('ambient-math--black-turn');

    component.offerDraw();
    expect(component.getAmbientThemeClass()).toBe('ambient-math--draw-pending');
  });

  it('ignores onDrop when move would leave own king in check', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.onDrop(createDropLike(6, 4, 6, 5));

    expect(chessBoardStateService.field[6][4][0].piece).toBe(ChessPiecesEnum.Rook);
    expect(chessBoardStateService.field[6][4][0].color).toBe(ChessColorsEnum.White);
    expect(chessBoardStateService.field[6][5].length).toBe(0);
    expect(chessBoardStateService.boardHelper.colorTurn).toBe(ChessColorsEnum.White);
    expect(chessBoardStateService.history.length).toBe(0);
  });

  it('writes debug reason when drag target is invalid', () => {
    const canDrop = canDropLike(6, 0, 5, 1);

    expect(canDrop).toBeFalse();
    expect(chessBoardStateService.boardHelper.debugText).toBe('');
  });

  it('writes zero-target reason when dragged piece has no legal targets', () => {
    clearBoard();
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[1][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[1][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.onDragStarted({
      source: {
        dropContainer: {
          id: 'field00',
          data: chessBoardStateService.field[0][0]
        }
      }
    } as any);

    expect(chessBoardStateService.boardHelper.debugText).toBe('· No legal targets for this king.');
  });

  it('shows protection arrows for defended targets in threat view', () => {
    clearBoard();
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[2][2] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);

    const arrows = Object.values(chessBoardStateService.boardHelper.arrows);
    const hasThreatArrow = arrows.some(arrow => arrow.color === 'blue');
    const hasProtectionArrow = arrows.some(arrow => arrow.color === 'gold');

    expect(hasThreatArrow).toBeTrue();
    expect(hasProtectionArrow).toBeTrue();
  });

  it('shows cyan threat arrows for unprotected targets in threat view', () => {
    clearBoard();
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);

    const arrows = Object.values(chessBoardStateService.boardHelper.arrows);
    const hasCyanThreatArrow = arrows.some(arrow => arrow.color === 'cyan');
    const hasProtectionArrow = arrows.some(arrow => arrow.color === 'gold');

    expect(hasCyanThreatArrow).toBeTrue();
    expect(hasProtectionArrow).toBeFalse();
  });

  it('shows red threat arrows when the target is the king (check)', () => {
    clearBoard();
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);

    const arrows = Object.values(chessBoardStateService.boardHelper.arrows);
    const hasRedCheckArrow = arrows.some(arrow => arrow.color === 'red');

    expect(hasRedCheckArrow).toBeTrue();
  });

  it('toggles threat overlay off when invoked twice and tracks activeTool', () => {
    clearBoard();
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);
    expect(component.activeTool).toBe('threats-mine');
    expect(Object.keys(chessBoardStateService.boardHelper.arrows).length).toBeGreaterThan(0);

    component.showThreats(false);
    expect(component.activeTool).toBeNull();
    expect(Object.keys(chessBoardStateService.boardHelper.arrows).length).toBe(0);
  });

  it('clears previous overlay when a different tool is selected', () => {
    clearBoard();
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);
    expect(component.activeTool).toBe('threats-mine');

    component.showProtected(false);
    expect(component.activeTool).toBe('protected-mine');
    // arrows should now correspond to protection (gold) rather than threat
    const colors = Object.values(chessBoardStateService.boardHelper.arrows).map(a => a.color);
    expect(colors).toContain('gold');
  });

  it('flip action clears any active overlay and toggles selected state', () => {
    clearBoard();
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats(false);
    expect(component.activeTool).toBe('threats-mine');
    component.toggleBoardFlip();
    expect(component.activeTool).toBeNull();
    expect(chessBoardStateService.boardHelper.arrows).toEqual({});
    expect(component.isBoardFlipped).toBeTrue();
  });



  it('drag-enter preview marks dangerous move that allows mate in one', () => {
    clearBoard();
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[6][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[5][6] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.field[3][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.onDropListEntered(createEnterLike(7, 0, 6, 0));
    expect(component.isMateInOneBlunderTarget(6, 0)).toBeTrue();
  });

  it('drag-enter preview highlights mate-in-one winning target', () => {
    clearBoard();
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.onDropListEntered(createEnterLike(2, 1, 1, 1));
    expect(component.isMateInOneTarget(1, 1)).toBeTrue();
  });

  it('canDrop legality check does not mutate mate preview state', () => {
    clearBoard();
    chessBoardStateService.field[6][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    expect(canDropLike(6, 4, 5, 4)).toBeTrue();
    expect(component.isMateInOneTarget(5, 4)).toBeFalse();
    expect(component.isMateInOneBlunderTarget(5, 4)).toBeFalse();
  });

  it('returns highlight class with mate danger priority over other layers', () => {
    clearBoard();
    chessBoardStateService.boardHelper.possibles['44'] = { row: 4, col: 4 } as any;
    chessBoardStateService.boardHelper.hits['44'] = { row: 4, col: 4 } as any;
    component.mateInOneTargets['44'] = true;
    component.mateInOneBlunderTargets['44'] = true;

    expect(component.getSquareHighlightClass(4, 4)).toBe('mate-one-danger');
    delete component.mateInOneBlunderTargets['44'];
    expect(component.getSquareHighlightClass(4, 4)).toBe('mate-one');
    delete component.mateInOneTargets['44'];
    expect(component.getSquareHighlightClass(4, 4)).toBe('killer');
    delete chessBoardStateService.boardHelper.hits['44'];
    expect(component.getSquareHighlightClass(4, 4)).toBe('shaded');
  });

  it('writes pointer-down debug reasons for game over, empty square, and wrong turn', () => {
    chessBoardStateService.boardHelper.gameOver = true;
    component.onSquarePointerDown([] as any);
    expect(chessBoardStateService.boardHelper.debugText).toBe('· Game is over. Start a new game to move pieces.');

    chessBoardStateService.boardHelper.gameOver = false;
    component.onSquarePointerDown([] as any);
    expect(chessBoardStateService.boardHelper.debugText).toBe('· No piece on this square.');

    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    component.onSquarePointerDown([{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any]);
    expect(chessBoardStateService.boardHelper.debugText).toBe('· It is white\'s move.');
  });

  it('resets drag preview state when drag ends', () => {
    component.isDragPreviewActive = true;
    component.mateInOneTargets = { '11': true };
    component.mateInOneBlunderTargets = { '22': true };
    (component as any).lastMatePreviewKey = '12-34';

    component.onDragEnded();

    expect(component.isDragPreviewActive).toBeFalse();
    expect(component.mateInOneTargets).toEqual({});
    expect(component.mateInOneBlunderTargets).toEqual({});
    expect((component as any).lastMatePreviewKey).toBe('');
  });

  it('startOrPauseClock handles game-over, pause, and start branches', () => {
    const startClockSpy = spyOn<any>(component, 'startClock').and.callFake(() => undefined);
    const stopClockSpy = spyOn<any>(component, 'stopClock').and.callFake(() => undefined);

    chessBoardStateService.boardHelper.gameOver = true;
    component.clockRunning = false;
    component.startOrPauseClock();
    expect(startClockSpy).not.toHaveBeenCalled();
    expect(stopClockSpy).not.toHaveBeenCalled();

    chessBoardStateService.boardHelper.gameOver = false;
    component.clockRunning = true;
    component.startOrPauseClock();
    expect(stopClockSpy).toHaveBeenCalled();

    component.clockRunning = false;
    component.clockStarted = false;
    component.startOrPauseClock();
    expect(startClockSpy).toHaveBeenCalled();
    expect(component.clockStarted).toBeTrue();
  });

  it('resetClock applies selected preset and ignores unknown label', () => {
    const applyTimeControlSpy = spyOn(component, 'applyTimeControl').and.callThrough();

    component.selectedClockPresetLabel = '3+2';
    component.resetClock();
    expect(applyTimeControlSpy).toHaveBeenCalledWith(3, 2, '3+2');

    applyTimeControlSpy.calls.reset();
    component.selectedClockPresetLabel = 'does-not-exist';
    component.resetClock();
    expect(applyTimeControlSpy).not.toHaveBeenCalled();
  });

  it('tickClock decrements active side and triggers time forfeit at zero', () => {
    const dateNowSpy = spyOn(Date, 'now').and.returnValue(1200);
    const forfeitSpy = spyOn<any>(component, 'handleTimeForfeit').and.callFake(() => undefined);
    spyOn<any>(component, 'stopClock').and.callFake(() => undefined);

    chessBoardStateService.boardHelper.gameOver = false;
    component.clockRunning = true;
    component.clockStarted = true;
    (component as any).lastClockTickAt = 1000;

    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    component.whiteClockMs = 100;
    (component as any).tickClock();
    expect(component.whiteClockMs).toBe(0);
    expect(forfeitSpy).toHaveBeenCalledWith(ChessColorsEnum.White);

    forfeitSpy.calls.reset();
    dateNowSpy.and.returnValue(1300);
    (component as any).lastClockTickAt = 1200;
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    component.blackClockMs = 500;
    (component as any).tickClock();
    expect(component.blackClockMs).toBe(400);
    expect(forfeitSpy).not.toHaveBeenCalled();
  });

  it('tickClock stops immediately when clock is not active', () => {
    const stopClockSpy = spyOn<any>(component, 'stopClock').and.callFake(() => undefined);

    component.clockRunning = false;
    component.clockStarted = true;
    chessBoardStateService.boardHelper.gameOver = false;

    (component as any).tickClock();
    expect(stopClockSpy).toHaveBeenCalled();
  });

  it('toggles debug panel and info overlay state', () => {
    component.onDebugPanelToggle({ target: { open: true } } as any);
    expect(component.isDebugPanelOpen).toBeTrue();

    component.onDebugPanelToggle({ target: { open: false } } as any);
    expect(component.isDebugPanelOpen).toBeFalse();

    expect(component.isInfoOverlayOpen).toBeFalse();
  });

  it('reads check highlight through isCheck helper', () => {
    chessBoardStateService.boardHelper.checks['33'] = { row: 3, col: 3 } as any;
    expect(component.isCheck(3, 3)).toBeTrue();
    expect(component.isCheck(2, 2)).toBeFalse();
  });

  it('handles resign confirmation workflow wrappers', () => {
    const resignSpy = spyOn(component, 'resign').and.callFake(() => undefined);

    component.openResignConfirm(ChessColorsEnum.White);
    expect(component.resignConfirmColor).toBe(ChessColorsEnum.White);

    component.cancelResignConfirm();
    expect(component.resignConfirmColor).toBeNull();

    component.confirmResign();
    expect(resignSpy).not.toHaveBeenCalled();

    component.openResignConfirm(ChessColorsEnum.Black);
    component.confirmResign();
    expect(resignSpy).toHaveBeenCalledWith(ChessColorsEnum.Black);
    expect(component.resignConfirmColor).toBeNull();
  });

  it('supports undo and redo mock navigation over visible history', () => {
    chessBoardStateService.boardHelper.history = {
      '1': 'e2-e4',
      '2': 'e7-e5',
      '3': 'Ng1-f3'
    } as any;

    expect(component.canUndoMoveMock()).toBeTrue();
    expect(component.canRedoMoveMock()).toBeFalse();

    component.undoMoveMock();
    expect(component.mockHistoryCursor).toBe(1);
    expect(component.canRedoMoveMock()).toBeTrue();
    expect(component.getVisibleHistory()).toEqual(['e2-e4', 'e7-e5']);

    component.redoMoveMock();
    expect(component.mockHistoryCursor).toBeNull();
    expect(component.getVisibleHistory()).toEqual(['e2-e4', 'e7-e5', 'Ng1-f3']);
  });

  it('toggles board orientation', () => {
    expect(component.isBoardFlipped).toBeFalse();
    component.toggleBoardFlip();
    expect(component.isBoardFlipped).toBeTrue();
    component.toggleBoardFlip();
    expect(component.isBoardFlipped).toBeFalse();
  });

  it('returns debug castling rights notation', () => {
    const castlingRights = component.getDebugCastlingRights();
    expect(typeof castlingRights).toBe('string');
    expect(castlingRights.length).toBeGreaterThan(0);
  });

  it('produces mock export and annotation helper outputs', () => {
    component.exportPgnMock();
    expect(component.mockExportMessage).toContain('Mock export: PGN ready');

    component.exportBoardImageMock();
    expect(component.mockExportMessage).toContain('Mock export: Board image ready');

    component.exportFenMock();
    expect(component.mockExportMessage).toContain('Mock export: FEN copied');

    component.showForkIdeasMock();
    expect(chessBoardStateService.boardHelper.debugText).toContain('Mock: Fork ideas highlighted');
    expect(component.activeTool).toBeNull();
    expect(chessBoardStateService.boardHelper.arrows).toEqual({});

    component.showPinIdeasMock();
    expect(chessBoardStateService.boardHelper.debugText).toContain('Mock: Pin opportunities highlighted');
    expect(component.activeTool).toBeNull();
    expect(chessBoardStateService.boardHelper.arrows).toEqual({});
  });

  it('returns move class based on suggested move notation', () => {
    expect(component.getSuggestedMoveClass('Qh5+')).toBe('suggested-move--check');
    expect(component.getSuggestedMoveClass('Nxe5')).toBe('suggested-move--capture');
    expect(component.getSuggestedMoveClass('d4')).toBe('suggested-move--threat');
    expect(component.getSuggestedMoveClass('')).toBe('suggested-move--threat');
  });

  it('returns mock opening and endgame defaults', () => {
    (component as any).openingsLoaded = false;
    expect(component.getMockOpeningRecognition()).toBe('Waiting for opening line...');
    expect(component.getMockEndgameRecognition()).toBe('Not endgame yet (mock)');
  });

  it('evaluates board via showPossibleMoves and clears overlays', () => {
    chessBoardStateService.boardHelper.possibles['44'] = { row: 4, col: 4 } as any;
    chessBoardStateService.boardHelper.hits['44'] = { row: 4, col: 4 } as any;
    chessBoardStateService.boardHelper.checks['44'] = { row: 4, col: 4 } as any;
    chessBoardStateService.boardHelper.arrows['a'] = { left: '1px' } as any;

    const canStepSpy = spyOn(ChessRulesService, 'canStepThere').and.returnValue(false);
    component.showPossibleMoves(ChessColorsEnum.White);

    expect(canStepSpy).toHaveBeenCalled();
    expect(chessBoardStateService.boardHelper.possibles).toEqual({});
    expect(chessBoardStateService.boardHelper.hits).toEqual({});
    expect(chessBoardStateService.boardHelper.checks).toEqual({});
    expect(chessBoardStateService.boardHelper.arrows).toEqual({});
    expect(component.activeTool).toBeNull();
  });

  it('parses suggested moves through preview and creates then clears arrows', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.previewSuggestedMoveArrows('Nf3');
    expect(Object.keys(chessBoardStateService.boardHelper.arrows).length).toBeGreaterThan(0);

    component.clearSuggestedMoveArrows();
    expect((component as any).suggestedMoveArrowSnapshot).toBeNull();
  });

  it('returns threats on a square and visualizes protected/hanging pieces', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[4][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[4][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    const threatsOn = component.getThreatsOn(
      chessBoardStateService.field[4][4],
      4,
      4,
      ChessColorsEnum.White,
      ChessColorsEnum.Black
    );
    expect(Array.isArray(threatsOn)).toBeTrue();

    component.showProtected(false);
    expect(chessBoardStateService.boardHelper.arrows).toBeDefined();

    component.showHangingPieces(false);
    expect(chessBoardStateService.boardHelper.arrows).toBeDefined();
  });

  it('resets transient and board state through internal helpers', () => {
    component.pendingDrawOfferBy = ChessColorsEnum.Black;
    component.resignConfirmColor = ChessColorsEnum.White;
    component.mockHistoryCursor = 3;
    component.mockExportMessage = 'x';
    component.mateInOneTargets = { '11': true };
    component.mateInOneBlunderTargets = { '22': true };
    (component as any).lastMatePreviewKey = 'x';

    (component as any).resetTransientUiState();
    expect(component.pendingDrawOfferBy).toBeNull();
    expect(component.resignConfirmColor).toBeNull();
    expect(component.mockHistoryCursor).toBeNull();
    expect(component.mockExportMessage).toBe('');
    expect(component.mateInOneTargets).toEqual({});
    expect(component.mateInOneBlunderTargets).toEqual({});

    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    chessBoardStateService.boardHelper.gameOver = true;
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    (component as any).resetBoardState();
    expect(chessBoardStateService.boardHelper.gameOver).toBeFalse();
    expect(chessBoardStateService.boardHelper.colorTurn).toBe(ChessColorsEnum.White);
    expect(chessBoardStateService.history.length).toBe(0);
    expect(chessBoardStateService.field[7][4][0].piece).toBe(ChessPiecesEnum.King);
  });

  it('handles time forfeit and records result suffix', () => {
    chessBoardStateService.boardHelper.gameOver = false;
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.clockRunning = true;

    (component as any).handleTimeForfeit(ChessColorsEnum.Black);

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.debugText).toContain('Black forfeits on time');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1-0 {Black forfeits on time}');
  });

  it('handles black-side en passant branch', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[4][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.boardHelper.history = { '1': 'c2-c4' } as any;

    expect(canDropLike(4, 3, 5, 2)).toBeTrue();
    component.onDrop(createDropLike(4, 3, 5, 2));

    expect(chessBoardStateService.field[4][2].length).toBe(0);
    expect(chessBoardStateService.field[5][2][0].color).toBe(ChessColorsEnum.Black);
  });

  it('records white checkmate winner text branch', () => {
    clearBoard();
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    expect(canDropLike(2, 1, 1, 1)).toBeTrue();
    component.onDrop(createDropLike(2, 1, 1, 1));

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBe(ChessColorsEnum.Black);
    expect(chessBoardStateService.boardHelper.debugText).toContain('Checkmate! White wins.');
  });

  it('runs startNewGame and startClock callback branches', () => {
    const reloadSpy = jasmine.createSpy('reload');
    (component as any).windowRef = { location: { reload: reloadSpy } };
    component.startNewGame();
    expect(reloadSpy).toHaveBeenCalled();

    const tickSpy = spyOn<any>(component, 'tickClock').and.callFake(() => undefined);
    const setIntervalSpy = spyOn(window, 'setInterval').and.callFake((callback: TimerHandler) => {
      (callback as Function)();
      return 1 as any;
    });
    const clearIntervalSpy = spyOn(window, 'clearInterval').and.callFake(() => undefined);

    component.clockRunning = false;
    (component as any).clockIntervalId = null;
    (component as any).startClock();
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(tickSpy).toHaveBeenCalled();

    (component as any).stopClock();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('covers openings payload mapping and loadOpenings error callback', () => {
    const openingAwareComponent = new ChessBoardComponent(chessBoardStateService, {
      get: () => of([
        { name: 'Valid Opening', long_algebraic_notation: '1. e2-e4 e7-e5' },
        { name: 'Invalid Opening', long_algebraic_notation: '' } as any
      ])
    } as any);

    expect((openingAwareComponent as any).openingsLoaded).toBeTrue();
    expect((openingAwareComponent as any).openings.length).toBeGreaterThan(0);

    const errorComponent = new ChessBoardComponent(chessBoardStateService, {
      get: () => throwError(() => new Error('failed to load'))
    } as any);

    expect((errorComponent as any).openingsLoaded).toBeTrue();
  });

  it('shows hanging-piece arrows when an unprotected piece is threatened', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[4][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showHangingPieces(false);
    expect(Object.keys(chessBoardStateService.boardHelper.arrows).length).toBeGreaterThan(0);
  });

  it('declares insufficient-material draw for black two knights vs king branch', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[0][6] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;

    expect(canDropLike(0, 1, 2, 2)).toBeTrue();
    component.onDrop(createDropLike(0, 1, 2, 2));

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by insufficient material.');
  });
});
describe('ChessBoardComponent template drag-enter integration', () => {
  let fixture: ComponentFixture<ChessBoardComponent>;
  let component: ChessBoardComponent;
  let chessBoardStateService: ChessBoardStateService;

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChessBoardComponent],
      imports: [DragDropModule],
      providers: [ChessBoardStateService, provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ChessBoardComponent);
    component = fixture.componentInstance;
    chessBoardStateService = TestBed.inject(ChessBoardStateService);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('applies mate-one-danger class on target square when cdkDropListEntered fires for a blunder move', () => {
    clearBoard();
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[6][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[5][6] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.field[3][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

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

  it('buttons receive time-btn--selected class based on activeTool and flip state (integration)', () => {
    // this spec runs inside the fixture-enabled describe
    fixture.detectChanges();
    const threatsBtn: HTMLElement = fixture.nativeElement.querySelector('button[aria-label="My threats"]');
    const flipBtn: HTMLElement = fixture.nativeElement.querySelector('button[aria-label="Flip board"]');

    component.showThreats(false);
    fixture.detectChanges();
    expect(threatsBtn.classList).toContain('time-btn--selected');

    component.showProtected(false);
    fixture.detectChanges();
    expect(threatsBtn.classList).not.toContain('time-btn--selected');

    component.toggleBoardFlip();
    fixture.detectChanges();
    expect(flipBtn.classList).toContain('time-btn--selected');
  });

  it('applies mate-one class on target square when cdkDropListEntered fires for a winning mate move', () => {
    clearBoard();
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

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
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    chessBoardStateService.boardHelper.history = {};
    for (let i = 1; i <= 100; i++) {
      chessBoardStateService.boardHelper.history[`${i}`] = 'Ng1-f3';
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

    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
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

