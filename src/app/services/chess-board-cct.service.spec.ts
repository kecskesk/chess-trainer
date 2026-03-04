import { of, throwError } from 'rxjs';
import { ChessBoardCctService } from './chess-board-cct.service';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { CctCategoryEnum } from '../model/enums/cct-category.enum';
import { ChessRulesService } from './chess-rules.service';
import { ChessBoardLogicUtils } from '../utils/chess-board-logic.utils';
import { ChessBoardCctUtils } from '../utils/chess-board-cct.utils';
import { UiTextLoaderService } from './ui-text-loader.service';
import { ChessBoardStateService } from './chess-board-state.service';
import { UiText } from '../constants/ui-text.constants';

function emptyBoard(): ChessPieceDto[][][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));
}

describe('ChessBoardCctService recommendation cache', () => {
  let service: ChessBoardCctService;
  let http: { get: jasmine.Spy };

  beforeEach(() => {
    http = { get: jasmine.createSpy('get').and.returnValue(of([])) };
    service = new ChessBoardCctService(http as any);
  });

  it('resets cache on invalid board/turn and returns cached value by key', () => {
    const noBoard = service.ensureCctRecommendations(null as any, ChessColorsEnum.White, 0);
    expect(noBoard[CctCategoryEnum.Captures]).toEqual([]);

    const noTurn = service.ensureCctRecommendations(emptyBoard(), null as any, 0);
    expect(noTurn[CctCategoryEnum.Checks]).toEqual([]);

    (service as any).cctRecommendationsCache = {
      [CctCategoryEnum.Captures]: [{ move: 'a', tooltip: 'a' }],
      [CctCategoryEnum.Checks]: [],
      [CctCategoryEnum.Threats]: []
    };
    (service as any).cctRecommendationsCacheKey = 'same';
    spyOn(ChessBoardLogicUtils, 'getPositionKey').and.returnValue('same');

    const cached = service.ensureCctRecommendations(emptyBoard(), ChessColorsEnum.White, 0);
    expect(cached[CctCategoryEnum.Captures][0].move).toBe('a');
  });

  it('builds capture/check/threat recommendations and updates cache key', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    board[3][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];

    spyOn(ChessBoardLogicUtils, 'getPositionKey').and.returnValue('p1');
    spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol) => targetRow === 3 && targetCol === 4);
    spyOn(ChessBoardLogicUtils, 'simulateMove').and.callFake((b) => ChessBoardLogicUtils.cloneField(b));
    spyOn(ChessBoardLogicUtils, 'isKingInCheck').and.callFake((_b, color) => color === ChessColorsEnum.Black);
    spyOn(ChessBoardCctUtils, 'getThreatenedEnemyPiecesByMovedPiece').and.returnValue([ChessPiecesEnum.Rook]);

    const result = service.ensureCctRecommendations(board, ChessColorsEnum.White, 0);
    expect(result[CctCategoryEnum.Captures].length).toBeGreaterThan(0);
    expect(result[CctCategoryEnum.Checks].length).toBeGreaterThan(0);
    expect((service as any).cctRecommendationsCacheKey).toBe('p1');
  });

  it('adds threats and skips self-check moves', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];

    spyOn(ChessBoardLogicUtils, 'getPositionKey').and.returnValue('p2');
    spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol) => targetRow === 3 && targetCol === 3);
    spyOn(ChessBoardLogicUtils, 'simulateMove').and.callFake((b) => ChessBoardLogicUtils.cloneField(b));
    spyOn(ChessBoardLogicUtils, 'isKingInCheck').and.returnValues(true, false, false);
    spyOn(ChessBoardCctUtils, 'getThreatenedEnemyPiecesByMovedPiece').and.returnValue([ChessPiecesEnum.Queen, ChessPiecesEnum.Pawn]);

    const result = service.ensureCctRecommendations(board, ChessColorsEnum.White, 0);
    expect(result[CctCategoryEnum.Threats].length).toBeGreaterThan(0);
  });

  it('covers black-to-move path and non-capture check tooltip/score branches', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[1][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    spyOn(ChessBoardLogicUtils, 'getPositionKey').and.returnValue('p3');
    spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol) => targetRow === 2 && targetCol === 4);
    spyOn(ChessBoardLogicUtils, 'simulateMove').and.callFake((b) => ChessBoardLogicUtils.cloneField(b));
    spyOn(ChessBoardLogicUtils, 'isKingInCheck').and.callFake((_b, color) => color === ChessColorsEnum.White);
    spyOn(ChessBoardCctUtils, 'getThreatenedEnemyPiecesByMovedPiece').and.returnValue([ChessPiecesEnum.Queen]);

    const result = service.ensureCctRecommendations(board, ChessColorsEnum.Black, 0);
    expect(result[CctCategoryEnum.Checks].length).toBeGreaterThan(0);
    expect(result[CctCategoryEnum.Checks][0].tooltip).not.toContain('with capture');
  });
});

