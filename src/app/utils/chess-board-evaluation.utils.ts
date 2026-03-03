import { IGameplaySnapshot } from '../model/interfaces/chess-board-gameplay-snapshot.interface';
import { ChessBoardComponentUtils } from './chess-board-component.utils';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';

export interface IEvaluationGetParams {
  halfMoveIndex: number;
  getFenForHistoryIndex: (halfMoveIndex: number) => string;
  evalByHistoryIndex: Map<number, string>;
  evalCacheByFen: Map<string, string>;
  pendingEvalByHistoryIndex: Set<number>;
  evalErrorByHistoryIndex: Set<number>;
  naPlaceholder: string;
  pendingEvaluationPlaceholder: string;
  evaluationErrorPlaceholder: string;
}

export interface IRefreshVisibleEvaluationsParams {
  runToken: number;
  getCurrentRunToken: () => number;
  visibleHistoryLength: number;
  getFenForHistoryIndex: (halfMoveIndex: number) => string;
  evaluateFen: (fen: string) => Promise<string>;
  evalByHistoryIndex: Map<number, string>;
  evalCacheByFen: Map<string, string>;
  pendingEvalByHistoryIndex: Set<number>;
  evalErrorByHistoryIndex: Set<number>;
  naPlaceholder: string;
  requestRender: () => void;
}

export class ChessBoardEvaluationUtils {
  static getEvaluationForMove(params: IEvaluationGetParams): string {
    const {
      halfMoveIndex,
      getFenForHistoryIndex,
      evalByHistoryIndex,
      evalCacheByFen,
      pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex,
      naPlaceholder,
      pendingEvaluationPlaceholder,
      evaluationErrorPlaceholder
    } = params;

    if (halfMoveIndex < 0) {
      return naPlaceholder;
    }

    const fen = getFenForHistoryIndex(halfMoveIndex);
    if (!fen) {
      return naPlaceholder;
    }

    const cachedByFen = evalCacheByFen.get(fen);
    if (cachedByFen) {
      evalByHistoryIndex.set(halfMoveIndex, cachedByFen);
      evalErrorByHistoryIndex.delete(halfMoveIndex);
      pendingEvalByHistoryIndex.delete(halfMoveIndex);
      return cachedByFen;
    }

    if (pendingEvalByHistoryIndex.has(halfMoveIndex)) {
      return pendingEvaluationPlaceholder;
    }
    if (evalErrorByHistoryIndex.has(halfMoveIndex)) {
      return evaluationErrorPlaceholder;
    }

    const cachedByIndex = evalByHistoryIndex.get(halfMoveIndex);
    if (cachedByIndex) {
      return cachedByIndex;
    }
    return pendingEvaluationPlaceholder;
  }

  static getMoveQuality(
    halfMoveIndex: number,
    getEvaluationForMove: (halfMoveIndex: number) => string,
    pendingEvaluationPlaceholder: string,
    evaluationErrorPlaceholder: string,
    naPlaceholder: string,
    analysisClampPawns: number
  ): { label: string; className: string } | null {
    const previousEvalText = getEvaluationForMove(halfMoveIndex - 1);
    const currentEvalText = getEvaluationForMove(halfMoveIndex);

    let previousEval = ChessBoardComponentUtils.parseEvaluationPawns(
      previousEvalText,
      pendingEvaluationPlaceholder,
      evaluationErrorPlaceholder,
      naPlaceholder,
      analysisClampPawns
    );
    let currentEval = ChessBoardComponentUtils.parseEvaluationPawns(
      currentEvalText,
      pendingEvaluationPlaceholder,
      evaluationErrorPlaceholder,
      naPlaceholder,
      analysisClampPawns
    );

    // Some engines can emit mate-zero as "#0" without explicit sign.
    // Preserve mate direction from adjacent explicit mate scores so the
    // quality classifier does not invert (e.g. "#-1" -> "#0").
    if (currentEvalText === '#0' && previousEval !== null) {
      currentEval = previousEval > 0 ? analysisClampPawns : -analysisClampPawns;
    }
    if (previousEvalText === '#0' && currentEval !== null) {
      previousEval = currentEval > 0 ? analysisClampPawns : -analysisClampPawns;
    }

    return ChessBoardComponentUtils.getMoveQuality(halfMoveIndex, previousEval, currentEval);
  }

  static getFenForHistoryIndex(halfMoveIndex: number, moveSnapshots: IGameplaySnapshot[]): string {
    if (halfMoveIndex < 0) {
      return '';
    }
    const snapshotIndex = halfMoveIndex + 1;
    if (snapshotIndex < 0 || snapshotIndex >= moveSnapshots.length) {
      return '';
    }
    return ChessBoardLogicUtils.generateFenFromSnapshot(moveSnapshots[snapshotIndex]);
  }

  static async refreshVisibleHistoryEvaluations(params: IRefreshVisibleEvaluationsParams): Promise<void> {
    const {
      runToken,
      getCurrentRunToken,
      visibleHistoryLength,
      getFenForHistoryIndex,
      evaluateFen,
      evalByHistoryIndex,
      evalCacheByFen,
      pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex,
      naPlaceholder,
      requestRender
    } = params;

    if (visibleHistoryLength < 1) {
      return;
    }

    for (let idx = 0; idx < visibleHistoryLength; idx++) {
      if (runToken !== getCurrentRunToken()) {
        return;
      }

      const fen = getFenForHistoryIndex(idx);
      if (!fen) {
        evalByHistoryIndex.set(idx, naPlaceholder);
        pendingEvalByHistoryIndex.delete(idx);
        evalErrorByHistoryIndex.delete(idx);
        continue;
      }

      const cachedScore = evalCacheByFen.get(fen);
      if (cachedScore) {
        evalByHistoryIndex.set(idx, cachedScore);
        pendingEvalByHistoryIndex.delete(idx);
        evalErrorByHistoryIndex.delete(idx);
        continue;
      }

      pendingEvalByHistoryIndex.add(idx);
      evalErrorByHistoryIndex.delete(idx);
      requestRender();

      try {
        const score = await evaluateFen(fen);
        if (runToken !== getCurrentRunToken()) {
          return;
        }
        evalCacheByFen.set(fen, score);
        evalByHistoryIndex.set(idx, score);
      } catch {
        if (runToken !== getCurrentRunToken()) {
          return;
        }
        evalErrorByHistoryIndex.add(idx);
      } finally {
        if (runToken === getCurrentRunToken()) {
          pendingEvalByHistoryIndex.delete(idx);
          requestRender();
        }
      }
    }
  }
}
