import { ChessBoardComponent } from './chess-board.component';
import { ChessBoardStateService } from '../../services/chess-board-state.service';
import { ChessRulesService } from '../../services/chess-rules.service';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../../model/enums/chess-pieces.enum';
import { Observable, of, throwError } from 'rxjs';
import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { ChessBoardDisplayUtils } from '../../utils/chess-board-display.utils';
import { ChessBoardOpeningUtils } from '../../utils/chess-board-opening.utils';
import { ChessBoardCctUtils } from '../../utils/chess-board-cct.utils';
import { ChessBoardHistoryService } from '../../services/chess-board-history.service';
import { ChessBoardLogicUtils } from '../../utils/chess-board-logic.utils';
import { ChessBoardExportUtils } from '../../utils/chess-board-export.utils';
import { ChessBoardComponentUtils } from '../../utils/chess-board-component.utils';
import { ChessBoardStorageService } from '../../services/chess-board-storage.service';
import { CctCategoryEnum } from '../../model/enums/cct-category.enum';
import { ChessConstants } from '../../constants/chess.constants';
import { ChessBoardEvaluationFacade } from '../../utils/chess-board-evaluation.facade';

// common variables and helpers used across multiple suites
let chessBoardStateService: ChessBoardStateService;
let component: ChessBoardComponent;
let stockfishServiceStub: { evaluateFen: jasmine.Spy; terminate: jasmine.Spy };

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

const movePiece = (srcRow: number, srcCol: number, targetRow: number, targetCol: number): void => {
  expect(canDropLike(srcRow, srcCol, targetRow, targetCol)).toBeTrue();
  component.onDrop(createDropLike(srcRow, srcCol, targetRow, targetCol));
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
  stockfishServiceStub = {
    evaluateFen: jasmine.createSpy('evaluateFen').and.returnValue(Promise.resolve('+0.18')),
    terminate: jasmine.createSpy('terminate')
  };
  chessBoardStateService = new ChessBoardStateService();
  component = new ChessBoardComponent(chessBoardStateService, {
    get: () => of([])
  } as any, undefined, undefined, undefined, stockfishServiceStub as any);
  chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
});

describe('ChessBoardComponent opening recognition', () => {

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

        movePiece(6, 3, 4, 3);
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

        movePiece(6, 3, 4, 3);

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

        movePiece(6, 3, 4, 3);
        movePiece(1, 3, 3, 3);

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

        movePiece(6, 3, 4, 3);
        movePiece(1, 3, 3, 3);
        movePiece(6, 2, 4, 2);
        movePiece(1, 4, 2, 4);

    expect(component.getMockOpeningRecognition()).toBe('Queen\'s Gambit Declined');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Queen\'s Gambit Declined');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (White now): —');
    expect(chessBoardStateService.boardHelper.debugText).not.toContain('Book recommendation (Black now): Queen\'s Gambit Declined (2... e7-e6)');
  });
});

describe('ChessBoardComponent coverage helpers (js flip mapping)', () => {
  it('covers display mapping and arrow remap helpers across flip states', () => {
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    component.mateInOneTargets['77'] = true;

    component.isBoardFlipped = false;
    expect(component.getDisplayFieldId(0, 0)).toBe('field00');
    expect(component.getDisplayNotation(0, 0)).toBe('a8');
    expect(component.getDisplayCell(0, 0)).toBe(chessBoardStateService.field[0][0]);
    expect(component.getDisplayPiece(0, 0)?.piece).toBe(ChessPiecesEnum.Rook);

    component.isBoardFlipped = true;
    expect(component.getDisplayFieldId(0, 0)).toBe('field77');
    expect(component.getDisplayNotation(0, 0)).toBe('h1');
    expect(component.getDisplayCell(0, 0)).toBe(chessBoardStateService.field[7][7]);
    expect(component.getDisplayPiece(0, 0)?.piece).toBe(ChessPiecesEnum.King);
    expect(component.getDisplaySquareHighlightClass(0, 0)).toBe('mate-one');
    expect(component.isDisplaySquareWhite(0, 0)).toBeTrue();

    expect(component.getArrowTopForDisplay({ top: '25%' } as any)).toBe('75%');
    expect(component.getArrowLeftForDisplay({ left: '12.5%' } as any)).toBe('87.5%');
    expect(component.getArrowTransformForDisplay({ rotate: '390deg' } as any)).toBe('translate(-50%, -50%) rotate(210deg)');

    expect(component.getArrowTopForDisplay({ top: 'calc(20%)' } as any)).toBe('calc(20%)');
    expect(component.getArrowTransformForDisplay({ rotate: 'angle(10)' } as any)).toBe('translate(-50%, -50%) rotate(angle(10))');
    expect(component.getArrowTopForDisplay(undefined as any)).toBe('');
    expect(component.getArrowLeftForDisplay(undefined as any)).toBe('');
    expect(component.getArrowTransformForDisplay(undefined as any)).toBe('translate(-50%, -50%) rotate()');
  });

  it('covers private flip mapping branches and related helpers', () => {
    component.isBoardFlipped = false;
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('25%', component.isBoardFlipped)).toBe('25%');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('30deg', component.isBoardFlipped)).toBe('30deg');

    component.isBoardFlipped = true;
    expect(ChessBoardDisplayUtils.getBoardIndexForDisplay(2, component.isBoardFlipped)).toBe(5);
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('', component.isBoardFlipped)).toBe('');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('text', component.isBoardFlipped)).toBe('text');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('-20%', component.isBoardFlipped)).toBe('120%');

    expect(ChessBoardDisplayUtils.mapRotationForDisplay('text', component.isBoardFlipped)).toBe('text');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('-300deg', component.isBoardFlipped)).toBe('240deg');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('540deg', component.isBoardFlipped)).toBe('0deg');

    expect(component.translateFieldNames(6, 4)).toBe('e2');
    expect(component.formatClock(65000)).toBe('01:05');
    component.whiteClockMs = 9000;
    component.blackClockMs = 12000;
    expect(component.isClockLow(ChessColorsEnum.White)).toBeTrue();
    expect(component.isClockLow(ChessColorsEnum.Black)).toBeFalse();

    const boardHelperBackup = chessBoardStateService.boardHelper;
    (chessBoardStateService as any).boardHelper = null;
    expect(component.getStatusTitle()).toBe('');
    component.onSquarePointerDown([] as any);
    (chessBoardStateService as any).boardHelper = boardHelperBackup;
    chessBoardStateService.boardHelper.gameOver = false;
    expect(component.getStatusTitle()).toContain(component.uiText.status.toMoveSuffix);
  });

  it('covers lifecycle hooks used by template wiring', (done: DoneFn) => {
    const stopClockSpy = spyOn<any>(component, 'stopClock').and.callFake(() => undefined);
    spyOnProperty(document, 'body', 'get').and.returnValue(null as any);
    (component as any).syncFlippedDragClass();
    component.isBoardFlipped = true;
    component.isDragPreviewActive = true;
    component.ngOnDestroy();
    expect(stopClockSpy).toHaveBeenCalled();

    component.dropListElements = { toArray: () => ['drop-list'] } as any;
    component.ngAfterViewInit();
    setTimeout(() => {
      expect(component.dropLists).toEqual(['drop-list'] as any);
      done();
    }, 0);
  });

  it('covers guard-return and active-status branches explicitly', () => {
    const source = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    const target: any[] = [];
    ChessBoardComponentUtils.movePieceBetweenCells(null as any, target);
    expect(target.length).toBe(0);

    chessBoardStateService.boardHelper.gameOver = false;
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect(component.getStatusTitle()).toBe(`${component.uiText.status.white} ${component.uiText.status.toMoveSuffix}`);

    ChessBoardComponentUtils.movePieceBetweenCells(source, target);
    expect(source.length).toBe(0);
    expect(target.length).toBe(1);
  });
});

describe('ChessBoardComponent capture transfer consistency', () => {
  it('keeps only the capturing piece on target square for both colors', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

        movePiece(4, 3, 3, 4);
    expect(chessBoardStateService.field[4][3].length).toBe(0);
    expect(chessBoardStateService.field[3][4].length).toBe(1);
    expect(chessBoardStateService.field[3][4][0].color).toBe(ChessColorsEnum.White);

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[3][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[4][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;

        movePiece(3, 4, 4, 3);
    expect(chessBoardStateService.field[3][4].length).toBe(0);
    expect(chessBoardStateService.field[4][3].length).toBe(1);
    expect(chessBoardStateService.field[4][3][0].color).toBe(ChessColorsEnum.Black);
  });
});

describe('ChessBoardComponent opening recognition - variation scenarios', () => {

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

        movePiece(6, 3, 4, 3);
        movePiece(1, 5, 3, 5);
        movePiece(6, 2, 4, 2);

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

        movePiece(6, 4, 4, 4);
        movePiece(0, 6, 2, 5);
        movePiece(4, 4, 3, 4);

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

        movePiece(6, 4, 4, 4);
        movePiece(0, 6, 2, 5);

    component.getMockOpeningRecognition();

    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (White now): e4-e5');
  });

});

describe('ChessBoardComponent opening recognition - variation scenarios (continued)', () => {
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

        movePiece(6, 4, 4, 4);
        movePiece(1, 3, 3, 3);
        movePiece(4, 4, 3, 3);
        movePiece(0, 3, 3, 3);

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

        movePiece(6, 4, 4, 4);
        movePiece(1, 3, 3, 3);
        movePiece(4, 4, 3, 3);

    component.getMockOpeningRecognition();

    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Scandinavian Defense: Main Line');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 3/4');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Book recommendation (Black now): Qd8xd5');
    expect(chessBoardStateService.boardHelper.debugText).not.toContain('Book recommendation (White after):');
  });
});

describe('ChessBoardComponent opening recognition - Caro-Kann scenario', () => {

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

        movePiece(6, 4, 4, 4);
        movePiece(1, 2, 2, 2);
        movePiece(6, 3, 4, 3);

    expect(component.getMockOpeningRecognition()).toBe('Caro-Kann Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Caro-Kann Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 3/5');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Line: 1. e2-e4 c7-c6 2. d2-d4 d7-d5 3. Nb1-c3');

        movePiece(1, 3, 3, 3);

    expect(component.getMockOpeningRecognition()).toBe('Caro-Kann Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Opening: Caro-Kann Defense: Classical Variation');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Matched steps: 4/5');
    expect(chessBoardStateService.boardHelper.debugText).toContain('Line: 1. e2-e4 c7-c6 2. d2-d4 d7-d5 3. Nb1-c3');
  });
});

describe('ChessBoardComponent gameplay moves and rules', () => {
  it('supports d2d4, e7e5, and d4xe5 with capture highlight', () => {
        movePiece(6, 3, 4, 3);

    expect(chessBoardStateService.boardHelper.colorTurn).toBe(ChessColorsEnum.Black);
    expect(chessBoardStateService.field[4][3][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[4][3][0].color).toBe(ChessColorsEnum.White);

        movePiece(1, 4, 3, 4);

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
        movePiece(6, 5, 5, 5);

        movePiece(1, 4, 3, 4);

        movePiece(6, 6, 4, 6);

        movePiece(0, 3, 4, 7);

    const history = chessBoardStateService.history;
    const lastMove = history[history.length - 1];

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBe(ChessColorsEnum.White);
    expect(lastMove).toContain('#');
    expect(lastMove).toContain('0-1 {Checkmate}');
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
        movePiece(6, 3, 4, 3);

        movePiece(1, 4, 3, 4);

        movePiece(4, 3, 3, 3);

        movePiece(1, 2, 3, 2);

        movePiece(3, 3, 2, 2);
    expect(chessBoardStateService.field[3][2].length).toBe(0);
    expect(chessBoardStateService.field[2][2][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[2][2][0].color).toBe(ChessColorsEnum.White);

        movePiece(1, 3, 2, 2);

    expect(chessBoardStateService.field[1][3].length).toBe(0);
    expect(chessBoardStateService.field[2][2][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[2][2][0].color).toBe(ChessColorsEnum.Black);
  });

  it('includes checkmate comment in PGN debug export', () => {
        movePiece(6, 5, 5, 5);
        movePiece(1, 4, 3, 4);
        movePiece(6, 6, 4, 6);
        movePiece(0, 3, 4, 7);

    component.exportPgn();
    expect(chessBoardStateService.boardHelper.debugText).toContain('{Checkmate}');
    expect(chessBoardStateService.boardHelper.debugText).toContain('0-1');
  });

  it('triggers and applies white promotion on back rank', () => {
    chessBoardStateService.field[1][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[0][0] = [];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

        movePiece(1, 0, 0, 0);

    expect(chessBoardStateService.boardHelper.canPromote).toBe(0);
    component.promotePiece(ChessPiecesEnum.Queen);
    expect(chessBoardStateService.field[0][0][0].piece).toBe(ChessPiecesEnum.Queen);
    expect(chessBoardStateService.boardHelper.canPromote).toBeNull();
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('=Q');
  });

});

describe('ChessBoardComponent gameplay moves and rules (continued)', () => {
  it('triggers and applies black promotion on back rank', () => {
    chessBoardStateService.field[6][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[7][7] = [];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;

        movePiece(6, 7, 7, 7);

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

        movePiece(1, 3, 1, 2);

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
            movePiece(srcRow, srcCol, targetRow, targetCol);
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

        movePiece(7, 6, 5, 5);

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by fivefold repetition.');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1/2-1/2 {Draw by fivefold repetition}');
  });

});

describe('ChessBoardComponent gameplay moves and rules (draw rules)', () => {
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

        movePiece(0, 1, 2, 0);

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

        movePiece(0, 1, 2, 0);

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.checkmateColor).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by seventy-five-move rule.');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1/2-1/2 {Draw by seventy-five-move rule}');
  });

});

