import { ChessBoardEvaluationFacade } from './chess-board-evaluation.facade';

describe('ChessBoardEvaluationFacade', () => {
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
      suggestedMovesLoadingPlaceholder: ['...'],
      naPlaceholder: 'n/a',
      requestRender: () => undefined,
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
