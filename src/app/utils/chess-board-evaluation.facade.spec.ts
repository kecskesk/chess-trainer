import { ChessBoardEvaluationFacade } from './chess-board-evaluation.facade';

describe('ChessBoardEvaluationFacade', () => {
  it('returns existing schedule state when engine is unavailable or preview mode is on', () => {
    const existingTimer = setTimeout(() => undefined, 1000);

    const noEngine = ChessBoardEvaluationFacade.scheduleEvaluationRefresh({
      hasEngine: false,
      previewMode: false,
      evaluationRefreshTimer: existingTimer,
      evaluationRunToken: 5,
      evaluationDebounceMs: 10,
      runRefresh: () => undefined
    });
    expect(noEngine.evaluationRefreshTimer).toBe(existingTimer);
    expect(noEngine.evaluationRunToken).toBe(5);

    const previewMode = ChessBoardEvaluationFacade.scheduleEvaluationRefresh({
      hasEngine: true,
      previewMode: true,
      evaluationRefreshTimer: existingTimer,
      evaluationRunToken: 8,
      evaluationDebounceMs: 10,
      runRefresh: () => undefined
    });
    expect(previewMode.evaluationRefreshTimer).toBe(existingTimer);
    expect(previewMode.evaluationRunToken).toBe(8);

    clearTimeout(existingTimer);
  });

  it('schedules a new refresh run and increments token when active', () => {
    const runRefresh = jasmine.createSpy('runRefresh');
    const oldTimer = setTimeout(() => undefined, 1000);

    const result = ChessBoardEvaluationFacade.scheduleEvaluationRefresh({
      hasEngine: true,
      previewMode: false,
      evaluationRefreshTimer: oldTimer,
      evaluationRunToken: 2,
      evaluationDebounceMs: 1,
      runRefresh
    });

    expect(result.evaluationRunToken).toBe(3);
    expect(result.evaluationRefreshTimer).not.toBeNull();
    clearTimeout(result.evaluationRefreshTimer as any);
  });

  it('returns empty result on run-token mismatch in refreshSuggestedMoves', async () => {
    const result = await ChessBoardEvaluationFacade.refreshSuggestedMoves({
      runToken: 1,
      getCurrentRunToken: () => 2,
      fen: 'fen',
      getTopMoves: async () => [],
      suggestedMovesDepth: 10,
      suggestedMovesCount: 3,
      suggestedMovesCacheByFen: new Map<string, string[]>(),
      suggestionQualityByFen: new Map<string, Record<string, string>>(),
      suggestionEvalTextByFen: new Map<string, Record<string, string>>(),
      suggestedMovesLoadingPlaceholder: ['...'],      requestRender: () => undefined,
      formatEngineSuggestions: () => [],
      refreshSuggestionQualities: async () => undefined
    });
    expect(result.suggestedMoves).toEqual(['...']);
    expect(result.suggestionQualityByMove).toEqual({});
  });

  it('returns empty result on run-token mismatch in refreshSuggestionQualities', async () => {
    const result = await ChessBoardEvaluationFacade.refreshSuggestionQualities({
      runToken: 3,
      getCurrentRunToken: () => 4,
      fen: 'fen',
      engineTopMoves: [],
      formattedEngineSuggestions: [],
      getTopMoves: async () => [],
      suggestedMovesDepth: 10,
      suggestedMovesCount: 3,
      suggestionQualityByFen: new Map<string, Record<string, string>>(),
      suggestionEvalTextByFen: new Map<string, Record<string, string>>(),
      formatEngineSuggestions: () => [],
      buildDisplayToUciMap: () => new Map<string, string>(),
      evaluateUciMovesForQuality: async () => ({ pawnsByUci: new Map(), textByUci: new Map() }),
      turnColor: 0 as any,
      classifySuggestionLoss: () => '',
      requestRender: () => undefined
    });
    expect(result).toEqual({ suggestionQualityByMove: {}, suggestionEvalTextByMove: {} });
  });
});