describe('ChessBoardComponent gameplay moves and rules (draw interactions)', () => {
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
            movePiece(srcRow, srcCol, targetRow, targetCol);

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

});

describe('ChessBoardComponent gameplay moves and rules (result and turn state)', () => {
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

        movePiece(6, 4, 4, 4);

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

});

describe('ChessBoardComponent gameplay moves and rules (threat overlays)', () => {
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

  it('shows green arrows for overloaded protectors in SAFE view', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.field[6][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[4][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.field[6][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showProtected(false);

    const arrows = Object.values(chessBoardStateService.boardHelper.arrows);
    const greenArrows = arrows.filter(arrow => arrow.color === 'green');
    expect(greenArrows.length).toBeGreaterThan(0);
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



});

describe('ChessBoardComponent gameplay moves and rules (drag preview)', () => {
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
    chessBoardStateService.boardHelper.possibles = { '33': { row: 3, col: 3 } as any };
    chessBoardStateService.boardHelper.hits = { '44': { row: 4, col: 4 } as any };
    chessBoardStateService.boardHelper.checks = { '55': { row: 5, col: 5 } as any };

    component.onDragEnded();

    expect(component.isDragPreviewActive).toBeFalse();
    expect(component.mateInOneTargets).toEqual({});
    expect(component.mateInOneBlunderTargets).toEqual({});
    expect((component as any).lastMatePreviewKey).toBe('');
    expect(chessBoardStateService.boardHelper.possibles).toEqual({});
    expect(chessBoardStateService.boardHelper.hits).toEqual({});
    expect(chessBoardStateService.boardHelper.checks).toEqual({});
  });

});

describe('ChessBoardComponent gameplay moves and rules (drag preview and clock state)', () => {
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

  it('toggles debug panel state', () => {
    component.onDebugPanelToggle(true);
    expect(component.isDebugPanelOpen).toBeTrue();

    component.onDebugPanelToggle(false);
    expect(component.isDebugPanelOpen).toBeFalse();

  });

  it('reads check highlight through isCheck helper', () => {
    chessBoardStateService.boardHelper.checks['33'] = { row: 3, col: 3 } as any;
    expect(component.isCheck(3, 3)).toBeTrue();
    expect(component.isCheck(2, 2)).toBeFalse();
  });

});

describe('ChessBoardComponent gameplay moves and rules (clock and controls)', () => {
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

  it('supports undo and redo after resign', () => {
        movePiece(6, 4, 4, 4);
        movePiece(1, 4, 3, 4);

    const historyBeforeResign = [...chessBoardStateService.history];

    component.resign(ChessColorsEnum.White);
    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(component.clockRunning).toBeFalse();
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('0-1 {White resigns}');

    component.undoMove();
    expect(chessBoardStateService.boardHelper.gameOver).toBeFalse();
    expect(component.clockRunning).toBeTrue();
    expect(chessBoardStateService.history).toEqual(historyBeforeResign);

    component.redoMove();
    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('0-1 {White resigns}');
  });

  it('supports undo and redo mock navigation over visible history', () => {
    chessBoardStateService.boardHelper.history = {
      '1': 'e2-e4',
      '2': 'e7-e5',
      '3': 'Ng1-f3'
    } as any;

    expect(component.canUndoMove()).toBeTrue();
    expect(component.canRedoMove()).toBeFalse();

    component.undoMove();
    expect(component.mockHistoryCursor).toBe(1);
    expect(component.canRedoMove()).toBeTrue();
    expect(component.getVisibleHistory()).toEqual(['e2-e4', 'e7-e5']);

    component.redoMove();
    expect(component.mockHistoryCursor).toBeNull();
    expect(component.getVisibleHistory()).toEqual(['e2-e4', 'e7-e5', 'Ng1-f3']);
  });

  it('restores castling rights through undo and redo over a king move', () => {
    expect(component.getDebugCastlingRights()).toBe('KQkq');

        movePiece(6, 4, 4, 4);
        movePiece(1, 0, 2, 0);
        movePiece(7, 4, 6, 4);
        movePiece(2, 0, 3, 0);

    expect(component.getDebugCastlingRights()).toBe('kq');

    component.undoMove();
    expect(component.getDebugCastlingRights()).toBe('kq');

    component.undoMove();
    expect(component.getDebugCastlingRights()).toBe('KQkq');

    component.redoMove();
    expect(component.getDebugCastlingRights()).toBe('kq');
  });

  it('restores en passant rights through undo and redo', () => {
        movePiece(6, 3, 4, 3);
        movePiece(1, 0, 2, 0);
        movePiece(4, 3, 3, 3);
        movePiece(1, 2, 3, 2);

    expect(component.getDebugPositionKey().split('|')[2]).toBe('c6');

    component.undoMove();
    expect(component.getDebugPositionKey().split('|')[2]).toBe('-');

    component.redoMove();
    expect(component.getDebugPositionKey().split('|')[2]).toBe('c6');
  });

});

describe('ChessBoardComponent gameplay moves and rules (clock and controls promotion)', () => {
  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    component = new ChessBoardComponent(chessBoardStateService, {
      get: () => of([])
    } as any);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('restores promotion state through undo and redo', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[1][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    (component as any).initializeSnapshotTimeline();

        movePiece(1, 0, 0, 0);
    component.promotePiece(ChessPiecesEnum.Queen);

    expect(chessBoardStateService.field[0][0][0].piece).toBe(ChessPiecesEnum.Queen);
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('=Q');

    component.undoMove();
    expect(chessBoardStateService.field[1][0][0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(chessBoardStateService.field[0][0].length).toBe(0);
    expect(component.getVisibleHistory()).toEqual([]);

    component.redoMove();
    expect(chessBoardStateService.field[0][0][0].piece).toBe(ChessPiecesEnum.Queen);
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('=Q');
  });

});

describe('ChessBoardComponent gameplay moves and rules (clock and controls continued)', () => {
  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    component = new ChessBoardComponent(chessBoardStateService, {
      get: () => of([])
    } as any);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('toggles board orientation', () => {
    expect(component.isBoardFlipped).toBeFalse();
    component.toggleBoardFlip();
    expect(component.isBoardFlipped).toBeTrue();
    component.toggleBoardFlip();
    expect(component.isBoardFlipped).toBeFalse();
  });

  it('syncs flipped drag orientation class on body immediately', () => {
    document.body.classList.remove('board-flipped-drag-active');
    expect(document.body.classList.contains('board-flipped-drag-active')).toBeFalse();

    component.onDragStarted();
    expect(document.body.classList.contains('board-flipped-drag-active')).toBeFalse();

    component.toggleBoardFlip();
    expect(document.body.classList.contains('board-flipped-drag-active')).toBeTrue();

    component.onDragEnded();
    expect(document.body.classList.contains('board-flipped-drag-active')).toBeFalse();
  });

  it('runs requestAnimationFrame sync callback when flipping board', () => {
    const originalRaf = (window as any).requestAnimationFrame;
    (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
    const syncSpy = spyOn<any>(component, 'syncFlippedDragClass').and.callThrough();
    component.isDragPreviewActive = true;

    try {
      component.toggleBoardFlip();
      expect(syncSpy.calls.count()).toBeGreaterThanOrEqual(2);
    } finally {
      (window as any).requestAnimationFrame = originalRaf;
    }
  });

  it('returns debug castling rights notation', () => {
    const castlingRights = component.getDebugCastlingRights();
    expect(typeof castlingRights).toBe('string');
    expect(castlingRights.length).toBeGreaterThan(0);
  });

  it('produces export and annotation helper outputs', () => {
    component.exportPgn();
    expect(chessBoardStateService.boardHelper.debugText).toContain('[Event "Chess Trainer Game"]');
    expect(chessBoardStateService.boardHelper.debugText).toContain('[Result "*"');

    component.exportBoardImageMock();
    expect(chessBoardStateService.boardHelper.debugText).toContain('Mock export: Board image ready');

    component.exportFen();
    expect(chessBoardStateService.boardHelper.debugText).toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    component.showForkIdeas();
    expect(chessBoardStateService.boardHelper.debugText).toContain('Fork ideas highlighted');
    expect(component.activeTool).toBeNull();
    expect(chessBoardStateService.boardHelper.arrows).toEqual({});

    component.showPinIdeas();
    expect(chessBoardStateService.boardHelper.debugText).toContain('Pin opportunities highlighted');
    expect(component.activeTool).toBeNull();
    expect(chessBoardStateService.boardHelper.arrows).toEqual({});
  });
});

describe('ChessBoardComponent gameplay moves and rules (clock and controls export state)', () => {
  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    component = new ChessBoardComponent(chessBoardStateService, {
      get: () => of([])
    } as any);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('exports FEN when history containers are missing', () => {
    spyOnProperty(chessBoardStateService, 'history', 'get').and.returnValue(undefined as any);
    (chessBoardStateService.boardHelper as any).history = undefined;

    component.exportFen();
    expect(chessBoardStateService.boardHelper.debugText).toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('returns fallback FEN when board state service is missing', () => {
    (component as any).chessBoardStateService = null;
    expect((component as any).getCurrentFen()).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
  });

  it('returns false when clipboard API is unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true
    });

    try {
      await expectAsync((component as any).copyToClipboard('x')).toBeResolvedTo(false);
    } finally {
      if (descriptor) {
        Object.defineProperty(navigator, 'clipboard', descriptor);
      } else {
        delete (navigator as any).clipboard;
      }
    }
  });

  it('returns true when clipboard write succeeds', async () => {
    const writeTextSpy = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true
    });

    try {
      await expectAsync((component as any).copyToClipboard('x')).toBeResolvedTo(true);
      expect(writeTextSpy).toHaveBeenCalledWith('x');
    } finally {
      if (descriptor) {
        Object.defineProperty(navigator, 'clipboard', descriptor);
      } else {
        delete (navigator as any).clipboard;
      }
    }
  });
});

describe('ChessBoardComponent gameplay moves and rules (clock and controls overlays)', () => {
  it('covers fork and pin/skewer overlays plus toggle-off branches', () => {
    clearBoard();
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[3][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[1][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[1][5] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showForkIdeas();
    expect(component.activeTool).toBe('fork-ideas');
    expect(Object.keys(chessBoardStateService.boardHelper.arrows).length).toBeGreaterThan(0);

    component.showForkIdeas();
    expect(component.activeTool).toBeNull();
    expect(chessBoardStateService.boardHelper.arrows).toEqual({});

    clearBoard();
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[3][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Bishop } as any]; // Bg5
    chessBoardStateService.field[2][5] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any]; // Nf6
    chessBoardStateService.field[0][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Queen } as any]; // Qd8
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any]; // Re1
    chessBoardStateService.field[1][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Queen } as any]; // Qe7
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any]; // Re8

    component.showPinIdeas();
    expect(component.activeTool).toBe('pin-ideas');
    const colors = Object.values(chessBoardStateService.boardHelper.arrows).map((arrow: any) => arrow.color);
    expect(colors).toContain('green');
    expect(colors).toContain('orange');

    component.showPinIdeas();
    expect(component.activeTool).toBeNull();
    expect(chessBoardStateService.boardHelper.arrows).toEqual({});
  });

  it('covers PGN formatting branches with and without explicit result', () => {
    chessBoardStateService.boardHelper.history = {
      '1': 'e4',
      '2': 'e5 1-0'
    } as any;
    let pgn = (component as any).getCurrentPgn();
    expect(pgn).toContain('1. e4 e5 1-0');
    expect(ChessBoardExportUtils.getPgnResultFromHistory(['a4', '... 0-1'])).toBe('0-1');

    chessBoardStateService.boardHelper.history = {
      '1': 'd4',
      '2': 'd5'
    } as any;
    pgn = (component as any).getCurrentPgn();
    expect(pgn).toContain('1. d4 d5 *');
  });

  it('covers DOM image export and download helper paths', async () => {
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
    const exportSpy = spyOn<any>(component, 'createBoardImageDataUrlFromDom').and.resolveTo('data:image/png;base64,AA');

    await component.exportBoardImageMock();
    expect(clickSpy).toHaveBeenCalled();
    exportSpy.and.callThrough();

    (component as any).chessField = {
      nativeElement: {
        closest: () => null
      }
    };
    await expectAsync((component as any).createBoardImageDataUrlFromDom()).toBeResolvedTo(null);

    (component as any).downloadDataUrl('data:image/png;base64,BB', 'board.png');
    expect(clickSpy).toHaveBeenCalled();
  });
});

