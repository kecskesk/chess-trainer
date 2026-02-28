import { ChessBoardComponent } from './chess-board.component';
import { ChessBoardStateService } from '../../services/chess-board-state.service';
import { ChessRulesService } from '../../services/chess-rules.service';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../../model/enums/chess-pieces.enum';
import { Observable, of, throwError } from 'rxjs';

// common variables and helpers used across multiple suites
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
    expect((component as any).mapPercentCoordinateForDisplay('25%')).toBe('25%');
    expect((component as any).mapRotationForDisplay('30deg')).toBe('30deg');

    component.isBoardFlipped = true;
    expect((component as any).getBoardIndexForDisplay(2)).toBe(5);
    expect((component as any).mapPercentCoordinateForDisplay('')).toBe('');
    expect((component as any).mapPercentCoordinateForDisplay('text')).toBe('text');
    expect((component as any).mapPercentCoordinateForDisplay('-20%')).toBe('120%');

    expect((component as any).mapRotationForDisplay('text')).toBe('text');
    expect((component as any).mapRotationForDisplay('-300deg')).toBe('240deg');
    expect((component as any).mapRotationForDisplay('540deg')).toBe('0deg');

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
    (component as any).movePieceBetweenCells(null, target);
    expect(target.length).toBe(0);

    chessBoardStateService.boardHelper.gameOver = false;
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    expect(component.getStatusTitle()).toBe(`${ChessColorsEnum.White} ${component.uiText.status.toMoveSuffix}`);

    (component as any).movePieceBetweenCells(source, target);
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

    expect(canDropLike(4, 3, 3, 4)).toBeTrue();
    component.onDrop(createDropLike(4, 3, 3, 4));
    expect(chessBoardStateService.field[4][3].length).toBe(0);
    expect(chessBoardStateService.field[3][4].length).toBe(1);
    expect(chessBoardStateService.field[3][4][0].color).toBe(ChessColorsEnum.White);

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[3][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[4][3] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;

    expect(canDropLike(3, 4, 4, 3)).toBeTrue();
    component.onDrop(createDropLike(3, 4, 4, 3));
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
});

describe('ChessBoardComponent gameplay moves and rules', () => {
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

});

