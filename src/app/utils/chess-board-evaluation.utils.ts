import { IGameplaySnapshot } from '../model/interfaces/chess-board-gameplay-snapshot.interface';
import { ChessBoardComponentUtils } from './chess-board-component.utils';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';
import { ChessBoardEvalConstants } from '../constants/chess.constants';
import { StockfishService } from '../services/stockfish.service';

export interface IEvaluationGetParams {
  halfMoveIndex: number;
  moveSnapshots: IGameplaySnapshot[];
  evalByHistoryIndex: Map<number, string>;
  evalCacheByFen: Map<string, string>;
  pendingEvalByHistoryIndex: Set<number>;
  evalErrorByHistoryIndex: Set<number>;
}

export interface IRefreshVisibleEvaluationsParams {
  runToken: number;
  getCurrentRunToken: () => number;
  visibleHistoryLength: number;
  moveSnapshots: IGameplaySnapshot[];
  evalByHistoryIndex: Map<number, string>;
  evalCacheByFen: Map<string, string>;
  pendingEvalByHistoryIndex: Set<number>;
  evalErrorByHistoryIndex: Set<number>;
  requestRender: () => void;
}

export class ChessBoardEvaluationUtils {
  static getEvaluationForMove(params: IEvaluationGetParams): string {
    const {
      halfMoveIndex,
      moveSnapshots,
      evalByHistoryIndex,
      evalCacheByFen,
      pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex
    } = params;

    if (halfMoveIndex < 0) {
      return ChessBoardEvalConstants.NA_PLACEHOLDER;
    }

    const fen = ChessBoardEvaluationUtils.getFenForHistoryIndex(halfMoveIndex, moveSnapshots);
    if (!fen) {
      return ChessBoardEvalConstants.NA_PLACEHOLDER;
    }

    const cachedByFen = evalCacheByFen.get(fen);
    if (cachedByFen) {
      evalByHistoryIndex.set(halfMoveIndex, cachedByFen);
      evalErrorByHistoryIndex.delete(halfMoveIndex);
      pendingEvalByHistoryIndex.delete(halfMoveIndex);
      return cachedByFen;
    }

    if (pendingEvalByHistoryIndex.has(halfMoveIndex)) {
      return ChessBoardEvalConstants.PENDING_EVALUATION_PLACEHOLDER;
    }
    if (evalErrorByHistoryIndex.has(halfMoveIndex)) {
      return ChessBoardEvalConstants.EVALUATION_ERROR_PLACEHOLDER;
    }

    const cachedByIndex = evalByHistoryIndex.get(halfMoveIndex);
    if (cachedByIndex) {
      return cachedByIndex;
    }
    return ChessBoardEvalConstants.PENDING_EVALUATION_PLACEHOLDER;
  }

  static getMoveQuality(
    halfMoveIndex: number,
    getEvaluationForMove: (halfMoveIndex: number) => string,
    analysisClampPawns: number
  ): { label: string; className: string } | null {
    const previousEvalText = getEvaluationForMove(halfMoveIndex - 1);
    const currentEvalText = getEvaluationForMove(halfMoveIndex);

    let previousEval = ChessBoardComponentUtils.parseEvaluationPawns(
      previousEvalText,
      analysisClampPawns
    );
    let currentEval = ChessBoardComponentUtils.parseEvaluationPawns(
      currentEvalText,
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

    // Treat converting mate-in-N into mate now as stronger than a neutral
    // "best" move so checkmating moves are surfaced as standout decisions.
    if (currentEvalText === '#0' && previousEval !== null) {
      const movedByWhite = (halfMoveIndex % 2) === 0;
      const deliveredMate =
        (movedByWhite && previousEval > 0) ||
        (!movedByWhite && previousEval < 0);
      if (deliveredMate) {
        return { label: 'great', className: 'history-quality--great' };
      }
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
      moveSnapshots,
      evalByHistoryIndex,
      evalCacheByFen,
      pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex,
      requestRender
    } = params;

    if (visibleHistoryLength < 1) {
      return;
    }

    for (let idx = 0; idx < visibleHistoryLength; idx++) {
      if (runToken !== getCurrentRunToken()) {
        return;
      }

      const fen = ChessBoardEvaluationUtils.getFenForHistoryIndex(idx, moveSnapshots);
      if (!fen) {
        evalByHistoryIndex.set(idx, ChessBoardEvalConstants.NA_PLACEHOLDER);
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
        const score = await StockfishService.evaluateFen(fen);
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