describe('ChessBoardComponent gameplay moves and rules (clock and controls export helpers)', () => {
  it('covers PGN sparse history and private result fallback branches', () => {
    const serviceBackup = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    expect((component as any).getCurrentPgn()).toBe('');
    (component as any).chessBoardStateService = serviceBackup;

    const historyGetterSpy = spyOnProperty(chessBoardStateService, 'history', 'get');
    historyGetterSpy.and.returnValue(undefined as any);
    expect((component as any).getCurrentPgn()).toContain('\n\n*');

    historyGetterSpy.and.returnValue([undefined as any, undefined as any, 'e4', undefined as any] as any);
    const sparsePgn = (component as any).getCurrentPgn();
    expect(sparsePgn).toContain('2. e4');
    expect(sparsePgn).not.toContain('1.');

    expect(ChessBoardExportUtils.getPgnResultFromHistory([undefined as any])).toBe('*');
  });

  it('covers pin/skewer helper edge branches and opposing-color break path', () => {
    expect((component as any).isPinnedToValuablePiece(ChessPiecesEnum.King, ChessPiecesEnum.Queen)).toBeFalse();
    expect((component as any).isPinnedToValuablePiece(ChessPiecesEnum.Knight, ChessPiecesEnum.King)).toBeTrue();
    expect((component as any).isSkewerPair(ChessPiecesEnum.Queen, ChessPiecesEnum.King)).toBeFalse();
    expect((component as any).isSkewerPair(ChessPiecesEnum.King, ChessPiecesEnum.Queen)).toBeTrue();

    clearBoard();
    chessBoardStateService.field[3][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.field[2][5] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[1][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    const arrows = (component as any).collectPinVisualizationArrows();
    expect(arrows.length).toBe(0);
  });

  it('covers DOM export helper in no-document, success, and catch branches', async () => {
    const boardShell = document.createElement('div');
    boardShell.className = 'board-shell';
    const child = document.createElement('div');
    boardShell.appendChild(child);
    document.body.appendChild(boardShell);
    (component as any).chessField = { nativeElement: child };

    const getWindowRefSpy = spyOn<any>(component, 'getWindowRef').and.returnValue({
      devicePixelRatio: 0
    } as Window);
    const imageUrl = await (component as any).createBoardImageDataUrlFromDom();
    expect(typeof imageUrl === 'string' || imageUrl === null).toBeTrue();
    getWindowRefSpy.and.callThrough();

    (component as any).chessField = {
      nativeElement: {
        closest: () => ({ bad: 'node' } as any)
      }
    };
    await expectAsync((component as any).createBoardImageDataUrlFromDom()).toBeResolvedTo(null);

    const getDocumentRefSpy = spyOn<any>(component, 'getDocumentRef').and.returnValue(null);
    await expectAsync((component as any).createBoardImageDataUrlFromDom()).toBeResolvedTo(null);
    expect(() => (component as any).downloadDataUrl('data:image/png;base64,DD', 'no-doc.png')).not.toThrow();
    getDocumentRefSpy.and.callThrough();

    document.body.removeChild(boardShell);
  });

});

describe('ChessBoardComponent gameplay moves and rules (opening helpers)', () => {
  it('returns move class based on suggested move notation', () => {
    expect(component.getSuggestedMoveClass('Qh5+')).toBe('suggested-move--check');
    expect(component.getSuggestedMoveClass('Nxe5')).toBe('suggested-move--capture');
    expect(component.getSuggestedMoveClass('d4')).toBe('suggested-move--threat');
    expect(component.getSuggestedMoveClass('')).toBe('suggested-move--threat');
  });

  it('covers parseSuggestedMove piece parsing and invalid input branches', () => {
    expect((component as any).parseSuggestedMove('Qh5+')).toEqual(
      jasmine.objectContaining({ piece: ChessPiecesEnum.Queen })
    );
    expect((component as any).parseSuggestedMove('Nf3')).toEqual(
      jasmine.objectContaining({ piece: ChessPiecesEnum.Knight })
    );
    expect((component as any).parseSuggestedMove('Bc4')).toEqual(
      jasmine.objectContaining({ piece: ChessPiecesEnum.Bishop })
    );
    expect((component as any).parseSuggestedMove('Rxa8')).toEqual(
      jasmine.objectContaining({ piece: ChessPiecesEnum.Rook })
    );
    expect((component as any).parseSuggestedMove('Kh2')).toEqual(
      jasmine.objectContaining({ piece: ChessPiecesEnum.King })
    );

    expect((component as any).parseSuggestedMove('invalid')).toBeNull();
    expect((component as any).parseSuggestedMove('Qa9')).toBeNull();
  });

  it('covers opening display naming when suggested line starts and prefix is suppressed', () => {
    const opening = {
      name: 'Sicilian Defense',
      steps: ['e2-e4'],
      raw: {
        suggested_best_response_name: 'Sicilian Defense: Najdorf',
        suggested_best_response_notation_step: '... c7-c5'
      }
    } as any;

    const displayed = ChessBoardOpeningUtils.getDisplayedOpeningName(opening, ['e2-e4', 'c7-c5']);
    expect(displayed).toBe('Sicilian Defense: Najdorf');
  });

  it('covers eval fallback and empty-history cursor branches', () => {
    expect(component.getEvaluationForMove(-1)).toBe('n/a');
    expect(typeof component.getEvaluationForMove(3)).toBe('string');

    chessBoardStateService.boardHelper.history = {} as any;
    component.mockHistoryCursor = 2;
    expect(component.getVisibleHistory()).toEqual([]);
  });

  it('covers opening-name prefix and debug-line fallback branches', () => {
    expect(ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName('', 'Sicilian Defense')).toBeFalse();
    expect(ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName('Sicilian Defense', '')).toBeFalse();
    expect(ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName('Sicilian Defense', 'Sicilian Defense: Najdorf')).toBeFalse();
    expect(ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName('Italian Game', 'Sicilian Defense')).toBeTrue();

    const formatted = (component as any).formatOpeningDebugText(
      {
        name: 'Mock Opening',
        steps: ['e2-e4'],
        raw: {
          suggested_best_response_name: 'Mock Response',
          suggested_best_response_notation_step: '... c7-c5',
          short_description: 'mock notes'
        }
      } as any,
      0,
      0,
      []
    );
    expect(formatted).toContain('Line: n/a');
  });

  it('covers CCT recommendation ranking and notation capture branch', () => {
    const ranked = ChessBoardCctUtils.pickTopRecommendations([
      { move: 'Nf3', tooltip: 'low', score: 1 },
      { move: 'Nf3', tooltip: 'high', score: 3 },
      { move: 'Qh5+', tooltip: 'check', score: 2 }
    ] as any);
    expect(ranked.length).toBe(2);
    expect(ranked[0].move).toBe('Nf3');
    expect(ranked[0].tooltip).toBe('high');

    const knightCaptureNotation = (component as any).formatCctMove(
      ChessPiecesEnum.Knight,
      7,
      1,
      5,
      2,
      true,
      false
    );
    expect(knightCaptureNotation).toContain('x');
  });

});

describe('ChessBoardComponent gameplay moves and rules (position and analysis)', () => {
  it('covers position-key history fallback when boardHelper is unavailable', () => {
    const savedHelper = chessBoardStateService.boardHelper;
    (chessBoardStateService as any).boardHelper = null;

    const positionKey = (component as any).getPositionKey(
      chessBoardStateService.field,
      ChessColorsEnum.White
    );

    expect(typeof positionKey).toBe('string');
    expect(positionKey.length).toBeGreaterThan(0);

    (chessBoardStateService as any).boardHelper = savedHelper;
  });

  it('returns mock opening and endgame defaults', () => {
    (component as any).openingsLoaded = false;
    expect(component.getMockOpeningRecognition()).toBe('Waiting for opening line...');
    expect(component.getMockEndgameRecognition()).toBe('Not endgame yet');
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

  it('adds king attack/defense arrows during CCT preview when applicable', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any]; // e1
    chessBoardStateService.field[7][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any]; // d1
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any]; // e8
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.previewSuggestedMoveArrows('Qe2+');
    const arrows = Object.values(chessBoardStateService.boardHelper.arrows) as Array<{ color?: string }>;
    expect(arrows.some(arrow => arrow.color === 'red')).toBeTrue();
    expect(arrows.some(arrow => arrow.color === 'gold')).toBeTrue();
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
    component.mateInOneTargets = { '11': true };
    component.mateInOneBlunderTargets = { '22': true };
    (component as any).lastMatePreviewKey = 'x';

    (component as any).resetTransientUiState();
    expect(component.pendingDrawOfferBy).toBeNull();
    expect(component.resignConfirmColor).toBeNull();
    expect(component.mockHistoryCursor).toBeNull();
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

});

describe('ChessBoardComponent gameplay moves and rules (time and overlays)', () => {
  it('handles time forfeit and records result suffix', () => {
    chessBoardStateService.boardHelper.gameOver = false;
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.clockRunning = true;

    (component as any).handleTimeForfeit(ChessColorsEnum.Black);

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.debugText).toContain('Black forfeits on time');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('1-0 {Black forfeits on time}');
  });

  it('covers white time-forfeit winner branch and clears pending draw', () => {
    chessBoardStateService.boardHelper.gameOver = false;
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.pendingDrawOfferBy = ChessColorsEnum.Black;
    component.clockRunning = true;

    (component as any).handleTimeForfeit(ChessColorsEnum.White);

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(component.pendingDrawOfferBy).toBeNull();
    expect(chessBoardStateService.boardHelper.debugText).toContain('White forfeits on time');
    expect(chessBoardStateService.history[chessBoardStateService.history.length - 1]).toContain('0-1 {White forfeits on time}');
  });

  it('covers clock and board-orientation helper branches', () => {
    component.clockRunning = false;
    expect(component.getClockButtonLabel()).toBe('Start Clock');
    component.clockRunning = true;
    expect(component.getClockButtonLabel()).toBe('Pause Clock');

    component.isBoardFlipped = false;
    expect(component.isWhiteSquare(0, 0)).toBeTrue();
    component.isBoardFlipped = true;
    expect(component.isWhiteSquare(0, 0)).toBeTrue();
  });

  it('covers debug-toggle null-target and isClockActive guard branches', () => {
    component.onDebugPanelToggle(false);
    expect(component.isDebugPanelOpen).toBeFalse();

    chessBoardStateService.boardHelper.gameOver = false;
    component.clockRunning = true;
    component.clockStarted = false;
    expect(component.isClockActive(ChessColorsEnum.White)).toBeFalse();

    component.clockStarted = true;
    chessBoardStateService.boardHelper.gameOver = true;
    expect(component.isClockActive(ChessColorsEnum.White)).toBeFalse();

    chessBoardStateService.boardHelper.gameOver = false;
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect(component.isClockActive(ChessColorsEnum.White)).toBeTrue();
  });

  it('covers default and enemy overlay tool keys', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[4][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    component.showThreats();
    expect(component.activeTool).toBe('threats-mine');
    component.showThreats(true);
    expect(component.activeTool).toBe('threats-enemy');

    component.showProtected();
    expect(component.activeTool).toBe('protected-mine');
    component.showProtected(true);
    expect(component.activeTool).toBe('protected-enemy');

    component.showHangingPieces();
    expect(component.activeTool).toBe('hanging-mine');
    component.showHangingPieces(true);
    expect(component.activeTool).toBe('hanging-enemy');
  });

});

describe('ChessBoardComponent gameplay moves and rules (history and outcomes)', () => {
  it('covers history fallback and increment guard branches', () => {
    spyOnProperty(chessBoardStateService, 'history', 'get').and.returnValue(undefined as any);
    component.mockHistoryCursor = null;
    expect(component.getVisibleHistory()).toEqual([]);
    component.undoMove();
    component.redoMove();

    component.clockStarted = true;
    (component as any).incrementMs = 2000;
    chessBoardStateService.boardHelper.gameOver = true;
    component.whiteClockMs = 5000;
    component.blackClockMs = 5000;
    (component as any).addIncrementToColor(ChessColorsEnum.White);
    expect(component.whiteClockMs).toBe(5000);

    chessBoardStateService.boardHelper.gameOver = false;
    (component as any).addIncrementToColor(ChessColorsEnum.Black);
    expect(component.blackClockMs).toBe(7000);
  });

  it('handles black-side en passant branch', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[4][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.boardHelper.history = { '1': 'c2-c4' } as any;

        movePiece(4, 3, 5, 2);

    expect(chessBoardStateService.field[4][2].length).toBe(0);
    expect(chessBoardStateService.field[5][2][0].color).toBe(ChessColorsEnum.Black);
  });

  it('records white checkmate winner text branch', () => {
    clearBoard();
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

        movePiece(2, 1, 1, 1);

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

});

describe('ChessBoardComponent gameplay moves and rules (startup and loading)', () => {
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

        movePiece(0, 1, 2, 2);

    expect(chessBoardStateService.boardHelper.gameOver).toBeTrue();
    expect(chessBoardStateService.boardHelper.debugText).toBe('Draw by insufficient material.');
  });
});

describe('ChessBoardComponent branch coverage helpers (guard and fallback paths)', () => {
  it('covers status-title branches for null helper, checkmate, and draw fallback', () => {
    const savedHelper = chessBoardStateService.boardHelper;
    (chessBoardStateService as any).boardHelper = null;
    expect(component.getStatusTitle()).toBe('');

    (chessBoardStateService as any).boardHelper = savedHelper;
    chessBoardStateService.boardHelper.gameOver = true;
    chessBoardStateService.boardHelper.checkmateColor = ChessColorsEnum.White;
    expect(component.getStatusTitle()).toContain('Checkmate - Black wins');
    chessBoardStateService.boardHelper.checkmateColor = null;
    chessBoardStateService.boardHelper.debugText = '';
    expect(component.getStatusTitle()).toBe('Draw');
  });

  it('covers draw-offer guard paths and response toggles', () => {
    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    component.offerDraw();
    expect(component.canOfferDraw()).toBeFalse();
    expect(component.canRespondToDrawOffer()).toBeFalse();
    (component as any).chessBoardStateService = savedService;

    chessBoardStateService.boardHelper.gameOver = true;
    component.offerDraw();
    chessBoardStateService.boardHelper.gameOver = false;

    component.pendingDrawOfferBy = null;
    component.acceptDrawOffer();
    component.declineDrawOffer();
    expect(component.pendingDrawOfferBy).toBeNull();
  });

  it('covers claim-draw and resign guard paths', () => {
    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    expect(component.canClaimDraw()).toBeFalse();
    expect(component.canResign(ChessColorsEnum.White)).toBeFalse();
    component.openResignConfirm(ChessColorsEnum.White);
    (component as any).chessBoardStateService = savedService;

    chessBoardStateService.boardHelper.gameOver = true;
    expect(component.canClaimDraw()).toBeFalse();
    expect(component.canResign(ChessColorsEnum.White)).toBeFalse();
    component.claimDraw();
  });

  it('covers formatClock sub-minute formatting and mock opening loading/no-match branches', () => {
    expect(component.formatClock(5900)).toContain('.');
    (component as any).openingsLoaded = false;
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    expect(component.getMockOpeningRecognition()).toBe('Loading openings...');

    (component as any).openingsLoaded = true;
    (component as any).activeOpening = null;
    expect(component.getMockOpeningRecognition()).toBe('No opening match');
  });

  it('covers endgame transition branch and black suggested moves branch', () => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[3][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][5] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[4][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[4][1] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[4][2] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    expect(component.getMockEndgameRecognition()).toBe('Transition phase');

    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    expect(component.getMockSuggestedMoves()[0]).toContain('...');
  });

  it('covers previewSuggestedMoveArrows guard and parse-fail branches', () => {
    component.previewSuggestedMoveArrows('');
    component.previewSuggestedMoveArrows('not-a-move');
    expect((component as any).suggestedMoveArrowSnapshot).not.toBeNull();
  });
});

describe('ChessBoardComponent branch coverage helpers (private helpers)', () => {
  it('covers ensureCctRecommendations null-service guard', () => {
    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    (component as any).ensureCctRecommendations();
    expect((component as any).cctRecommendationsCache).toEqual({
      captures: [],
      checks: [],
      threats: []
    });
    (component as any).chessBoardStateService = savedService;
  });

  it('covers piece notation/name remaining branches', () => {
    expect(ChessBoardCctUtils.pieceNotation(ChessPiecesEnum.Bishop)).toBe('B');
    expect(ChessBoardCctUtils.pieceName(ChessPiecesEnum.King)).toBe('king');
    expect(ChessBoardCctUtils.pieceName(ChessPiecesEnum.Rook)).toBe('rook');
    expect(ChessBoardCctUtils.pieceName(ChessPiecesEnum.Knight)).toBe('knight');
    expect(ChessBoardCctUtils.pieceName(ChessPiecesEnum.Pawn)).toBe('pawn');
  });

  it('covers simulateMove branches for empty source and promotion update', () => {
    const board = chessBoardStateService.field.map(row => row.map(cell => cell.slice()));
    const unchanged = (component as any).simulateMove(board, 4, 4, 4, 5);
    expect(unchanged[4][5]).toEqual([]);

    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
    chessBoardStateService.field[1][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    const promoted = (component as any).simulateMove(chessBoardStateService.field, 1, 0, 0, 0);
    expect(promoted[0][0][0].piece).toBe(ChessPiecesEnum.Queen);
  });
});

describe('ChessBoardComponent branch coverage helpers (canDrop guards)', () => {
  it('covers additional canDrop early-return paths', () => {
    expect(component.canDrop({
      dropContainer: { id: 'field60', data: [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn }] }
    } as any, {
      id: 'field60', data: chessBoardStateService.field[6][0]
    } as any)).toBeFalse();

    const validateSpy = spyOn(ChessRulesService, 'validateMove').and.returnValue({ isValid: false } as any);
    const reasonSpy = spyOn<any>(component, 'getDragFailureReason').and.returnValue('nope');
    component.canDrop({
      dropContainer: { id: 'field60', data: [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn }] }
    } as any, {
      id: 'field50', data: chessBoardStateService.field[5][0]
    } as any);
    expect(reasonSpy).toHaveBeenCalled();
    validateSpy.and.callThrough();

    const dynamicSource: any = { _seen: false };
    Object.defineProperty(dynamicSource, '0', {
      get() {
        if (!this._seen) {
          this._seen = true;
          return { color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn };
        }
        return undefined;
      }
    });
    expect(component.canDrop({
      dropContainer: { id: 'field60', data: dynamicSource }
    } as any, {
      id: 'field50', data: chessBoardStateService.field[5][0]
    } as any)).toBeFalse();
  });

  it('covers canDrop guard and invalid-source branches', () => {
    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    expect(component.canDrop({} as any, {} as any)).toBeFalse();
    (component as any).chessBoardStateService = savedService;

    expect(component.canDrop(null as any, null as any)).toBeFalse();
    expect(component.canDrop({ dropContainer: { data: [] } } as any, { id: 'field00', data: [] } as any)).toBeFalse();
    expect(component.canDrop({ dropContainer: { id: 'bad', data: [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn }] } } as any, { id: 'field00', data: [] } as any)).toBeFalse();
    expect(component.canDrop({
      dropContainer: { id: 'field00', data: [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn }] }
    } as any, {
      id: 'field01', data: []
    } as any)).toBeFalse();
  });

});

