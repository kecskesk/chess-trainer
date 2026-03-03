import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardEvaluationUtils } from './chess-board-evaluation.utils';
import { ISuggestionEvaluationResult } from './chess-board-suggestion.facade';

export interface IResetEvaluationStateParams {
  evalByHistoryIndex: Map<number, string>;
  pendingEvalByHistoryIndex: Set<number>;
  evalErrorByHistoryIndex: Set<number>;
  evalCacheByFen: Map<string, string>;
  suggestedMovesCacheByFen: Map<string, string[]>;
  suggestionQualityByFen: Map<string, Record<string, string>>;
  suggestionEvalTextByFen: Map<string, Record<string, string>>;
  suggestedMovesLoadingPlaceholder: string[];
  evaluationRefreshTimer: ReturnType<typeof setTimeout> | null;
  evaluationRunToken: number;
}

export interface IResetEvaluationStateResult {
  evaluationRefreshTimer: ReturnType<typeof setTimeout> | null;
  evaluationRunToken: number;
  suggestedMoves: string[];
  suggestionQualityByMove: Record<string, string>;
  suggestionEvalTextByMove: Record<string, string>;
}

export interface IScheduleEvaluationRefreshParams {
  hasEngine: boolean;
  previewMode: boolean;
  evaluationRefreshTimer: ReturnType<typeof setTimeout> | null;
  evaluationRunToken: number;
  evaluationDebounceMs: number;
  runRefresh: (runToken: number) => void;
}

export interface IScheduleEvaluationRefreshResult {
  evaluationRefreshTimer: ReturnType<typeof setTimeout> | null;
  evaluationRunToken: number;
}

export interface IRefreshVisibleHistoryEvaluationsParams {
  runToken: number;
  getCurrentRunToken: () => number;
  visibleHistoryLength: number;
  getFenForHistoryIndex: (idx: number) => string;
  evaluateFen: (fen: string) => Promise<string>;
  evalByHistoryIndex: Map<number, string>;
  evalCacheByFen: Map<string, string>;
  pendingEvalByHistoryIndex: Set<number>;
  evalErrorByHistoryIndex: Set<number>;
  naPlaceholder: string;
  requestRender: () => void;
  onRefreshSuggestedMoves: () => Promise<void>;
}

export interface IRefreshSuggestedMovesParams {
  runToken: number;
  getCurrentRunToken: () => number;
  fen: string;
  getTopMoves: (fen: string, options: { depth: number; multiPv: number }) => Promise<string[]>;
  suggestedMovesDepth: number;
  suggestedMovesCount: number;
  suggestedMovesCacheByFen: Map<string, string[]>;
  suggestionQualityByFen: Map<string, Record<string, string>>;
  suggestionEvalTextByFen: Map<string, Record<string, string>>;
  suggestedMovesLoadingPlaceholder: string[];
  naPlaceholder: string;
  requestRender: () => void;
  formatEngineSuggestions: (uciMoves: string[]) => string[];
  refreshSuggestionQualities: (runToken: number, fen: string, engineTopMoves?: string[], formattedEngineSuggestions?: string[]) => Promise<void>;
}

export interface IRefreshSuggestedMovesResult {
  suggestedMoves: string[];
  suggestionQualityByMove: Record<string, string>;
  suggestionEvalTextByMove: Record<string, string>;
}

export interface IRefreshSuggestionQualitiesParams {
  runToken: number;
  getCurrentRunToken: () => number;
  fen: string;
  engineTopMoves: string[];
  formattedEngineSuggestions: string[];
  getTopMoves: (fen: string, options: { depth: number; multiPv: number }) => Promise<string[]>;
  suggestedMovesDepth: number;
  suggestedMovesCount: number;
  suggestionQualityByFen: Map<string, Record<string, string>>;
  suggestionEvalTextByFen: Map<string, Record<string, string>>;
  formatEngineSuggestions: (uciMoves: string[]) => string[];
  buildDisplayToUciMap: (topMovesUci: string[], topMovesDisplay: string[]) => Map<string, string>;
  evaluateUciMovesForQuality: (runToken: number, fen: string, uniqueUciMoves: string[]) => Promise<ISuggestionEvaluationResult>;
  turnColor: ChessColorsEnum;
  classifySuggestionLoss: (loss: number) => string;
  requestRender: () => void;
}

