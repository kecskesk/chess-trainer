import { ChessBoardEvaluationUtils } from './chess-board-evaluation.utils';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';

describe('ChessBoardEvaluationUtils', () => {
  it('returns fen for valid snapshot index and empty string for invalid index', () => {
    const snapshots: any[] = [{}, { id: 1 }, { id: 2 }];
    const fenSpy = spyOn(ChessBoardLogicUtils, 'generateFenFromSnapshot').and.returnValue('test-fen');

    expect(ChessBoardEvaluationUtils.getFenForHistoryIndex(-1, snapshots as any)).toBe('');
    expect(ChessBoardEvaluationUtils.getFenForHistoryIndex(99, snapshots as any)).toBe('');
    expect(ChessBoardEvaluationUtils.getFenForHistoryIndex(0, snapshots as any)).toBe('test-fen');
    expect(fenSpy).toHaveBeenCalledWith(snapshots[1] as any);
  });

  it('resolves evaluation text from fen cache and pending/error states', () => {
    const evalByHistoryIndex = new Map<number, string>();
    const evalCacheByFen = new Map<string, string>([['fen-1', '+0.42']]);
    const pendingEvalByHistoryIndex = new Set<number>([2]);
    const evalErrorByHistoryIndex = new Set<number>([3]);

    const fromFenCache = ChessBoardEvaluationUtils.getEvaluationForMove({
      halfMoveIndex: 1,
      getFenForHistoryIndex: () => 'fen-1',
      evalByHistoryIndex,
      evalCacheByFen,
      pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex,
      naPlaceholder: 'n/a',
      pendingEvaluationPlaceholder: '...',
      evaluationErrorPlaceholder: 'err'
    });
    expect(fromFenCache).toBe('+0.42');
    expect(evalByHistoryIndex.get(1)).toBe('+0.42');

    const pending = ChessBoardEvaluationUtils.getEvaluationForMove({
      halfMoveIndex: 2,
      getFenForHistoryIndex: () => 'fen-2',
      evalByHistoryIndex,
      evalCacheByFen,
      pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex,
      naPlaceholder: 'n/a',
      pendingEvaluationPlaceholder: '...',
      evaluationErrorPlaceholder: 'err'
    });
    expect(pending).toBe('...');

    const error = ChessBoardEvaluationUtils.getEvaluationForMove({
      halfMoveIndex: 3,
      getFenForHistoryIndex: () => 'fen-3',
      evalByHistoryIndex,
      evalCacheByFen,
      pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex,
      naPlaceholder: 'n/a',
      pendingEvaluationPlaceholder: '...',
      evaluationErrorPlaceholder: 'err'
    });
    expect(error).toBe('err');
  });

  it('calculates move quality from adjacent evaluations', () => {
    const quality = ChessBoardEvaluationUtils.getMoveQuality(
      2,
      (idx) => (idx === 1 ? '+0.10' : '+3.20'),
      '...',
      'err',
      'n/a',
      10
    );

    expect(quality).not.toBeNull();
    expect(quality?.label).toBe('genius');
  });

  it('does not misclassify mate-zero continuation as blunder when sign is implicit', () => {
    const quality = ChessBoardEvaluationUtils.getMoveQuality(
      3,
      (idx) => {
        if (idx === 2) {
          return '#-1';
        }
        if (idx === 3) {
          return '#0';
        }
        return 'n/a';
      },
      '...',
      'err',
      'n/a',
      10
    );

    expect(quality).toBeNull();
  });
});

describe('ChessBoardEvaluationUtils async evaluation refresh', () => {
  it('refreshes visible history evaluations and updates caches', async () => {
    const evalByHistoryIndex = new Map<number, string>();
    const evalCacheByFen = new Map<string, string>([['fen-cached', '+0.20']]);
    const pendingEvalByHistoryIndex = new Set<number>();
    const evalErrorByHistoryIndex = new Set<number>();
    const renderSpy = jasmine.createSpy('render');

    const evaluateFenSpy = jasmine.createSpy('evaluateFen').and.callFake(async (fen: string) => {
      if (fen === 'fen-error') {
        throw new Error('boom');
      }
      return '+0.80';
    });

    await ChessBoardEvaluationUtils.refreshVisibleHistoryEvaluations({
      runToken: 5,
      getCurrentRunToken: () => 5,
      visibleHistoryLength: 3,
      getFenForHistoryIndex: (idx) => {
        if (idx === 0) {
          return 'fen-cached';
        }
        if (idx === 1) {
          return 'fen-new';
        }
        return 'fen-error';
      },
      evaluateFen: evaluateFenSpy,
      evalByHistoryIndex,
      evalCacheByFen,
      pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex,
      naPlaceholder: 'n/a',
      requestRender: renderSpy
    });

    expect(evalByHistoryIndex.get(0)).toBe('+0.20');
    expect(evalByHistoryIndex.get(1)).toBe('+0.80');
    expect(evalCacheByFen.get('fen-new')).toBe('+0.80');
    expect(evalErrorByHistoryIndex.has(2)).toBeTrue();
    expect(pendingEvalByHistoryIndex.size).toBe(0);
    expect(renderSpy).toHaveBeenCalled();
  });
});