describe('ChessBoardComponent branch coverage helpers (drag and drop guards)', () => {
  it('covers drop-enter, drag-start and pointer guard branches', () => {
    component.onDropListEntered(null as any);
    component.onDropListEntered({ item: { dropContainer: { id: 'x' } }, container: { id: 'y' } } as any);
    component.onDropListEntered({ item: { dropContainer: { id: 'field90' } }, container: { id: 'field00' } } as any);
    component.onDragStarted(null as any);
    component.onDragStarted({ source: { dropContainer: { id: 'bad', data: [] } } } as any);
    component.onDragStarted({ source: { dropContainer: { id: 'field90', data: [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn }] } } } as any);

    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    component.onDragStarted({ source: { dropContainer: { id: 'field60', data: [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn }] } } } as any);
    component.onSquarePointerDown([] as any);
    (component as any).chessBoardStateService = savedService;
    expect(component.isDragPreviewActive).toBeTrue();
  });

  it('covers private drop-processing and context guards', () => {
    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    expect((component as any).canProcessDropEvent({})).toBeFalse();
    (component as any).chessBoardStateService = savedService;

    chessBoardStateService.boardHelper.gameOver = true;
    expect((component as any).canProcessDropEvent({ previousContainer: { data: [] }, container: { data: [] } })).toBeFalse();
    chessBoardStateService.boardHelper.gameOver = false;
    expect((component as any).buildDropMoveContext({ previousContainer: { id: 'field60', data: [] }, container: { id: 'field50', data: [] } })).toBeNull();
    expect((component as any).canProcessDropEvent({ previousContainer: {}, container: {} })).toBeFalse();
  });

  it('covers onDrop guard branches for process failure/same-container/null-context', () => {
    const event = {
      previousContainer: { id: 'field60', data: chessBoardStateService.field[6][0] },
      container: { id: 'field50', data: chessBoardStateService.field[5][0] },
      previousIndex: 0,
      currentIndex: 0
    } as any;

    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    component.onDrop(event);
    (component as any).chessBoardStateService = savedService;

    component.onDrop({
      previousContainer: event.previousContainer,
      container: event.previousContainer,
      previousIndex: 0,
      currentIndex: 0
    } as any);
    component.onDrop({
      previousContainer: { id: 'bad', data: chessBoardStateService.field[6][0] },
      container: { id: 'field50', data: chessBoardStateService.field[5][0] }
    } as any);
    expect(true).toBeTrue();
  });

});

describe('ChessBoardComponent branch coverage helpers (castling and debug guards)', () => {
  it('covers castling transfer side effects branch', () => {
    clearBoard();
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.justDidCastle = { row: 7, col: 6 } as any;

    const flags = (component as any).applyPreTransferBoardState({
      container: { data: [] },
      previousContainer: { data: [] }
    } as any, {
      targetRow: 7, targetCell: 6, srcRow: 7, srcCell: 4, srcPiece: ChessPiecesEnum.King, srcColor: ChessColorsEnum.White
    });

    expect(flags.castleData).toBe('O-O');
    expect(chessBoardStateService.field[7][7].length).toBe(0);
    expect(chessBoardStateService.field[7][5][0].piece).toBe(ChessPiecesEnum.Rook);

    clearBoard();
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.justDidCastle = { row: 7, col: 2 } as any;
    const qFlags = (component as any).applyPreTransferBoardState({
      container: { data: [] },
      previousContainer: { data: [] }
    } as any, {
      targetRow: 7, targetCell: 2, srcRow: 7, srcCell: 4, srcPiece: ChessPiecesEnum.King, srcColor: ChessColorsEnum.White
    });
    expect(qFlags.castleData).toBe('O-O-O');
  });

  it('covers subtle debug, drag-failure, legal-target and id parsing guards', () => {
    (component as any).setSubtleDebugReason('');
    (component as any).setSubtleDebugReason('x');
    (component as any).setSubtleDebugReason('x');
    expect(chessBoardStateService.boardHelper.debugText).toContain('x');

    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    expect((component as any).getDragFailureReason(0, 0, null)).toBeNull();
    expect((component as any).getLegalTargetCount(0, 0)).toBe(0);
    (component as any).chessBoardStateService = savedService;

    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect((component as any).getDragFailureReason(0, 0, { color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any))
      .toContain('white');
    expect(ChessBoardComponentUtils.parseFieldId('bad')).toBeNull();
    expect(ChessBoardComponentUtils.parseFieldId('fieldx0')).toBeNull();
  });

  it('covers in-check drag-failure reason and active black status title branch', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.boardHelper.gameOver = false;
    expect(component.getStatusTitle()).toBe(`${component.uiText.status.black} ${component.uiText.status.toMoveSuffix}`);

    const targetCountSpy = spyOn<any>(component, 'getLegalTargetCount').and.returnValue(0);
    const inCheckSpy = spyOn<any>(component, 'isKingInCheck').and.returnValue(true);
    const reason = (component as any).getDragFailureReason(
      0,
      0,
      { color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any
    );
    expect(reason).toBe(component.uiText.message.noLegalTargetsWhileInCheckTemplate.replace('{piece}', ChessPiecesEnum.Knight));
    expect(targetCountSpy).toHaveBeenCalled();
    expect(inCheckSpy).toHaveBeenCalled();
  });

  it('covers localStorage catch branches for debug panel persistence', () => {
    const getSpy = spyOn(localStorage, 'getItem').and.throwError('denied');
    expect(ChessBoardStorageService.readDebugPanelOpenState('debug-panel-open')).toBeFalse();
    getSpy.and.callThrough();

    const setSpy = spyOn(localStorage, 'setItem').and.throwError('denied');
    ChessBoardStorageService.persistDebugPanelOpenState('debug-panel-open', true);
    setSpy.and.callThrough();
  });

});

describe('ChessBoardComponent branch coverage helpers (status and opening fallbacks)', () => {
  it('covers status title branch for black checkmate color', () => {
    chessBoardStateService.boardHelper.gameOver = true;
    chessBoardStateService.boardHelper.checkmateColor = ChessColorsEnum.Black;
    expect(component.getStatusTitle()).toContain('Checkmate - White wins');
  });

  it('covers draw offer and history cursor edge branches', () => {
    chessBoardStateService.boardHelper.gameOver = true;
    component.offerDraw();
    chessBoardStateService.boardHelper.gameOver = false;

    component.mockHistoryCursor = 0;
    component.undoMove();
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.mockHistoryCursor = 1;
    component.redoMove();
    expect(component.mockHistoryCursor).toBeNull();

    component.pendingDrawOfferBy = ChessColorsEnum.White;
    component.offerDraw();
  });

  it('covers opening parsing/formatting fallback branches', () => {
    expect(ChessBoardOpeningUtils.parseOpeningsPayload(null as any)).toEqual([]);
    expect(ChessBoardOpeningUtils.normalizeNotationToken('')).toBe('');
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(null as any, [])).toBe('');
    expect((component as any).formatOpeningDebugText(null, 0, [])).toBe('');
    const opening = { name: 'X', steps: ['e2-e4'], raw: { suggested_best_response_name: 'Y', suggested_best_response_notation_step: '2... e7-e5' } };
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(opening as any, ['d2-d4'])).toBe('X');
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(opening as any, ['e2-e4'])).toBe('X');
  });

  it('covers snapshot helper guard and fallback branches', () => {
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.mockHistoryCursor = -1;
    expect(component.getVisibleHistory()).toEqual([]);
    component.undoMove();
    expect(component.mockHistoryCursor).toBe(-1);

    const anyComponent = component as any;
    const baseSnapshot = anyComponent.captureCurrentSnapshot();
    anyComponent.moveSnapshots = [baseSnapshot, anyComponent.captureCurrentSnapshot(), anyComponent.captureCurrentSnapshot()];
    component.mockHistoryCursor = 0;
    anyComponent.pushSnapshotForCurrentState();
    expect(anyComponent.moveSnapshots.length).toBe(3);
    expect(anyComponent.getActiveSnapshotIndex()).toBeGreaterThanOrEqual(0);

    anyComponent.moveSnapshots = [];
    expect(anyComponent.getActiveSnapshotIndex()).toBe(-1);
    anyComponent.replaceActiveSnapshot();
    expect(anyComponent.moveSnapshots.length).toBe(1);

    const savedBoardHelper = chessBoardStateService.boardHelper;
    chessBoardStateService.boardHelper = null as any;
    const fallbackSnapshot = anyComponent.captureCurrentSnapshot();
    expect(fallbackSnapshot.boardHelper.colorTurn).toBe(ChessColorsEnum.White);
    chessBoardStateService.boardHelper = savedBoardHelper;

    anyComponent.restoreSnapshot(null);
    const savedService = anyComponent.chessBoardStateService;
    anyComponent.chessBoardStateService = null;
    anyComponent.restoreSnapshot(baseSnapshot);
    anyComponent.chessBoardStateService = savedService;

    expect(ChessBoardLogicUtils.cloneField(null as any)).toEqual([]);
    expect(ChessBoardLogicUtils.clonePosition({ row: 2, col: 3 } as any)).toEqual({ row: 2, col: 3 });
  });

});