export interface IRefreshSuggestionQualitiesResult {
  suggestionQualityByMove: Record<string, string>;
  suggestionEvalTextByMove: Record<string, string>;
}

export class ChessBoardEvaluationFacade {
  static resetEvaluationState(params: IResetEvaluationStateParams): IResetEvaluationStateResult {
    params.evalByHistoryIndex.clear();
    params.pendingEvalByHistoryIndex.clear();
    params.evalErrorByHistoryIndex.clear();
    params.evalCacheByFen.clear();
    params.suggestedMovesCacheByFen.clear();
    params.suggestionQualityByFen.clear();
    params.suggestionEvalTextByFen.clear();
    if (params.evaluationRefreshTimer !== null) {
      clearTimeout(params.evaluationRefreshTimer);
    }
    return {
      evaluationRefreshTimer: null,
      evaluationRunToken: params.evaluationRunToken + 1,
      suggestedMoves: [...params.suggestedMovesLoadingPlaceholder],
      suggestionQualityByMove: {},
      suggestionEvalTextByMove: {}
    };
  }

  static scheduleEvaluationRefresh(params: IScheduleEvaluationRefreshParams): IScheduleEvaluationRefreshResult {
    if (!params.hasEngine || params.previewMode) {
      return {
        evaluationRefreshTimer: params.evaluationRefreshTimer,
        evaluationRunToken: params.evaluationRunToken
      };
    }
    if (params.evaluationRefreshTimer !== null) {
      clearTimeout(params.evaluationRefreshTimer);
    }
    const runToken = params.evaluationRunToken + 1;
    const timer = setTimeout(() => {
      params.runRefresh(runToken);
    }, params.evaluationDebounceMs);
    return {
      evaluationRefreshTimer: timer,
      evaluationRunToken: runToken
    };
  }

  static async refreshVisibleHistoryEvaluations(params: IRefreshVisibleHistoryEvaluationsParams): Promise<void> {
    await ChessBoardEvaluationUtils.refreshVisibleHistoryEvaluations({
      runToken: params.runToken,
      getCurrentRunToken: params.getCurrentRunToken,
      visibleHistoryLength: params.visibleHistoryLength,
      getFenForHistoryIndex: params.getFenForHistoryIndex,
      evaluateFen: params.evaluateFen,
      evalByHistoryIndex: params.evalByHistoryIndex,
      evalCacheByFen: params.evalCacheByFen,
      pendingEvalByHistoryIndex: params.pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex: params.evalErrorByHistoryIndex,
      naPlaceholder: params.naPlaceholder,
      requestRender: params.requestRender
    });
    await params.onRefreshSuggestedMoves();
  }

  static async refreshSuggestedMoves(params: IRefreshSuggestedMovesParams): Promise<IRefreshSuggestedMovesResult> {
    const emptyResult = {
      suggestedMoves: [...params.suggestedMovesLoadingPlaceholder],
      suggestionQualityByMove: {},
      suggestionEvalTextByMove: {}
    };
    if (params.runToken !== params.getCurrentRunToken()) {
      return emptyResult;
    }
    const cachedSuggestions = params.suggestedMovesCacheByFen.get(params.fen);
    if (cachedSuggestions) {
      const cachedQuality = params.suggestionQualityByFen.get(params.fen);
      const cachedEvalText = params.suggestionEvalTextByFen.get(params.fen);
      params.requestRender();
      if (!cachedQuality || !cachedEvalText) {
        await params.refreshSuggestionQualities(params.runToken, params.fen);
      }
      return {
        suggestedMoves: [...cachedSuggestions],
        suggestionQualityByMove: cachedQuality ? { ...cachedQuality } : {},
        suggestionEvalTextByMove: cachedEvalText ? { ...cachedEvalText } : {}
      };
    }

    params.requestRender();
    try {
      const engineTopMoves = await params.getTopMoves(params.fen, {
        depth: params.suggestedMovesDepth,
        multiPv: params.suggestedMovesCount
      });
      if (params.runToken !== params.getCurrentRunToken()) {
        return emptyResult;
      }
      const formattedSuggestions = params.formatEngineSuggestions(engineTopMoves);
      const resolvedSuggestions = formattedSuggestions.length > 0
        ? formattedSuggestions
        : [params.naPlaceholder];
      params.suggestedMovesCacheByFen.set(params.fen, resolvedSuggestions);
      await params.refreshSuggestionQualities(params.runToken, params.fen, engineTopMoves, formattedSuggestions);
      params.requestRender();
      return {
        suggestedMoves: [...resolvedSuggestions],
        suggestionQualityByMove: {},
        suggestionEvalTextByMove: {}
      };
    } catch {
      if (params.runToken !== params.getCurrentRunToken()) {
        return emptyResult;
      }
      params.requestRender();
      return {
        suggestedMoves: [params.naPlaceholder],
        suggestionQualityByMove: {},
        suggestionEvalTextByMove: {}
      };
    }
  }

