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
    spyOn<any>(service, 'getPositionKey').and.returnValue('same');

    const cached = service.ensureCctRecommendations(emptyBoard(), ChessColorsEnum.White, 0);
    expect(cached[CctCategoryEnum.Captures][0].move).toBe('a');
  });

  it('builds capture/check/threat recommendations and updates cache key', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)];
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    board[3][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];

    spyOn<any>(service, 'getPositionKey').and.returnValue('p1');
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

    spyOn<any>(service, 'getPositionKey').and.returnValue('p2');
    spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol) => targetRow === 3 && targetCol === 3);
    spyOn(ChessBoardLogicUtils, 'simulateMove').and.callFake((b) => ChessBoardLogicUtils.cloneField(b));
    spyOn(ChessBoardLogicUtils, 'isKingInCheck').and.returnValues(true, false, false);
    spyOn(ChessBoardCctUtils, 'getThreatenedEnemyPiecesByMovedPiece').and.returnValue([ChessPiecesEnum.Queen, ChessPiecesEnum.Pawn]);

    const result = service.ensureCctRecommendations(board, ChessColorsEnum.White, 0);
    expect(result[CctCategoryEnum.Threats].length).toBeGreaterThan(0);
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
  });

  it('updates recognized opening and avoids repeating same debug key', () => {
    const uiText = {
      message: {
        openingLabel: 'Opening',
        matchedSteps: 'Matched',
        bookRecommendationWhite: 'White',
        bookRecommendationBlack: 'Black',
        lineLabel: 'Line'
      }
    };

    const none = service.updateRecognizedOpeningForCurrentHistory(['e4'], uiText as any, '-');
    expect(none.activeOpening).toBeNull();

    (service as any).openings = [{
      name: 'Main',
      steps: ['e4', 'e5'],
      raw: { long_algebraic_notation: '1. e4 e5', suggested_best_response_name: 'line' }
    }];

    const first = service.updateRecognizedOpeningForCurrentHistory(['1.e4'], uiText as any, '-');
    expect(first.debugText).toContain('Opening');

    const second = service.updateRecognizedOpeningForCurrentHistory(['1.e4'], uiText as any, '-');
    expect(second.debugText).toBe('');
  });

  it('formats opening debug text and private parsing/matching helpers', () => {
    const uiText = {
      message: {
        openingLabel: 'Opening',
        matchedSteps: 'Matched',
        bookRecommendationWhite: 'White',
        bookRecommendationBlack: 'Black',
        lineLabel: 'Line'
      }
    };
    const opening = {
      name: 'Main',
      steps: ['e4', 'e5'],
      raw: {
        long_algebraic_notation: '1. e4 e5',
        suggested_best_response_name: 'BestName',
        suggested_best_response_notation_step: 'BestMove'
      }
    };

    expect(service.formatOpeningDebugText(opening as any, 0, 1, ['e4'], uiText as any, '-')).toContain('White: BestName');
    expect(service.formatOpeningDebugText(opening as any, 1, 2, ['e4', 'e5'], uiText as any, '-')).toContain('Black: BestMove');
    expect(service.formatOpeningDebugText(opening as any, 2, 2, ['e4', 'e5'], uiText as any, 'N/A')).toContain('Line: 1. e4 e5');
    expect(service.formatOpeningDebugText(null as any, 0, 0, [], uiText as any, '-')).toBe('');

    expect((service as any).normalizeOpeningNotation('1. e4 e5 2. Nf3')).toEqual(['e4', 'e5', 'Nf3']);
    expect((service as any).normalizeOpeningNotation('')).toEqual([]);
    expect((service as any).normalizeNotationToken('2...Nf3 ')).toBe('..Nf3');
    expect((service as any).normalizeNotationToken('')).toBe('');
    expect((service as any).parseOpeningsPayload(null)).toEqual([]);
    expect(typeof (service as any).getPositionKey(emptyBoard(), ChessColorsEnum.White)).toBe('string');

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

    spyOn<any>(service, 'getPositionKey').and.returnValue('cb');
    const threatSpy = spyOn(ChessBoardCctUtils, 'getThreatenedEnemyPiecesByMovedPiece').and.callThrough();
    const stepSpy = spyOn(ChessRulesService, 'canStepThere').and.callFake((targetRow, targetCol) => targetRow === 3 && targetCol === 4);
    spyOn(ChessBoardLogicUtils, 'simulateMove').and.returnValue(board);
    spyOn(ChessBoardLogicUtils, 'isKingInCheck').and.returnValue(false);

    service.ensureCctRecommendations(board, ChessColorsEnum.White, 0);
    expect(threatSpy).toHaveBeenCalled();
    expect(stepSpy).toHaveBeenCalled();
  });
});