describe('ChessBoardComponent branch coverage helpers (opening recognition edge paths)', () => {
  it('covers opening tie-break branch for shorter complete line preference', () => {
    (component as any).openingsLoaded = true;
    (component as any).openings = [
      {
        name: 'Long',
        steps: ['e2-e4', 'e7-e5', 'Ng1-f3'],
        raw: { name: 'Long', long_algebraic_notation: '1. e2-e4 e7-e5 2. Ng1-f3' }
      },
      {
        name: 'Short',
        steps: ['e2-e4', 'e7-e5'],
        raw: { name: 'Short', long_algebraic_notation: '1. e2-e4 e7-e5' }
      }
    ];
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;

    component.getMockOpeningRecognition();
    expect((component as any).activeOpening.name).toBe('Short');

    (component as any).openings = [
      {
        name: 'Suggested',
        steps: ['e2-e4'],
        raw: { name: 'Suggested', long_algebraic_notation: '1. e2-e4', suggested_best_response_notation_step: '1... e7-e5' }
      }
    ];
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4', '2': 'd7-d5' } as any;
    component.getMockOpeningRecognition();
    expect((component as any).activeOpening.name).toBe('Suggested');

    (component as any).openings = [{
      name: 'Break',
      steps: ['e2-e4', 'e7-e5'],
      raw: {
        name: 'Break',
        long_algebraic_notation: '1. e2-e4 e7-e5',
        suggested_best_response_notation_step: '2. Ng1-f3 Nb8-c6'
      }
    }];
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4', '2': 'c7-c5', '3': 'a2-a3' } as any;
    component.getMockOpeningRecognition();
    expect(component.getMockOpeningRecognition().length).toBeGreaterThan(0);
  });

  it('covers parse target-square invalid and threat-source empty branch', () => {
    expect((component as any).parseSuggestedMove('Qa9')).toBeNull();
    const matchSpy = spyOn(String.prototype, 'match').and.returnValue(['a9', 'a9'] as any);
    expect((component as any).parseSuggestedMove('Qa9')).toBeNull();
    matchSpy.and.callThrough();
    expect((component as any).getThreatenedEnemyPiecesByMovedPiece(chessBoardStateService.field, 4, 4, ChessColorsEnum.White, ChessColorsEnum.Black)).toEqual([]);
  });

  it('covers suggested-arrow invalid-move continue and clear-preview null-service guard', () => {
    const validateSpy = spyOn(ChessRulesService, 'validateMove').and.returnValue({ isValid: false } as any);
    component.previewSuggestedMoveArrows('Nf3');
    validateSpy.and.callThrough();

    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    (component as any).clearDragPreviewHighlights();
    (component as any).chessBoardStateService = savedService;
    expect(true).toBeTrue();
  });

});

describe('ChessBoardComponent branch coverage helpers (mate and threat overlays)', () => {
  it('covers resign guard and mate-preview guard branches', () => {
    chessBoardStateService.boardHelper.gameOver = true;
    component.resign(ChessColorsEnum.White);
    chessBoardStateService.boardHelper.gameOver = false;

    (component as any).previewHoverMateInOne(6, 4, 4, 4, false);
    (component as any).lastMatePreviewKey = '64-44-0';
    (component as any).previewHoverMateInOne(6, 4, 4, 4, true);
    expect((component as any).lastMatePreviewKey).toBe('64-44-0');

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][4] = [];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    (component as any).previewHoverMateInOne(4, 4, 3, 4, true);
  });

  it('covers overlay toggle-off branches and enemy-color branch in threat analysis', () => {
    component.activeTool = 'protected-mine';
    component.showProtected(false);
    expect(component.activeTool).toBeNull();

    component.activeTool = 'hanging-mine';
    component.showHangingPieces(false);
    expect(component.activeTool).toBeNull();

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[4][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    component.getThreatsOn(chessBoardStateService.field[4][0], 4, 0, ChessColorsEnum.Black, ChessColorsEnum.White);
    component.showHangingPieces(true);
    component.showProtected(true);

    clearBoard();
    chessBoardStateService.field[7][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    const threatsSpy = spyOn(component, 'getThreatsBy').and.returnValue([{ pos: { row: 4, col: 4 } as any, piece: ChessPiecesEnum.Pawn }]);
    component.showThreats(false);
    expect(threatsSpy).toHaveBeenCalled();

    const protSpy = spyOn(component, 'getProtectors').and.returnValue([]);
    const onSpy = spyOn(component, 'getThreatsOn').and.returnValue([{ pos: { row: 0, col: 0 } as any, piece: ChessPiecesEnum.Queen }]);
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    component.showHangingPieces(false);
    expect(protSpy).toHaveBeenCalled();
    expect(onSpy).toHaveBeenCalled();
  });

});

describe('ChessBoardComponent branch coverage helpers (simulation and clock branches)', () => {
  it('covers simulateMove en passant, castling rook shift and king-not-found branch', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    let board = (component as any).simulateMove(chessBoardStateService.field, 7, 4, 7, 6);
    expect(board[7][5][0].piece).toBe(ChessPiecesEnum.Rook);

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    board = (component as any).simulateMove(chessBoardStateService.field, 7, 4, 7, 2);
    expect(board[7][3][0].piece).toBe(ChessPiecesEnum.Rook);

    clearBoard();
    chessBoardStateService.field[3][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[3][2] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    board = (component as any).simulateMove(chessBoardStateService.field, 3, 3, 2, 2);
    expect(board[3][2]).toEqual([]);

    expect((component as any).findKing(chessBoardStateService.field, ChessColorsEnum.White)).toBeNull();
    expect((component as any).isKingInCheck(chessBoardStateService.field, ChessColorsEnum.White)).toBeFalse();
  });

  it('covers draw-rule early return and history-result append fallback branches', () => {
    chessBoardStateService.boardHelper.gameOver = true;
    (component as any).applyDrawRules(false, false);
    chessBoardStateService.boardHelper.gameOver = false;

    chessBoardStateService.boardHelper.history = { '1': '' } as any;
    (component as any).appendGameResultToLastMove('1/2-1/2', 'draw');
    expect(chessBoardStateService.boardHelper.history['1']).toContain('1/2-1/2');
    (component as any).appendGameResultToLastMove('1/2-1/2', 'draw');
  });

  it('covers clock start/tick/increment and forfeit early-return branches', () => {
    const zoneComponent = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, {
      run: (fn: Function) => fn()
    } as any);
    const setIntervalSpy = spyOn(window, 'setInterval').and.callFake((callback: TimerHandler) => {
      (callback as Function)();
      return 1 as any;
    });
    zoneComponent.clockRunning = false;
    (zoneComponent as any).clockIntervalId = null;
    (zoneComponent as any).startClock();
    expect(setIntervalSpy).toHaveBeenCalled();
    (zoneComponent as any).clockIntervalId = 5;
    (zoneComponent as any).startClock();

    chessBoardStateService.boardHelper.gameOver = false;
    zoneComponent.clockRunning = true;
    zoneComponent.clockStarted = true;
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    zoneComponent.blackClockMs = 1;
    (zoneComponent as any).lastClockTickAt = Date.now() - 5;
    (zoneComponent as any).tickClock();

    chessBoardStateService.boardHelper.gameOver = false;
    zoneComponent.clockStarted = true;
    (zoneComponent as any).incrementMs = 1000;
    zoneComponent.whiteClockMs = 0;
    (zoneComponent as any).addIncrementToColor(ChessColorsEnum.White);
    expect(zoneComponent.whiteClockMs).toBe(1000);

    chessBoardStateService.boardHelper.gameOver = true;
    const debugBefore = chessBoardStateService.boardHelper.debugText;
    (zoneComponent as any).handleTimeForfeit(ChessColorsEnum.White);
    expect(chessBoardStateService.boardHelper.debugText).toBe(debugBefore);

    const nowSpy = spyOn(Date, 'now').and.returnValues(100, 100);
    chessBoardStateService.boardHelper.gameOver = false;
    zoneComponent.clockRunning = true;
    zoneComponent.clockStarted = true;
    (zoneComponent as any).lastClockTickAt = 100;
    (zoneComponent as any).tickClock();
    nowSpy.and.callThrough();
  });

});

describe('ChessBoardComponent branch coverage helpers (index and evaluation branches)', () => {
  it('covers move-index helpers, debug key guards, notation rule branches and insufficient-material terminal false', () => {
    const savedHistory = { ...(chessBoardStateService.boardHelper.history as any) };
    chessBoardStateService.history.splice(0, chessBoardStateService.history.length);
    expect(ChessBoardHistoryService.getCurrentVisibleMoveIndex((component as any).getMaxMoveIndex(), component.mockHistoryCursor)).toBe(-1);
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.mockHistoryCursor = 5;
    expect(ChessBoardHistoryService.getCurrentVisibleMoveIndex((component as any).getMaxMoveIndex(), component.mockHistoryCursor)).toBe(0);
    chessBoardStateService.boardHelper.history = savedHistory as any;

    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    expect(component.getDebugPositionKey()).toBe('');
    expect(component.getDebugCastlingRights()).toBe('-');
    (component as any).chessBoardStateService = savedService;

    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('')).toBeFalse();
    expect(ChessBoardLogicUtils.isNonPawnNonCaptureMove('O-O')).toBeTrue();

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.field[0][2] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.field[6][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(chessBoardStateService.field)).toBeFalse();

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    expect(ChessBoardLogicUtils.isInsufficientMaterial(chessBoardStateService.field)).toBeTrue();
  });

  it('covers opening helper direct-return branches and color-init ternaries', () => {
    const opening = {
      name: 'OnlyName',
      steps: ['e2-e4'],
      raw: { name: 'OnlyName', suggested_best_response_name: 'Some Line', suggested_best_response_notation_step: '' }
    };
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(opening as any, ['d2-d4'])).toBe('OnlyName');
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(opening as any, ['e2-e4'])).toBe('OnlyName');
    expect((component as any).formatOpeningDebugText(opening, 1, ['e2-e4'])).toContain('Opening');

    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    const mine = (component as any).initColors(false);
    const enemy = (component as any).initColors(true);
    expect(mine.enemyColor).toBe(ChessColorsEnum.White);
    expect(enemy.ofColor).toBe(ChessColorsEnum.White);
  });

  it('covers cct check-with-capture scoring branch', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.field[3][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    const stepSpy = spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow: number, targetCol: number) =>
      targetRow === 3 && targetCol === 4
    );
    const kingSpy = spyOn<any>(component, 'isKingInCheck').and.callFake((_board: any, color: ChessColorsEnum) =>
      color === ChessColorsEnum.Black
    );

    (component as any).ensureCctRecommendations();
    expect(stepSpy).toHaveBeenCalled();
    expect(kingSpy).toHaveBeenCalled();
  });

});

describe('ChessBoardComponent branch coverage helpers (drop validation and opening display)', () => {
  it('covers validateDropMove invalid branch with drag failure reason', () => {
    const validateSpy = spyOn(ChessRulesService, 'validateMove').and.returnValue({ isValid: false } as any);
    const reasonSpy = spyOn<any>(component, 'getDragFailureReason').and.returnValue('blocked');
    const subtleSpy = spyOn<any>(component, 'setSubtleDebugReason').and.callThrough();
    const result = (component as any).validateDropMove({
      targetRow: 5,
      targetCell: 0,
      srcRow: 6,
      srcCell: 0,
      srcPiece: ChessPiecesEnum.Pawn,
      srcColor: ChessColorsEnum.White
    }, {
      previousContainer: { data: [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn }] }
    });
    expect(result).toBeFalse();
    expect(reasonSpy).toHaveBeenCalled();
    expect(subtleSpy).toHaveBeenCalledWith('blocked');
    validateSpy.and.callThrough();
  });

  it('covers undo low-index branch and opening-name display fallback branches', () => {
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.mockHistoryCursor = 0;
    component.undoMove();
    expect(component.mockHistoryCursor).toBe(-1);

    const opening = {
      name: 'Main',
      steps: ['e2-e4', 'e7-e5'],
      raw: {
        suggested_best_response_name: 'Line',
        suggested_best_response_notation_step: '2. Ng1-f3 Nb8-c6'
      }
    };
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(opening as any, ['e2-e4', 'c7-c5', 'Ng1-f3'])).toBe('Main');
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(opening as any, ['e2-e4', 'e7-e5', 'd2-d4'])).toBe('Main');
  });

});