describe('ChessBoardCctService recommendation cache tactical regression', () => {
  let service: ChessBoardCctService;

  beforeEach(() => {
    service = new ChessBoardCctService({ get: jasmine.createSpy('get').and.returnValue(of([])) } as any);
  });

  it('does not return all-empty recommendations for a tactical black-to-move middlegame', () => {
    const board = emptyBoard();
    board[0][0] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    board[0][1] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)];
    board[0][2] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)];
    board[0][3] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Queen)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[0][5] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)];
    board[0][6] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)];
    board[0][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    board[1][0] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];
    board[1][2] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];
    board[1][7] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];
    board[2][5] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];
    board[3][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    board[5][1] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];
    board[5][5] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    board[6][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    board[6][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    board[6][5] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    board[6][6] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    board[6][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];
    board[7][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    board[7][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    board[7][2] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[7][5] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];
    board[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];

    const result = service.ensureCctRecommendations(board, ChessColorsEnum.Black, 16);
    const total =
      result[CctCategoryEnum.Captures].length +
      result[CctCategoryEnum.Checks].length +
      result[CctCategoryEnum.Threats].length;
    expect(total).toBeGreaterThan(0);
  });

  it('builds recommendations even when global board helper is temporarily null', () => {
    const previousHelper = ChessBoardStateService.BOARD_HELPER;
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[0][3] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Queen)];
    board[3][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    ChessBoardStateService.BOARD_HELPER = null as any;
    try {
      const result = service.ensureCctRecommendations(board, ChessColorsEnum.Black, 0);
      expect(result[CctCategoryEnum.Captures].length).toBeGreaterThan(0);
    } finally {
      ChessBoardStateService.BOARD_HELPER = previousHelper;
    }
  });
});

