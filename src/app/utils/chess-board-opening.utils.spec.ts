/* eslint-disable max-lines-per-function */
import { ChessBoardOpeningUtils, IOpeningDebugTextDictionary } from './chess-board-opening.utils';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

const uiText: IOpeningDebugTextDictionary = {
  message: {
    openingPrefix: 'Opening',
    matchedStepsPrefix: 'Matched steps',
    linePrefix: 'Line',
    bookRecommendationPrefix: 'Book recommendation',
    bookRecommendationNowSuffix: 'now',
    bookRecommendationAfterSuffix: 'after',
    notesPrefix: 'Notes'
  },
  status: {
    white: 'White',
    black: 'Black'
  }
};

describe('ChessBoardOpeningUtils', () => {
  it('normalizes and extracts notation steps', () => {
    expect(ChessBoardOpeningUtils.normalizeNotationToken('')).toBe('');
    expect(ChessBoardOpeningUtils.normalizeNotationToken('e2-e4+?!')).toBe('e2-e4');
    expect(ChessBoardOpeningUtils.extractNotationSteps('1. e2-e4 e7-e5 2... Ng1-f3??')).toEqual([
      'e2-e4',
      'e7-e5',
      'Ng1-f3'
    ]);
    expect(ChessBoardOpeningUtils.extractNotationSteps('')).toEqual([]);
  });

  it('parses openings payload and filters invalid items', () => {
    expect(ChessBoardOpeningUtils.parseOpeningsPayload(null as any)).toEqual([]);
    const parsed = ChessBoardOpeningUtils.parseOpeningsPayload([
      { name: 'A', long_algebraic_notation: '1. e2-e4' },
      { name: '', long_algebraic_notation: '1. d2-d4' } as any,
      { name: 'B', long_algebraic_notation: '' } as any
    ]);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('A');
    expect(parsed[0].steps).toEqual(['e2-e4']);
  });

  it('handles opening-name prefix rules and displayed names', () => {
    const opening = {
      name: 'Main',
      steps: ['e2-e4', 'c7-c5'],
      raw: {
        long_algebraic_notation: '1. e2-e4 c7-c5',
        suggested_best_response_name: 'Najdorf',
        suggested_best_response_notation_step: 'Ng1-f3'
      }
    };
    expect(ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName('', 'Najdorf')).toBeFalse();
    expect(ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName('Main', '')).toBeFalse();
    expect(ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName('Sicilian', 'Sicilian Najdorf')).toBeFalse();
    expect(ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName('Italian', 'Sicilian')).toBeTrue();

    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(null as any, [])).toBe('');
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(opening as any, ['e2-e4'])).toBe('Main');
    expect(ChessBoardOpeningUtils.getDisplayedOpeningName(opening as any, ['e2-e4', 'c7-c5', 'Ng1-f3'])).toBe('Main: Najdorf');
  });

  it('selects best opening match with depth and completion tie-breakers', () => {
    const openings: any[] = [
      {
        name: 'Long Line',
        steps: ['e2-e4', 'e7-e5', 'Ng1-f3'],
        raw: { suggested_best_response_notation_step: '' }
      },
      {
        name: 'Short Complete',
        steps: ['e2-e4'],
        raw: { suggested_best_response_notation_step: '' }
      },
      {
        name: 'With Suggested',
        steps: ['d2-d4'],
        raw: { suggested_best_response_notation_step: 'd7-d5 c2-c4' }
      }
    ];

    const noMatch = ChessBoardOpeningUtils.findBestOpeningMatch(openings, ['c2-c4']);
    expect(noMatch.opening).toBeNull();

    const completePreferred = ChessBoardOpeningUtils.findBestOpeningMatch(openings, ['e2-e4']);
    expect(completePreferred.opening?.name).toBe('Short Complete');

    const suggestedDepth = ChessBoardOpeningUtils.findBestOpeningMatch(openings, ['d2-d4', 'd7-d5']);
    expect(suggestedDepth.opening?.name).toBe('With Suggested');
    expect(suggestedDepth.baseMatchedDepth).toBe(1);
  });

  it('formats opening debug text for projected and non-projected suggested lines', () => {
    const opening: any = {
      name: 'Main',
      steps: ['e2-e4', 'e7-e5'],
      raw: {
        long_algebraic_notation: '1. e2-e4 e7-e5',
        suggested_best_response_name: 'Ruy Lopez',
        suggested_best_response_notation_step: 'Ng1-f3 Nb8-c6',
        short_description: 'Classic development'
      }
    };

    const projected = ChessBoardOpeningUtils.formatOpeningDebugText(opening, 2, 3, ['e2-e4', 'e7-e5', 'Ng1-f3'], uiText, 'n/a');
    expect(projected).toContain('Opening: Main: Ruy Lopez');
    expect(projected).toContain('Book recommendation (Black now): Nb8-c6');

    const nonProjected = ChessBoardOpeningUtils.formatOpeningDebugText(opening, 1, 1, ['e2-e4'], uiText, 'n/a');
    expect(nonProjected).toContain('Book recommendation (Black now): e7-e5');
    expect(nonProjected).toContain('Book recommendation (White after): Main: Ruy Lopez (Ng1-f3 Nb8-c6)');

    const withMissingHistorySteps = ChessBoardOpeningUtils.formatOpeningDebugText(opening, 0, 0, undefined as any, uiText, 'n/a');
    expect(withMissingHistorySteps).toContain('Opening: Main');

    expect(ChessBoardOpeningUtils.formatOpeningDebugText(null as any, 0, 0, [], uiText, 'n/a')).toBe('');
  });

  it('loads localized assets with fallback and completes after all files', () => {
    const http = {
      get: jasmine.createSpy('get').and.callFake((path: string) => {
        if (path.includes('openings2.json') && path.includes('/hu_HU/')) {
          return throwError(() => new Error('missing localized file'));
        }
        if (path.endsWith('openings1.json')) {
          return of([{ name: 'A', long_algebraic_notation: '1. e2-e4' }]);
        }
        if (path.endsWith('openings2.json')) {
          return of([{ name: 'B', long_algebraic_notation: '1. d2-d4' }]);
        }
        return of([]);
      })
    } as unknown as HttpClient;

    const loadedNames: string[] = [];
    let completed = false;
    ChessBoardOpeningUtils.loadOpeningsFromAssets(
      http,
      'hu_HU',
      'en_US',
      (items) => loadedNames.push(...items.map(item => item.name)),
      () => {
        completed = true;
      }
    );

    expect(http.get).toHaveBeenCalledWith('assets/openings/hu_HU/openings2.json');
    expect(http.get).toHaveBeenCalledWith('assets/openings/openings2.json');
    expect(loadedNames).toEqual(['A', 'B']);
    expect(completed).toBeTrue();
  });

  it('reads default locale opening asset from fallback path', () => {
    const http = {
      get: jasmine.createSpy('get').and.returnValue(of([]))
    } as unknown as HttpClient;

    ChessBoardOpeningUtils.getOpeningAsset$(http, 'openings1.json', 'en_US', 'en_US').subscribe();
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledWith('assets/openings/openings1.json');
  });

  it('completes immediately when opening files list is empty', () => {
    const http = {
      get: jasmine.createSpy('get')
    } as unknown as HttpClient;
    let completed = false;

    ChessBoardOpeningUtils.loadOpeningsFromAssets(
      http,
      'en_US',
      'en_US',
      () => undefined,
      () => {
        completed = true;
      },
      []
    );

    expect(completed).toBeTrue();
    expect((http.get as jasmine.Spy).calls.count()).toBe(0);
  });
});