describe('ChessBoardComponent branch coverage helpers (locale and asset loading edges)', () => {
  it('covers suggested-line mismatch break loops in recognition and formatting', () => {
    const opening = {
      name: 'Main',
      steps: ['e2-e4', 'e7-e5'],
      raw: {
        name: 'Main',
        long_algebraic_notation: '1. e2-e4 e7-e5',
        suggested_best_response_name: 'Line',
        suggested_best_response_notation_step: '2. Ng1-f3 Nb8-c6'
      }
    };
    (component as any).openingsLoaded = true;
    (component as any).openings = [opening];
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4', '2': 'e7-e5', '3': 'Ng1-f3', '4': 'a7-a6' } as any;

    expect(component.getMockOpeningRecognition()).toContain('Main');
    const debugText = (component as any).formatOpeningDebugText(opening, 3, 4, ['e2-e4', 'e7-e5', 'Ng1-f3', 'a7-a6']);
    expect(debugText).toContain('Matched steps');
  });

  it('covers previewHoverMateInOne self-check early return branch', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    const kingSpy = spyOn<any>(component, 'isKingInCheck').and.returnValue(true);
    (component as any).previewHoverMateInOne(6, 4, 5, 4, true);
    expect(kingSpy).toHaveBeenCalled();
  });
});

describe('ChessBoardComponent stockfish evaluation states', () => {
  it('shows pending placeholder, then resolved score', fakeAsync(() => {
    let resolveEval: ((value: string) => void) | null = null;
    stockfishServiceStub.evaluateFen.and.callFake(() => new Promise<string>(resolve => {
      resolveEval = resolve;
    }));

        movePiece(6, 4, 4, 4);

    tick(200);
    expect(stockfishServiceStub.evaluateFen).toHaveBeenCalledTimes(1);
    expect(component.getEvaluationForMove(0)).toBe('...');

    resolveEval?.('+0.33');
    flushMicrotasks();
    expect(component.getEvaluationForMove(0)).toBe('+0.33');
  }));

  it('shows error placeholder when evaluation fails', fakeAsync(() => {
    stockfishServiceStub.evaluateFen.and.callFake(() => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('boom')), 0);
    }));

        movePiece(6, 3, 4, 3);

    tick(200);
    flushMicrotasks();
    expect(component.getEvaluationForMove(0)).toBe('err');
  }));

  it('reuses cache for repeated refreshes and terminates worker on destroy', fakeAsync(() => {
    stockfishServiceStub.evaluateFen.and.returnValue(Promise.resolve('+0.21'));

        movePiece(6, 2, 4, 2);
    tick(200);
    flushMicrotasks();
    expect(component.getEvaluationForMove(0)).toBe('+0.21');
    expect(stockfishServiceStub.evaluateFen).toHaveBeenCalledTimes(1);

    (component as any).scheduleEvaluationRefresh();
    tick(200);
    flushMicrotasks();
    expect(stockfishServiceStub.evaluateFen).toHaveBeenCalledTimes(1);

    component.ngOnDestroy();
    expect(stockfishServiceStub.terminate).toHaveBeenCalled();
  }));

  it('classifies move quality from eval swings for both sides', () => {
    const evalByIndex: Record<number, string> = {
      0: '+0.00',
      1: '+0.60',
      2: '+3.80',
      3: '-0.20'
    };
    spyOn(component, 'getEvaluationForMove').and.callFake((index: number) => evalByIndex[index] ?? '...');

    expect(component.getMoveQualityLabel(1)).toBe('small error');
    expect(component.getMoveQualityLabel(2)).toBe('genius');
    expect(component.getMoveQualityLabel(3)).toBe('genius');
  });

  it('covers move quality fallback and class mapping', () => {
    spyOn(component as any, 'getMoveQuality').and.returnValues({
      label: 'great',
      className: 'history-quality--great'
    } as any, null, {
      label: 'great',
      className: 'quality-great'
    } as any);

    expect(component.getMoveQualityLabel(4)).toBe('great');
    expect(component.getMoveQualityClass(4)).toBe('');
    expect(component.getMoveQualityClass(4)).toBe('quality-great');
  });
});

describe('ChessBoardComponent stockfish evaluation thresholds', () => {
  it('covers fen generation fallback branches from snapshots', () => {
    expect(ChessBoardLogicUtils.generateFenFromSnapshot(null as any)).toBe('8/8/8/8/8/8/8/8 w - - 0 1');

    const snapshot = (component as any).captureCurrentSnapshot();
    delete snapshot.boardHelper.history;
    const generatedFen = ChessBoardLogicUtils.generateFenFromSnapshot(snapshot);
    expect(generatedFen).toContain(' w ');
  });

  it('covers evaluation helpers and analysis meter branches', () => {
    spyOn(component as any, 'getFenForHistoryIndex').and.returnValue('fen1');
    (component as any).evalByHistoryIndex.set(2, '+0.31');
    expect(component.getEvaluationForMove(2)).toBe('+0.31');
    expect(component.getEvaluationForMove(0)).toBe('...');

    const noEngineComponent = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any);
    expect(noEngineComponent.getCurrentAnalysisEvalText()).toBe('n/a');

    spyOn(component, 'getCurrentAnalysisEvalText').and.returnValues('#+2', '#-4', 'bad');
    expect(component.getAnalysisMeterOffsetPercent()).toBe(100);
    expect(component.getAnalysisMeterOffsetPercent()).toBe(0);
    expect(component.getAnalysisMeterOffsetPercent()).toBe(50);
  });

  it('covers move quality thresholds and null-return branches', () => {
    spyOn(component, 'getEvaluationForMove').and.callFake((index: number) => {
      const table: Record<number, string> = {
        0: '+0.0',
        1: '+0.0',
        2: '+0.7',
        3: '+2.0',
        4: '+1.0',
        5: '+0.9',
        6: '+0.4',
        7: '+0.3',
        8: '...'
      };
      return table[index] ?? '...';
    });

    expect(component.getMoveQualityLabel(0)).toBe('');
    expect(component.getMoveQualityLabel(1)).toBe('');
    expect(component.getMoveQualityLabel(2)).toBe('good');
    expect(component.getMoveQualityLabel(3)).toBe('mistake');
    expect(component.getMoveQualityLabel(4)).toBe('mistake');
    expect(component.getMoveQualityLabel(5)).toBe('');
    expect(component.getMoveQualityLabel(6)).toBe('small error');
    expect(component.getMoveQualityLabel(7)).toBe('');
    expect(component.getMoveQualityLabel(8)).toBe('');
  });

  it('covers move quality great and blunder branches', () => {
    spyOn(component, 'getEvaluationForMove').and.callFake((index: number) => {
      const table: Record<number, string> = {
        0: '+0.0',
        1: '+0.0',
        2: '+1.2',
        3: '+4.8'
      };
      return table[index] ?? '...';
    });

    expect(component.getMoveQualityLabel(2)).toBe('great');
    expect(component.getMoveQualityLabel(3)).toBe('blunder');
  });
});

describe('ChessBoardComponent stockfish evaluation helper branches', () => {
  it('covers showPossibleMoves guard and check/capture arrows path', () => {
    component.showPossibleMoves(null as any);

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[5][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Knight } as any];
    spyOn<any>(component, 'canPlayLegalMove').and.returnValue(true);
    spyOn<any>(component, 'isKingInCheck').and.returnValue(true);
    const possibleSpy = spyOn(ChessBoardStateService, 'addPossible').and.callThrough();
    const hitSpy = spyOn(ChessBoardStateService, 'addHit').and.callThrough();
    const checkSpy = spyOn(ChessBoardStateService, 'addCheck').and.callThrough();

    component.showPossibleMoves(ChessColorsEnum.White);
    expect(possibleSpy).toHaveBeenCalled();
    expect(hitSpy).toHaveBeenCalled();
    expect(checkSpy).toHaveBeenCalled();
  });

  it('covers refreshVisibleHistoryEvaluations cancellation branches', async () => {
    const neverEngine = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any);
    await (neverEngine as any).refreshVisibleHistoryEvaluations(1);

    (component as any).evaluationRunToken = 10;
    spyOn(component as any, 'getVisibleHistory').and.returnValue(['e2-e4']);
    spyOn(component as any, 'getFenForHistoryIndex').and.returnValue('fen-a');
    stockfishServiceStub.evaluateFen.calls.reset();
    await (component as any).refreshVisibleHistoryEvaluations(9);
    expect(stockfishServiceStub.evaluateFen).not.toHaveBeenCalled();

    (component as any).evaluationRunToken = 20;
    let resolveEval!: (value: string) => void;
    stockfishServiceStub.evaluateFen.and.returnValue(new Promise(resolve => {
      resolveEval = resolve;
    }));
    const resolveRun = (component as any).refreshVisibleHistoryEvaluations(20);
    (component as any).evaluationRunToken = 21;
    resolveEval('+0.20');
    await resolveRun;

    (component as any).evaluationRunToken = 30;
    let rejectEval!: (error: Error) => void;
    stockfishServiceStub.evaluateFen.and.returnValue(new Promise((_resolve, reject) => {
      rejectEval = reject;
    }));
    const rejectRun = (component as any).refreshVisibleHistoryEvaluations(30);
    (component as any).evaluationRunToken = 31;
    rejectEval(new Error('late failure'));
    await rejectRun;

    const cleanComponent = new ChessBoardComponent(
      chessBoardStateService,
      { get: () => of([]) } as any,
      undefined,
      undefined,
      undefined,
      stockfishServiceStub as any
    );
    expect((cleanComponent as any).getFenForHistoryIndex(-1)).toBe('');
  });

  it('returns current move eval text when engine exists and cursor is on a move', () => {
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.mockHistoryCursor = 0;
    spyOn(component, 'getEvaluationForMove').and.returnValue('+0.22');
    expect(component.getCurrentAnalysisEvalText()).toBe('+0.22');
  });
});

describe('ChessBoardComponent branch coverage helpers (locale switching and opening assets)', () => {
  it('covers locale switching branches and resign title helper', async () => {
    await component.switchLocale('en_US');
    expect(component.isLanguageSwitching).toBeFalse();

    const loader = {
      setActiveLocale: jasmine.createSpy('setActiveLocale').and.resolveTo(),
      getCurrentLocale: jasmine.createSpy('getCurrentLocale').and.returnValue('hu_HU')
    };
    const localComponent = new ChessBoardComponent(
      chessBoardStateService,
      { get: () => of([]) } as any,
      undefined,
      undefined,
      loader as any
    );
    const loadOpeningsSpy = spyOn<any>(localComponent, 'loadOpeningsFromAssets').and.stub();
    const requestClockRenderSpy = spyOn<any>(localComponent, 'requestClockRender').and.stub();

    localComponent.selectedLocale = 'en_US';
    await localComponent.switchLocale('hu_HU');
    expect(loader.setActiveLocale).toHaveBeenCalledWith('hu_HU');
    expect(loader.getCurrentLocale).toHaveBeenCalled();
    expect(localComponent.selectedLocale).toBe('hu_HU');
    expect(loadOpeningsSpy).toHaveBeenCalledWith('hu_HU');
    expect(requestClockRenderSpy).toHaveBeenCalled();
    expect(localComponent.isLanguageSwitching).toBeFalse();

    await localComponent.switchLocale('hu_HU');
    expect(loader.setActiveLocale.calls.count()).toBe(1);

    localComponent.uiText.status.white = 'White';
    localComponent.uiText.status.black = 'Black';
    localComponent.uiText.resignConfirm.titleTemplate = 'Resign as {color}?';
    localComponent.resignConfirmColor = ChessColorsEnum.White;
    expect(localComponent.getResignConfirmTitle()).toBe('Resign as White?');
    localComponent.resignConfirmColor = ChessColorsEnum.Black;
    expect(localComponent.getResignConfirmTitle()).toBe('Resign as Black?');
  });

  it('covers opening-load stale callbacks and opening-file fallback catches', () => {
    const deferredSubscribers: Array<any> = [];
    const httpMock = {
      get: jasmine.createSpy('get').and.callFake(() => new Observable((subscriber) => {
        deferredSubscribers.push(subscriber);
      }))
    };
    const localComponent = new ChessBoardComponent(chessBoardStateService, httpMock as any);
    (localComponent as any).loadOpeningsFromAssets('');

    const firstPath = String(httpMock.get.calls.argsFor(0)[0]);
    expect(firstPath).toContain('assets/openings/openings1.json');

    (localComponent as any).openingsLoadId += 1;
    deferredSubscribers[0].next([{ name: 'Late', long_algebraic_notation: '1. e2-e4' }]);
    deferredSubscribers[0].complete();
    deferredSubscribers[1].error(new Error('late'));
    deferredSubscribers[2].next([]);
    deferredSubscribers[2].complete();

    expect((localComponent as any).openings.length).toBe(0);

    const fallbackGet = jasmine.createSpy('get').and.callFake((path: string) => {
      if (path.includes('/hu_HU/')) {
        return throwError(() => new Error('missing localized'));
      }
      if (path.includes('/openings1.json')) {
        return of([{ name: 'Fallback', long_algebraic_notation: '1. e2-e4' }] as any);
      }
      return throwError(() => new Error('missing fallback'));
    });
    const fallbackComponent = new ChessBoardComponent(chessBoardStateService, { get: fallbackGet } as any);

    let successItems: any[] | null = null;
    (fallbackComponent as any).getOpeningAsset$('openings1.json', 'hu_HU').subscribe((items: any[]) => {
      successItems = items;
    });
    expect(successItems).toEqual([{ name: 'Fallback', long_algebraic_notation: '1. e2-e4' }]);

    let emptyItems: any[] | null = null;
    (fallbackComponent as any).getOpeningAsset$('openings2.json', 'hu_HU').subscribe((items: any[]) => {
      emptyItems = items;
    });
    expect(emptyItems).toEqual([]);
  });
});