  static async refreshSuggestionQualities(params: IRefreshSuggestionQualitiesParams): Promise<IRefreshSuggestionQualitiesResult> {
    if (params.runToken !== params.getCurrentRunToken()) {
      return { suggestionQualityByMove: {}, suggestionEvalTextByMove: {} };
    }

    const cachedQuality = params.suggestionQualityByFen.get(params.fen);
    const cachedEvalText = params.suggestionEvalTextByFen.get(params.fen);
    if (cachedQuality && cachedEvalText) {
      params.requestRender();
      return {
        suggestionQualityByMove: { ...cachedQuality },
        suggestionEvalTextByMove: { ...cachedEvalText }
      };
    }

    let topMovesUci = params.engineTopMoves;
    if (topMovesUci.length < 1) {
      topMovesUci = await params.getTopMoves(params.fen, {
        depth: params.suggestedMovesDepth,
        multiPv: params.suggestedMovesCount
      });
    }
    if (params.runToken !== params.getCurrentRunToken()) {
      return { suggestionQualityByMove: {}, suggestionEvalTextByMove: {} };
    }

    const topMovesDisplay = params.formattedEngineSuggestions.length > 0
      ? params.formattedEngineSuggestions
      : params.formatEngineSuggestions(topMovesUci);

    const displayToUci = params.buildDisplayToUciMap(topMovesUci, topMovesDisplay);
    const uniqueUciMoves = Array.from(new Set(Array.from(displayToUci.values())));
    if (uniqueUciMoves.length < 1) {
      params.suggestionQualityByFen.set(params.fen, {});
      params.suggestionEvalTextByFen.set(params.fen, {});
      params.requestRender();
      return { suggestionQualityByMove: {}, suggestionEvalTextByMove: {} };
    }

    const evaluationResult = await params.evaluateUciMovesForQuality(params.runToken, params.fen, uniqueUciMoves);
    const evalByUci = evaluationResult.pawnsByUci;
    const evalTextByUci = evaluationResult.textByUci;
    if (evalByUci.size < 1) {
      params.suggestionQualityByFen.set(params.fen, {});
      params.suggestionEvalTextByFen.set(params.fen, {});
      params.requestRender();
      return { suggestionQualityByMove: {}, suggestionEvalTextByMove: {} };
    }

    const evalValues = Array.from(evalByUci.values());
    const bestEval = params.turnColor === ChessColorsEnum.White
      ? Math.max(...evalValues)
      : Math.min(...evalValues);

    const qualityByMove: Record<string, string> = {};
    const evalTextByMove: Record<string, string> = {};
    displayToUci.forEach((uciMove, displayMove) => {
      const moveEval = evalByUci.get(uciMove);
      if (moveEval === undefined) {
        return;
      }
      const loss = params.turnColor === ChessColorsEnum.White
        ? (bestEval - moveEval)
        : (moveEval - bestEval);
      qualityByMove[displayMove] = params.classifySuggestionLoss(loss);
      const evalText = evalTextByUci.get(uciMove);
      if (evalText) {
        evalTextByMove[displayMove] = evalText;
      }
    });

    params.suggestionQualityByFen.set(params.fen, qualityByMove);
    params.suggestionEvalTextByFen.set(params.fen, evalTextByMove);
    params.requestRender();
    return {
      suggestionQualityByMove: { ...qualityByMove },
      suggestionEvalTextByMove: { ...evalTextByMove }
    };
  }
}