describe('ChessBoardCctService opening assets', () => {
  let service: ChessBoardCctService;
  let http: { get: jasmine.Spy };

  beforeEach(() => {
    http = { get: jasmine.createSpy('get').and.returnValue(of([])) };
    service = new ChessBoardCctService(http as any);
  });

  it('loads opening assets and marks completion when all files finish', () => {
    http.get.and.callFake((path: string) => {
      if (path.includes('openings1.json')) {
        return of([{ name: 'A', long_algebraic_notation: '1. e4' }]);
      }
      if (path.includes('openings2.json')) {
        return of([{ name: 'B', long_algebraic_notation: '1. d4' }]);
      }
      return of([{ name: '', long_algebraic_notation: '' } as any]);
    });

    let loaded = false;
    let updated = false;
    const state = service.loadOpeningsFromAssets('hu_HU', (value) => {
      loaded = value;
    }, () => {
      updated = true;
    });

    expect(state.openingsLoaded).toBeTrue();
    expect(loaded).toBeTrue();
    expect(updated).toBeTrue();
    expect((service as any).openings.length).toBe(2);
    expect(http.get).toHaveBeenCalledWith('assets/openings/hu_HU/openings1.json');
  });

  it('falls back to default locale path when locale input is empty', () => {
    http.get.and.returnValue(of([{ name: 'A', long_algebraic_notation: '1. e4' }]));
    let loaded = false;
    service.loadOpeningsFromAssets('', (value) => {
      loaded = value;
    }, () => undefined);

    expect(loaded).toBeTrue();
    expect(http.get).toHaveBeenCalledWith('assets/openings/openings1.json');
  });

  it('resolves localized and default assets with fallback behavior', () => {
    http.get.and.callFake((path: string) => {
      if (path.includes('/fr_FR/')) {
        return throwError(() => new Error('missing locale'));
      }
      if (path.includes('openings1.json')) {
        return of([{ name: 'Fallback', long_algebraic_notation: '1. e4' }]);
      }
      return throwError(() => new Error('missing fallback'));
    });

    let defaultItems: any[] = [];
    (service as any).getOpeningAsset$('openings1.json', UiTextLoaderService.DEFAULT_LOCALE).subscribe((items: any[]) => {
      defaultItems = items;
    });
    expect(defaultItems.length).toBe(1);

    let localizedItems: any[] = [];
    (service as any).getOpeningAsset$('openings1.json', 'fr_FR').subscribe((items: any[]) => {
      localizedItems = items;
    });
    expect(localizedItems.length).toBe(1);

    let emptyItems: any[] = [];
    (service as any).getOpeningAsset$('openings2.json', 'fr_FR').subscribe((items: any[]) => {
      emptyItems = items;
    });
    expect(emptyItems).toEqual([]);

    http.get.and.returnValue(throwError(() => new Error('missing')));
    (service as any).getOpeningAsset$('openings1.json', UiTextLoaderService.DEFAULT_LOCALE).subscribe((items: any[]) => {
      emptyItems = items;
    });
    expect(emptyItems).toEqual([]);
  });
});

describe('ChessBoardCctService opening matching and helper coverage', () => {
  let service: ChessBoardCctService;

  beforeEach(() => {
    service = new ChessBoardCctService({ get: jasmine.createSpy('get').and.returnValue(of([])) } as any);
    UiText.message.openingPrefix = 'Opening';
    UiText.message.matchedStepsPrefix = 'Matched';
    UiText.message.linePrefix = 'Line';
    UiText.status.white = 'White';
    UiText.status.black = 'Black';
  });

  it('updates recognized opening and avoids repeating same debug key', () => {
    const none = service.updateRecognizedOpeningForCurrentHistory(['e4']);
    expect(none.activeOpening).toBeNull();

    (service as any).openings = [{
      name: 'Main',
      steps: ['e4', 'e5'],
      raw: { long_algebraic_notation: '1. e4 e5', suggested_best_response_name: 'line' }
    }];

    const first = service.updateRecognizedOpeningForCurrentHistory(['1.e4']);
    expect(first.debugText).toContain('Opening');

    const second = service.updateRecognizedOpeningForCurrentHistory(['1.e4']);
    expect(second.debugText).toBe('');
  });

  it('sets debug key with none suffix when no opening is matched', () => {
    (service as any).openings = [{
      name: 'Main',
      steps: ['e4', 'e5'],
      raw: { long_algebraic_notation: '1. e4 e5' }
    }];
    const result = service.updateRecognizedOpeningForCurrentHistory(['d4']);
    expect(result.activeOpening).toBeNull();
    expect(result.debugText).toBe('');
  });
});