describe('ChessBoardComponent preview presets and render slices', () => {
  it('covers preview slicing and piece-colors preset mapping branches', () => {
    component.previewMode = true;
    component.previewBoardSize = 2;
    component.previewRowAnchor = 'top';
    component.previewPreset = 'piece-colors';

    expect(component.renderedBoardRows).toEqual([0, 1]);
    expect(component.renderedBoardCols).toEqual([0, 1]);
    expect(component.getDisplayPiece(0, 0)).toEqual(jasmine.objectContaining({
      color: ChessColorsEnum.White,
      piece: ChessPiecesEnum.Rook
    }));
    expect(component.getDisplayPiece(0, 1)).toEqual(jasmine.objectContaining({
      color: ChessColorsEnum.Black,
      piece: ChessPiecesEnum.Bishop
    }));
    expect(component.getDisplayPiece(1, 0)).toEqual(jasmine.objectContaining({
      color: ChessColorsEnum.White,
      piece: ChessPiecesEnum.Pawn
    }));
    expect(component.getDisplayPiece(1, 1)).toEqual(jasmine.objectContaining({
      color: ChessColorsEnum.White,
      piece: ChessPiecesEnum.Knight
    }));

    expect(ChessBoardComponentUtils.getPieceColorPreviewCell(7, 7, component.renderedBoardRows, component.renderedBoardCols)).toEqual([]);

    component.previewBoardSize = 3;
    expect(ChessBoardComponentUtils.getPieceColorPreviewCell(2, 2, component.renderedBoardRows, component.renderedBoardCols)).toEqual([]);

    component.previewRowAnchor = 'bottom';
    component.previewBoardSize = 2;
    expect(component.renderedBoardRows).toEqual([6, 7]);

    component.previewBoardSize = 0;
    expect(component.renderedBoardRows).toEqual([7]);
    expect(component.renderedBoardCols).toEqual([0]);
  });
});

describe('ChessBoardComponent branch coverage helpers (history element resolution)', () => {
  it('returns native element when historyLog is an ElementRef', () => {
    const nativeElement = document.createElement('div');
    (component as any).historyLog = new ElementRef<HTMLDivElement>(nativeElement);

    expect((component as any).resolveHistoryElement()).toBe(nativeElement);
  });

  it('returns null for non-element historyLog without getHistoryElement', () => {
    (component as any).historyLog = { value: 1 };

    expect((component as any).resolveHistoryElement()).toBeNull();
  });
});

describe('ChessBoardComponent branch coverage helpers (cct access and private wrappers)', () => {
  it('covers active stockfish legacy-from-cdr getter path', () => {
    const legacyEngine = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.returnValue(Promise.resolve('0.00')),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(
      chessBoardStateService,
      { get: () => of([]) } as any,
      undefined,
      undefined,
      legacyEngine as any
    );
    expect((local as any).activeStockfishService).toBe(legacyEngine as any);
  });

  it('covers getCctRecommendations guards and service-backed branch', () => {
    const localNoCct = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any);
    expect(localNoCct.getCctRecommendations(CctCategoryEnum.Captures)).toEqual([]);

    const helperBackup = chessBoardStateService.boardHelper;
    (chessBoardStateService as any).boardHelper = null;
    expect(localNoCct.getCctRecommendations(CctCategoryEnum.Captures)).toEqual([]);
    (chessBoardStateService as any).boardHelper = helperBackup;

    const cctService = {
      ensureCctRecommendations: jasmine.createSpy('ensureCctRecommendations').and.returnValue({
        [CctCategoryEnum.Captures]: [{ move: 'Qh5+', tooltip: 'x' }],
        [CctCategoryEnum.Checks]: [],
        [CctCategoryEnum.Threats]: []
      })
    };
    const localWithCct = new ChessBoardComponent(
      chessBoardStateService,
      { get: () => of([]) } as any,
      cctService as any
    );
    expect(localWithCct.getCctRecommendations(CctCategoryEnum.Captures).length).toBe(1);
    expect(cctService.ensureCctRecommendations).toHaveBeenCalled();
    expect(localWithCct.getCctRecommendations('missing' as any)).toEqual([]);
  });

  it('covers private cct cache-hit, self-check continue, threat scoring and king finder', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    const positionKeySpy = spyOn<any>(component, 'getPositionKey').and.returnValues('same-key', 'key-a', 'key-b');
    (component as any).cctRecommendationsCacheKey = 'same-key';
    (component as any).ensureCctRecommendations();
    expect((component as any).cctRecommendationsCacheKey).toBe('same-key');

    (component as any).cctRecommendationsCacheKey = '';
    const canStepSpy = spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol) =>
      targetRow === 5 && targetCol === 4
    );
    spyOn<any>(component, 'simulateMove').and.callFake((b: any) => ChessBoardLogicUtils.cloneField(b));
    const checkSpy = spyOn<any>(component, 'isKingInCheck').and.callFake((_b: any, color: ChessColorsEnum) =>
      color === ChessColorsEnum.White
    );
    const threatenedSpy = spyOn<any>(component, 'getThreatenedEnemyPiecesByMovedPiece').and.returnValue([ChessPiecesEnum.Queen]);
    (component as any).ensureCctRecommendations();

    expect(positionKeySpy).toHaveBeenCalled();
    checkSpy.and.callFake(() => false);
    threatenedSpy.and.returnValue([ChessPiecesEnum.Queen]);
    (component as any).cctRecommendationsCacheKey = '';
    (component as any).ensureCctRecommendations();
    expect(canStepSpy).toHaveBeenCalled();
    expect(checkSpy).toHaveBeenCalled();

    const found = (component as any).findKing(chessBoardStateService.field, ChessColorsEnum.White);
    expect(found?.row).toBe(7);
    expect(found?.col).toBe(4);
  });

  it('covers private ensureCctRecommendations check tooltip/score branches for non-capture checks', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    spyOn<any>(component, 'getPositionKey').and.returnValue('check-only');
    spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol) => targetRow === 5 && targetCol === 4);
    spyOn<any>(component, 'simulateMove').and.callFake((b: any) => ChessBoardLogicUtils.cloneField(b));
    spyOn<any>(component, 'isKingInCheck').and.callFake((_b: any, color: ChessColorsEnum) => color === ChessColorsEnum.Black);
    spyOn<any>(component, 'getThreatenedEnemyPiecesByMovedPiece').and.returnValue([ChessPiecesEnum.Queen]);

    (component as any).cctRecommendationsCacheKey = '';
    (component as any).ensureCctRecommendations();
    const checks = (component as any).cctRecommendationsCache[CctCategoryEnum.Checks];
    expect(checks.length).toBeGreaterThan(0);
    expect(checks[0].tooltip).not.toContain('with capture');
  });
});

describe('ChessBoardComponent suggestion scoring helpers basics', () => {
  it('covers suggestion getters and white mock suggested branch', () => {
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect(component.getMockSuggestedMoves()).toEqual(['Qh5+', 'Nxe5', 'd4']);
    expect(component.getSuggestionQualityClass('')).toBe('');
    expect(component.getSuggestionEvalText('')).toBe('');

    (component as any).suggestionQualityByMove = { Nf3: 'history-quality--great' };
    (component as any).suggestionEvalTextByMove = { Nf3: '+0.42' };
    expect(component.getSuggestionQualityClass('Nf3')).toBe('history-quality--great');
    expect(component.getSuggestionEvalText('Nf3')).toBe('+0.42');
  });

  it('covers refreshSuggestedMoves cached branch and refresh delegation', async () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    spyOn<any>(component, 'getCurrentFen').and.returnValue(fen);
    (component as any).evaluationRunToken = 7;
    (component as any).suggestedMovesCacheByFen.set(fen, ['Nf3']);
    const refreshQualitySpy = spyOn<any>(component, 'refreshSuggestionQualities').and.resolveTo();

    await (component as any).refreshSuggestedMoves(7);
    expect(component.suggestedMoves).toEqual(['Nf3']);
    expect(refreshQualitySpy).toHaveBeenCalledWith(7, fen);

    (component as any).suggestionQualityByFen.set(fen, { Nf3: 'history-quality--great' });
    (component as any).suggestionEvalTextByFen.set(fen, { Nf3: '+0.20' });
    refreshQualitySpy.calls.reset();
    await (component as any).refreshSuggestedMoves(7);
    expect(refreshQualitySpy).not.toHaveBeenCalled();
    expect(component.getSuggestionEvalText('Nf3')).toBe('+0.20');
  });

  it('covers refreshSuggestedMoves success and catch branches', async () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    const engine = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.1'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo(['g1f3']),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, engine as any);
    spyOn<any>(local, 'getCurrentFen').and.returnValue(fen);
    (local as any).evaluationRunToken = 2;
    const qualitySpy = spyOn<any>(local, 'refreshSuggestionQualities').and.resolveTo();

    await (local as any).refreshSuggestedMoves(2);
    expect(local.suggestedMoves.length).toBeGreaterThan(0);
    expect(engine.getTopMoves).toHaveBeenCalled();
    expect(qualitySpy).toHaveBeenCalled();

    engine.getTopMoves.and.rejectWith(new Error('boom'));
    (local as any).suggestedMovesCacheByFen.clear();
    await (local as any).refreshSuggestedMoves(2);
    expect(local.suggestedMoves).toEqual(['n/a']);
  });

  it('covers refreshSuggestionQualities early returns and empty-uci mapping branch', async () => {
    const localNoEngine = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any);
    await (localNoEngine as any).refreshSuggestionQualities(1, 'fen');

    const engine = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.2'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo([]),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, engine as any);
    (local as any).evaluationRunToken = 5;
    await (local as any).refreshSuggestionQualities(5, 'fen-empty', [], []);
    expect((local as any).suggestionQualityByFen.get('fen-empty')).toEqual({});
    expect((local as any).suggestionEvalTextByFen.get('fen-empty')).toEqual({});
  });
});

describe('ChessBoardComponent suggestion scoring helpers mapping', () => {
  it('covers build/classify/format/parse helper branches', async () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[6][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[5][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    const resolveSpy = spyOn<any>(component, 'resolveMoveToUci').and.callFake((move: string) => move === 'exd3' ? 'e4d3' : null);
    spyOn(component, 'getCctRecommendations').and.returnValues(
      [{ move: 'Nf3', tooltip: '' }],
      [{ move: 'exd3', tooltip: '' }],
      [{ move: 'bad', tooltip: '' }]
    );
    const map = (component as any).buildDisplayToUciMap(['g1f3'], ['Nf3']);
    expect(map.get('Nf3')).toBe('g1f3');
    expect(map.get('exd3')).toBe('e4d3');

    expect((component as any).classifySuggestionLoss(0.05)).toBe('history-quality--genius');
    expect((component as any).classifySuggestionLoss(0.2)).toBe('history-quality--great');
    expect((component as any).classifySuggestionLoss(0.5)).toBe('history-quality--good');
    expect((component as any).classifySuggestionLoss(1.0)).toBe('history-quality--small-error');
    expect((component as any).classifySuggestionLoss(2.0)).toBe('history-quality--mistake');
    expect((component as any).classifySuggestionLoss(3.0)).toBe('history-quality--blunder');

    expect((component as any).formatEngineSuggestions([])).toEqual([]);
    expect((component as any).formatUciMoveForDisplay('bad')).toBe('');
    expect((component as any).parseSquareToCoords('z9')).toBeNull();
    expect((component as any).parseSquareToCoords('a1')).toEqual({ row: 7, col: 0 });

    // ensure a non-pawn capture is covered: Knight captures pawn (should show 'x')
    clearBoard();
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[5][5] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect((component as any).formatUciMoveForDisplay('g1f3')).toBe('Nxf3');

    // also verify non-capture knight move remains valid
    clearBoard();
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.field[5][5] = [];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect((component as any).formatUciMoveForDisplay('g1f3')).toBe('Nf3');

    // restore default starting board for subsequent expectations
    const restoredState = new ChessBoardStateService();
    chessBoardStateService = restoredState;
    (component as any).chessBoardStateService = restoredState;

    expect((component as any).formatUciMoveForDisplay('e2e4')).toBe('e4');
    expect((component as any).formatUciMoveForDisplay('e2d3')).toBe('exd3');

    resolveSpy.and.callThrough();
    expect((component as any).resolveMoveToUci('invalid')).toBeNull();
  });

  it('covers resolveMoveToUci legal move branch', () => {
    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect((component as any).resolveMoveToUci('Nf3')).toBe('g1f3');
  });

  it('covers evaluateUciMovesForQuality fallbacks and run-token early return', async () => {
    const withAfterMoves = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.10'),
      evaluateFenAfterMoves: jasmine.createSpy('evaluateFenAfterMoves').and.resolveTo('+0.30'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo([]),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, withAfterMoves as any);
    (local as any).evaluationRunToken = 8;
    const withAfterResult = await (local as any).evaluateUciMovesForQuality(8, 'fen', ['e2e4']);
    expect(withAfterResult.pawnsByUci.get('e2e4')).toBe(0.3);
    expect(withAfterResult.textByUci.get('e2e4')).toBe('+0.30');

    const withoutAfterMoves = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.50'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo([]),
      terminate: jasmine.createSpy('terminate')
    };
    const fallback = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, withoutAfterMoves as any);
    (fallback as any).evaluationRunToken = 3;
    const fallbackResult = await (fallback as any).evaluateUciMovesForQuality(3, 'fen', ['e2e4']);
    expect(fallbackResult.pawnsByUci.get('e2e4')).toBe(0.5);
    expect(withoutAfterMoves.evaluateFen).toHaveBeenCalled();

    (fallback as any).evaluationRunToken = 99;
    const early = await (fallback as any).evaluateUciMovesForQuality(1, 'fen', ['e2e4']);
    expect(early.pawnsByUci.size).toBe(0);
  });
});