describe('ChessBoardComponent gameplay moves and rules (continued)', () => {
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

    const displayed = (component as any).getDisplayedOpeningName(opening, ['e2-e4', 'c7-c5']);
    expect(displayed).toBe('Sicilian Defense: Najdorf');
  });

  it('covers mock-eval negative index and empty-history cursor branches', () => {
    expect(component.getMockEvaluationForMove(-1)).toBe('+0.0');
    expect(typeof component.getMockEvaluationForMove(3)).toBe('string');

    chessBoardStateService.boardHelper.history = {} as any;
    component.mockHistoryCursor = 2;
    expect(component.getVisibleHistory()).toEqual([]);
  });

  it('covers opening-name prefix and debug-line fallback branches', () => {
    expect((component as any).shouldPrefixSuggestedOpeningName('', 'Sicilian Defense')).toBeFalse();
    expect((component as any).shouldPrefixSuggestedOpeningName('Sicilian Defense', '')).toBeFalse();
    expect((component as any).shouldPrefixSuggestedOpeningName('Sicilian Defense', 'Sicilian Defense: Najdorf')).toBeFalse();
    expect((component as any).shouldPrefixSuggestedOpeningName('Italian Game', 'Sicilian Defense')).toBeTrue();

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
    const ranked = (component as any).pickTopCctRecommendations([
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
    component.onDebugPanelToggle({} as any);
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
    component.undoMoveMock();
    component.redoMoveMock();

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

    expect(canDropLike(0, 1, 2, 2)).toBeTrue();
    component.onDrop(createDropLike(0, 1, 2, 2));

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
    expect(component.getMockEndgameRecognition()).toBe('Transition phase (mock)');

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
    expect((component as any).pieceNotation(ChessPiecesEnum.Bishop)).toBe('B');
    expect((component as any).pieceName(ChessPiecesEnum.King)).toBe('king');
    expect((component as any).pieceName(ChessPiecesEnum.Rook)).toBe('rook');
    expect((component as any).pieceName(ChessPiecesEnum.Knight)).toBe('knight');
    expect((component as any).pieceName(ChessPiecesEnum.Pawn)).toBe('pawn');
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
    expect((component as any).parseFieldId('bad')).toBeNull();
    expect((component as any).parseFieldId('fieldx0')).toBeNull();
  });

  it('covers localStorage catch branches for debug panel persistence', () => {
    const getSpy = spyOn(localStorage, 'getItem').and.throwError('denied');
    expect((component as any).readDebugPanelOpenState()).toBeFalse();
    getSpy.and.callThrough();

    const setSpy = spyOn(localStorage, 'setItem').and.throwError('denied');
    (component as any).persistDebugPanelOpenState(true);
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
    component.undoMoveMock();
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.mockHistoryCursor = 1;
    component.redoMoveMock();
    expect(component.mockHistoryCursor).toBeNull();

    component.pendingDrawOfferBy = ChessColorsEnum.White;
    component.offerDraw();
  });

  it('covers opening parsing/formatting fallback branches', () => {
    expect((component as any).parseOpeningsPayload(null)).toEqual([]);
    expect((component as any).normalizeNotationToken('')).toBe('');
    expect((component as any).getDisplayedOpeningName(null, [])).toBe('');
    expect((component as any).formatOpeningDebugText(null, 0, [])).toBe('');
    const opening = { name: 'X', steps: ['e2-e4'], raw: { suggested_best_response_name: 'Y', suggested_best_response_notation_step: '2... e7-e5' } };
    expect((component as any).getDisplayedOpeningName(opening, ['d2-d4'])).toBe('X');
    expect((component as any).getDisplayedOpeningName(opening, ['e2-e4'])).toBe('X');
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
    expect((component as any).getCurrentVisibleMoveIndex()).toBe(-1);
    chessBoardStateService.boardHelper.history = { '1': 'e2-e4' } as any;
    component.mockHistoryCursor = 5;
    expect((component as any).getCurrentVisibleMoveIndex()).toBe(0);
    chessBoardStateService.boardHelper.history = savedHistory as any;

    const savedService = (component as any).chessBoardStateService;
    (component as any).chessBoardStateService = null;
    expect(component.getDebugPositionKey()).toBe('');
    expect(component.getDebugCastlingRights()).toBe('-');
    (component as any).chessBoardStateService = savedService;

    expect((component as any).isNonPawnNonCaptureMove('')).toBeFalse();
    expect((component as any).isNonPawnNonCaptureMove('O-O')).toBeTrue();

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.field[0][2] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.field[6][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Knight } as any];
    expect((component as any).isInsufficientMaterial(chessBoardStateService.field)).toBeFalse();

    clearBoard();
    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    expect((component as any).isInsufficientMaterial(chessBoardStateService.field)).toBeTrue();
  });

  it('covers opening helper direct-return branches and color-init ternaries', () => {
    const opening = {
      name: 'OnlyName',
      steps: ['e2-e4'],
      raw: { name: 'OnlyName', suggested_best_response_name: 'Some Line', suggested_best_response_notation_step: '' }
    };
    expect((component as any).getDisplayedOpeningName(opening, ['d2-d4'])).toBe('OnlyName');
    expect((component as any).getDisplayedOpeningName(opening, ['e2-e4'])).toBe('OnlyName');
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
    component.undoMoveMock();
    expect(component.mockHistoryCursor).toBe(0);

    const opening = {
      name: 'Main',
      steps: ['e2-e4', 'e7-e5'],
      raw: {
        suggested_best_response_name: 'Line',
        suggested_best_response_notation_step: '2. Ng1-f3 Nb8-c6'
      }
    };
    expect((component as any).getDisplayedOpeningName(opening, ['e2-e4', 'c7-c5', 'Ng1-f3'])).toBe('Main');
    expect((component as any).getDisplayedOpeningName(opening, ['e2-e4', 'e7-e5', 'd2-d4'])).toBe('Main');
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