describe('ChessBoardCctService opening helper formatting and matching', () => {
  let service: ChessBoardCctService;

  beforeEach(() => {
    service = new ChessBoardCctService({ get: jasmine.createSpy('get').and.returnValue(of([])) } as any);
    UiText.message.openingPrefix = 'Opening';
    UiText.message.matchedStepsPrefix = 'Matched';
    UiText.message.linePrefix = 'Line';
    UiText.status.white = 'White';
    UiText.status.black = 'Black';
  });

  it('formats opening debug text and private parsing/matching helpers', () => {
    const opening = {
      name: 'Main',
      steps: ['e4', 'e5'],
      raw: {
        long_algebraic_notation: '1. e4 e5',
        suggested_best_response_name: 'BestName',
        suggested_best_response_notation_step: 'BestMove'
      }
    };

    expect(service.formatOpeningDebugText(opening as any, 0, 1)).toContain('White: BestName');
    expect(service.formatOpeningDebugText(opening as any, 1, 2)).toContain('Black: BestMove');
    expect(service.formatOpeningDebugText(opening as any, 2, 2)).toContain('Line: 1. e4 e5');
    expect(service.formatOpeningDebugText(
      { name: 'NoLine', steps: ['e4'], raw: { long_algebraic_notation: '' } } as any,
      1,
      1
    )).toContain('Line: n/a');
    expect(service.formatOpeningDebugText(null as any, 0, 0)).toBe('');

    expect((service as any).normalizeOpeningNotation('1. e4 e5 2. Nf3')).toEqual(['e4', 'e5', 'Nf3']);
    expect((service as any).normalizeOpeningNotation('')).toEqual([]);
    expect((service as any).normalizeNotationToken('2...Nf3 ')).toBe('..Nf3');
    expect((service as any).normalizeNotationToken('')).toBe('');
    expect((service as any).parseOpeningsPayload(null)).toEqual([]);
    expect(typeof ChessBoardLogicUtils.getPositionKey(emptyBoard(), ChessColorsEnum.White, {})).toBe('string');

    const openings = [
      { name: 'Complete', steps: ['e4'], raw: {} },
      { name: 'Longer', steps: ['e4', 'e5'], raw: {} },
      { name: 'Other', steps: ['d4'], raw: {} }
    ];
    expect((service as any).findBestOpeningMatch(openings, ['e4']).opening?.name).toBe('Complete');
    expect((service as any).findBestOpeningMatch(
      [
        { name: 'CompleteLong', steps: ['e4', 'e5'], raw: {} },
        { name: 'CompleteShort', steps: ['e4', 'e5'], raw: {} }
      ],
      ['e4', 'e5']
    ).opening?.name).toBe('CompleteLong');
    expect((service as any).findBestOpeningMatch(
      [
        { name: 'PartialLong', steps: ['e4', 'c5', 'Nf3'], raw: {} },
        { name: 'PartialShort', steps: ['e4', 'c5'], raw: {} }
      ],
      ['e4', 'c5', 'd4']
    ).opening?.name).toBe('PartialShort');
    expect((service as any).findBestOpeningMatch(
      [
        { name: 'Complete', steps: ['e4'], raw: {} },
        { name: 'Partial', steps: ['e4', 'c5'], raw: {} }
      ],
      ['e4']
    ).opening?.name).toBe('Complete');
    expect((service as any).findBestOpeningMatch(openings, ['c4']).opening).toBeNull();
  });
});

describe('ChessBoardCctService threatened-piece callback wiring', () => {
  let service: ChessBoardCctService;

  beforeEach(() => {
    service = new ChessBoardCctService({ get: jasmine.createSpy('get').and.returnValue(of([])) } as any);
  });

  it('passes through canAttack callback in threatened-piece collection path', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    board[3][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];

    spyOn(ChessBoardLogicUtils, 'getPositionKey').and.returnValue('cb');
    const threatSpy = spyOn(ChessBoardCctUtils, 'getThreatenedEnemyPiecesByMovedPiece').and.callThrough();
    const stepSpy = spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol) => targetRow === 3 && targetCol === 4);
    spyOn(ChessBoardLogicUtils, 'simulateMove').and.returnValue(board);
    spyOn(ChessBoardLogicUtils, 'isKingInCheck').and.returnValue(false);

    service.ensureCctRecommendations(board, ChessColorsEnum.White, 0);
    expect(threatSpy).toHaveBeenCalled();
    expect(stepSpy).toHaveBeenCalled();
  });
});