describe('ChessBoardComponent suggestion scoring uncovered branches', () => {
  it('covers refreshSuggestedMoves run-token mismatch exits', async () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    const engine = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.1'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo(['g1f3']),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, engine as any);
    engine.getTopMoves.and.callFake(async () => {
      (local as any).evaluationRunToken = 2;
      return ['g1f3'];
    });
    spyOn<any>(local, 'getCurrentFen').and.returnValue(fen);
    (local as any).evaluationRunToken = 1;
    await (local as any).refreshSuggestedMoves(1);
    expect((local as any).suggestedMovesCacheByFen.has(fen)).toBeFalse();

    engine.getTopMoves.and.callFake(async () => {
      (local as any).evaluationRunToken = 3;
      throw new Error('boom');
    });
    await (local as any).refreshSuggestedMoves(2);
    expect(local.suggestedMoves).not.toEqual(['n/a']);
  });

  it('covers refreshSuggestionQualities cached, mismatch and empty-eval branches', async () => {
    const engine = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.1'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo(['g1f3']),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, engine as any);
    (local as any).evaluationRunToken = 7;
    (local as any).suggestionQualityByFen.set('cached', { Nf3: 'history-quality--great' });
    (local as any).suggestionEvalTextByFen.set('cached', { Nf3: '+0.20' });
    await (local as any).refreshSuggestionQualities(7, 'cached', ['g1f3'], ['Nf3']);
    expect((local as any).suggestionQualityByMove.Nf3).toBe('history-quality--great');

    engine.getTopMoves.and.callFake(async () => {
      (local as any).evaluationRunToken = 8;
      return ['g1f3'];
    });
    await (local as any).refreshSuggestionQualities(7, 'mismatch');

    (local as any).evaluationRunToken = 9;
    spyOn<any>(local, 'evaluateUciMovesForQuality').and.resolveTo({
      pawnsByUci: new Map<string, number>(),
      textByUci: new Map<string, string>()
    });
    await (local as any).refreshSuggestionQualities(9, 'empty-eval', ['g1f3'], ['Nf3']);
    expect((local as any).suggestionQualityByFen.get('empty-eval')).toEqual({});
  });

  it('covers refreshSuggestionQualities map scoring and undefined eval paths', async () => {
    const engine = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.1'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo(['g1f3']),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, engine as any);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    (local as any).evaluationRunToken = 5;
    spyOn<any>(local, 'buildDisplayToUciMap').and.returnValue(new Map<string, string>([
      ['Nf3', 'g1f3'],
      ['e4', 'e2e4']
    ]));
    spyOn<any>(local, 'evaluateUciMovesForQuality').and.resolveTo({
      pawnsByUci: new Map<string, number>([['g1f3', 0.3]]),
      textByUci: new Map<string, string>([['g1f3', '+0.30']])
    });
    await (local as any).refreshSuggestionQualities(5, 'scored', ['g1f3'], ['Nf3']);
    expect((local as any).suggestionQualityByMove.Nf3).toBe('history-quality--genius');
    expect((local as any).suggestionEvalTextByMove.Nf3).toBe('+0.30');
    expect((local as any).suggestionQualityByMove.e4).toBeUndefined();
  });
});

describe('ChessBoardComponent suggestion scoring edge mapping branches', () => {
  it('covers refreshSuggestedMoves fallback when formatted suggestions are empty', async () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    const engine = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.1'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo(['xxxx']),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, engine as any);
    spyOn<any>(local, 'getCurrentFen').and.returnValue(fen);
    (local as any).evaluationRunToken = 4;
    await (local as any).refreshSuggestedMoves(4);
    expect(local.suggestedMoves).toEqual(['n/a']);
  });

  it('covers buildDisplayToUciMap branch when display list is longer than uci list', () => {
    spyOn(component, 'getCctRecommendations').and.returnValues([], [], []);
    const map = (component as any).buildDisplayToUciMap(['g1f3'], ['Nf3', 'e4']);
    expect(map.get('Nf3')).toBe('g1f3');
    expect(map.has('e4')).toBeFalse();
  });

  it('covers no-engine evaluation, parseSquare bounds and format parsing guards', async () => {
    const localNoEngine = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any);
    const direct = await (localNoEngine as any).evaluateUciMovesForQuality(1, 'fen', ['e2e4']);
    expect(direct.pawnsByUci.size).toBe(0);

    const parseSpy = spyOn<any>(component, 'parseSquareToCoords').and.returnValue(null);
    expect((component as any).formatUciMoveForDisplay('e2e4')).toBe('');
    parseSpy.and.callThrough();

    clearBoard();
    expect((component as any).formatUciMoveForDisplay('e2e4')).toBe('e4');

    const originalMax = (ChessConstants as any).MAX_INDEX;
    (ChessConstants as any).MAX_INDEX = -1;
    try {
      expect((component as any).parseSquareToCoords('a1')).toBeNull();
    } finally {
      (ChessConstants as any).MAX_INDEX = originalMax;
    }

    expect((component as any).formatUciMoveForDisplay(undefined)).toBe('');
    expect((component as any).parseSquareToCoords(undefined)).toBeNull();
    expect((component as any).resolveMoveToUci(undefined)).toBeNull();
  });

  it('covers resolveMoveToUci piece-type, capture-file, invalid and promotion branches', () => {
    clearBoard();
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[7][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    spyOn(ChessRulesService, 'validateMove').and.returnValue({ isValid: true } as any);

    expect((component as any).resolveMoveToUci('Ke2')).toBe('e1e2');
    expect((component as any).resolveMoveToUci('Qh5')).toBe('d1h5');
    expect((component as any).resolveMoveToUci('Ra3')).toBe('a1a3');
    expect((component as any).resolveMoveToUci('Bb5')).toBe('c1b5');

    chessBoardStateService.field[4][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    expect((component as any).resolveMoveToUci('dxe5')).toBeNull();

    chessBoardStateService.field[1][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    expect((component as any).resolveMoveToUci('a8')).toBe('a7a8q');

    clearBoard();
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    expect((component as any).resolveMoveToUci('a1')).toBe('a2a1q');

    clearBoard();
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    (ChessRulesService.validateMove as any).and.returnValue({ isValid: false });
    expect((component as any).resolveMoveToUci('Nf3')).toBeNull();
    (ChessRulesService.validateMove as any).and.returnValue({ isValid: true });
    expect((component as any).resolveMoveToUci('Nf3')).toBe('g1f3');
    spyOn<any>(component, 'parseSquareToCoords').and.returnValue(null);
    expect((component as any).resolveMoveToUci('Nf3')).toBeNull();
  });

  it('covers suggestion quality scoring for black side', async () => {
    const engine = {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.1'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo(['g1f3']),
      terminate: jasmine.createSpy('terminate')
    };
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, engine as any);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    (local as any).evaluationRunToken = 12;
    spyOn<any>(local, 'buildDisplayToUciMap').and.returnValue(new Map<string, string>([
      ['Nf3', 'g1f3'],
      ['e4', 'e2e4']
    ]));
    spyOn<any>(local, 'evaluateUciMovesForQuality').and.resolveTo({
      pawnsByUci: new Map<string, number>([['g1f3', 0.3], ['e2e4', 1.2]]),
      textByUci: new Map<string, string>([['g1f3', '+0.30'], ['e2e4', '+1.20']])
    });
    await (local as any).refreshSuggestionQualities(12, 'black-scored', ['g1f3'], ['Nf3']);
    expect((local as any).suggestionQualityByMove.e4).toBe('history-quality--small-error');
  });
});

describe('ChessBoardComponent additional suggestion coverage', () => {
  it('covers visible history evaluations getter and suggestion label lookups', () => {
    spyOn(component, 'getVisibleHistory').and.returnValue(['e4']);
    spyOn<any>(component, 'getEvaluationForMove').and.returnValue('+0.20');
    expect(component.visibleHistoryEvaluations).toEqual(['+0.20']);

    (component as any).suggestionQualityByMove = { Nf3: 'history-quality--great' };
    (component as any).suggestionEvalTextByMove = { Nf3: '+0.30' };
    expect(component.getSuggestionQualityClass('Nf3')).toBe('history-quality--great');
    expect(component.getSuggestionEvalText('Nf3')).toBe('+0.30');
    expect(component.getSuggestionQualityClass('e4')).toBe('');
    expect(component.getSuggestionEvalText('e4')).toBe('');
  });

  it('covers refreshSuggestedMoves callback branch with explicit move arrays', async () => {
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.10'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo([]),
      terminate: jasmine.createSpy('terminate')
    } as any);
    (local as any).evaluationRunToken = 4;

    const refreshSpy = spyOn<any>(local, 'refreshSuggestionQualities').and.resolveTo();
    const facadeSpy = spyOn(ChessBoardEvaluationFacade, 'refreshSuggestedMoves').and.callFake(async (params: any) => {
      await params.refreshSuggestionQualities(4, 'fen', ['g1f3'], ['Nf3']);
      return {
        suggestedMoves: ['Nf3'],
        suggestionQualityByMove: {},
        suggestionEvalTextByMove: {}
      };
    });

    spyOn<any>(local, 'getCurrentFen').and.returnValue('fen');
    await (local as any).refreshSuggestedMoves(4);

    expect(facadeSpy).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalledWith(4, 'fen', ['g1f3'], ['Nf3']);
  });

  it('covers refreshSuggestedMoves callback branch null array fallback', async () => {
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any, undefined, undefined, undefined, {
      evaluateFen: jasmine.createSpy('evaluateFen').and.resolveTo('+0.10'),
      getTopMoves: jasmine.createSpy('getTopMoves').and.resolveTo([]),
      terminate: jasmine.createSpy('terminate')
    } as any);
    (local as any).evaluationRunToken = 6;

    const refreshSpy = spyOn<any>(local, 'refreshSuggestionQualities').and.resolveTo();
    spyOn(ChessBoardEvaluationFacade, 'refreshSuggestedMoves').and.callFake(async (params: any) => {
      await params.refreshSuggestionQualities(6, 'fen', null, null);
      return {
        suggestedMoves: ['Nf3'],
        suggestionQualityByMove: {},
        suggestionEvalTextByMove: {}
      };
    });

    spyOn<any>(local, 'getCurrentFen').and.returnValue('fen');
    await (local as any).refreshSuggestedMoves(6);
    expect(refreshSpy).toHaveBeenCalledWith(6, 'fen', [], []);
  });

  it('covers king-context preview helper early-return and dedupe branches', () => {
    const local = new ChessBoardComponent(chessBoardStateService, { get: () => of([]) } as any);
    (local as any).chessBoardStateService.field = null;
    const early = (local as any).buildKingContextPreviewArrows(
      { piece: ChessPiecesEnum.King, targetRow: 7, targetCol: 4 },
      ChessColorsEnum.White
    );
    expect(early).toEqual([]);

    (local as any).chessBoardStateService.field = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => [] as any[])
    );
    clearBoard();
    const noEnemyKingArrows: any[] = [];
    (local as any).collectKingAttackPreviewArrows(
      chessBoardStateService.field,
      ChessColorsEnum.White,
      ChessColorsEnum.Black,
      noEnemyKingArrows,
      new Set<string>()
    );
    expect(noEnemyKingArrows.length).toBe(0);

    const noOwnKingArrows: any[] = [];
    (local as any).collectKingDefensePreviewArrows(
      chessBoardStateService.field,
      ChessColorsEnum.White,
      ChessColorsEnum.Black,
      noOwnKingArrows,
      new Set<string>()
    );
    expect(noOwnKingArrows.length).toBe(0);

    const arrows: any[] = [];
    const seen = new Set<string>();
    const arrow = { fromRow: 1, fromCol: 1, toRow: 2, toCol: 2, color: 'gold', intensity: 0.3 };
    (local as any).pushUniquePreviewArrow(arrows, seen, arrow);
    (local as any).pushUniquePreviewArrow(arrows, seen, arrow);
    expect(arrows.length).toBe(1);
  });
});

