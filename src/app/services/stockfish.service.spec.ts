import { StockfishService } from './stockfish.service';

class WorkerStub {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly postedCommands: string[] = [];
  terminated = false;
  private currentFen = '';
  emitReady = true;
  emitScoreLine = true;
  emitBestmove = true;
  scoreLine = 'info depth 12 score cp 47';
  private readonly uciDelayMs: number;
  private readonly readyDelayMs: number;
  private readonly moveDelayMs: number;

  constructor(options?: { uciDelayMs?: number; readyDelayMs?: number; moveDelayMs?: number }) {
    this.uciDelayMs = options && options.uciDelayMs !== undefined ? options.uciDelayMs : 0;
    this.readyDelayMs = options && options.readyDelayMs !== undefined ? options.readyDelayMs : 0;
    this.moveDelayMs = options && options.moveDelayMs !== undefined ? options.moveDelayMs : 0;
  }

  postMessage(command: string): void {
    this.postedCommands.push(command);
    if (command === 'uci') {
      setTimeout(() => this.emit('uciok'), this.uciDelayMs);
      return;
    }
    if (command === 'isready') {
      if (!this.emitReady) {
        return;
      }
      setTimeout(() => this.emit('readyok'), this.readyDelayMs);
      return;
    }
    if (command.startsWith('position fen ')) {
      this.currentFen = command.replace('position fen ', '');
      return;
    }
    if (command.startsWith('go ')) {
      setTimeout(() => {
        if (this.emitScoreLine) {
          if (this.currentFen.includes('matefen')) {
            this.emit('info depth 10 score mate -2');
          } else {
            this.emit(this.scoreLine);
          }
        }
        if (this.emitBestmove) {
          this.emit('bestmove e2e4');
        }
      }, this.moveDelayMs);
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  private emit(line: string): void {
    this.onmessage?.({ data: line } as MessageEvent<string>);
  }
}

const resetStockfishStaticState = () => {
  const stockfish = StockfishService as any;
  if (stockfish.worker) {
    try {
      stockfish.worker.terminate();
    } catch {
      // Ignore worker teardown errors in tests.
    }
  }
  stockfish.waiters.forEach((waiter: any) => clearTimeout(waiter.timeoutId));
  stockfish.worker = null;
  stockfish.initPromise = null;
  stockfish.ready = false;
  stockfish.waiters = [];
  stockfish.pendingEvaluation = null;
  stockfish.pendingTopMoves = null;
  stockfish.requestId = 0;
  stockfish.evalCacheByFen.clear();
  stockfish.topMovesCacheByFen.clear();
  stockfish.HANDSHAKE_TIMEOUT_MS = 8000;
};

const setupServiceWithWorkerStub = () => {
  resetStockfishStaticState();
  const worker = new WorkerStub();
  const createWorkerSpy = spyOn<any>(StockfishService as any, 'createWorker').and.returnValue(worker as unknown as Worker);
  return { worker, createWorkerSpy };
};

const evaluateFenWithCancellationRetry = async (fen: string, options?: { depth?: number; movetimeMs?: number }): Promise<string> => {
  try {
    return await StockfishService.evaluateFen(fen, options);
  } catch (error) {
    if (error instanceof Error && error.message === 'Evaluation cancelled') {
      return StockfishService.evaluateFen(fen, options);
    }
    throw error;
  }
};

describe('StockfishService evaluateFen', () => {
  let worker: WorkerStub;

  beforeEach(() => {
    ({ worker } = setupServiceWithWorkerStub());
  });

  afterEach(() => {
    resetStockfishStaticState();
  });

  it('completes handshake and parses cp score', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const score = await evaluateFenWithCancellationRetry(fen, { depth: 10 });

    expect(score).toBe('-0.47');
    expect(worker.postedCommands).toContain('uci');
    expect(worker.postedCommands).toContain('isready');
    expect(worker.postedCommands).toContain(`position fen ${fen}`);
    expect(worker.postedCommands).toContain('go depth 10');
  });

  it('parses mate score and reuses cache by fen', async () => {
    const fen = 'matefen w - - 0 1';
    const score1 = await evaluateFenWithCancellationRetry(fen, { movetimeMs: 80 });
    const score2 = await evaluateFenWithCancellationRetry(fen, { movetimeMs: 80 });

    expect(score1).toBe('#-2');
    expect(score2).toBe('#-2');
    const goCommands = worker.postedCommands.filter(command => command.startsWith('go '));
    expect(goCommands.length).toBe(1);
    expect(goCommands[0]).toBe('go movetime 80');
  });

  it('terminates worker safely', async () => {
    await (StockfishService as any).ensureReady();
    StockfishService.terminate();

    expect(worker.terminated).toBeTrue();
  });

  it('returns n/a for empty fen', async () => {
    const result = await StockfishService.evaluateFen('   ');
    expect(result).toBe('n/a');
  });

  it('normalizes undefined fen and defaults side-to-move parsing to white', async () => {
    const result = await (StockfishService as any).evaluateFen(undefined);
    expect(result).toBe('n/a');
    expect((StockfishService as any).getSideToMoveFromFen(undefined)).toBe('w');
    expect(await StockfishService.evaluateFenAfterMoves(undefined as any, ['e2e4'])).toBe('n/a');
    expect(await StockfishService.getTopMoves(undefined as any)).toEqual([]);
  });

  it('returns initPromise while handshake is in progress', async () => {
    const slowWorker = new WorkerStub({ uciDelayMs: 2, readyDelayMs: 2, moveDelayMs: 0 });
    ((StockfishService as any).createWorker as jasmine.Spy).and.returnValue(slowWorker as unknown as Worker);

    const p1 = (StockfishService as any).ensureReady();
    const p2 = (StockfishService as any).ensureReady();
    await Promise.all([p1, p2]);

    expect(slowWorker.postedCommands.filter(command => command === 'uci').length).toBe(1);
  });

  it('returns n/a when bestmove arrives before any score line', async () => {
    worker.emitScoreLine = false;
    const score = await evaluateFenWithCancellationRetry('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(score).toBe('n/a');
  });

  it('parses positive mate score with sign', async () => {
    worker.scoreLine = 'info depth 8 score mate 3';
    const score = await evaluateFenWithCancellationRetry('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(score).toBe('#+3');
  });

  it('inverts mate score for black to move', async () => {
    worker.scoreLine = 'info depth 8 score mate 3';
    const score = await evaluateFenWithCancellationRetry('8/8/8/8/8/8/8/8 b - - 0 1');
    expect(score).toBe('#-3');
  });

  it('parses non-score info as n/a', async () => {
    worker.scoreLine = 'info depth 8 pv e2e4 e7e5';
    const score = await evaluateFenWithCancellationRetry('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(score).toBe('n/a');
  });
});

describe('StockfishService evaluateFenAfterMoves and top moves', () => {
  let worker: WorkerStub;

  beforeEach(() => {
    ({ worker } = setupServiceWithWorkerStub());
  });

  afterEach(() => {
    resetStockfishStaticState();
  });

  it('evaluates fen after moves and caches by composite cache key', async () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    const score1 = await StockfishService.evaluateFenAfterMoves(fen, ['e2e4', '  E7E5  '], { depth: 9 });
    const score2 = await StockfishService.evaluateFenAfterMoves(fen, ['e2e4', 'e7e5'], { depth: 9 });

    expect(score1).toBe('+0.47');
    expect(score2).toBe('+0.47');
    expect(worker.postedCommands).toContain(`position fen ${fen} moves e2e4 e7e5`);
    expect(worker.postedCommands.filter(command => command.startsWith('go depth 9')).length).toBe(1);
  });

  it('falls back to evaluateFen from evaluateFenAfterMoves when no valid moves are provided', async () => {
    const fallbackSpy = spyOn<any>(StockfishService as any, 'evaluateFen').and.returnValue(Promise.resolve('+0.11'));
    const result = await StockfishService.evaluateFenAfterMoves('8/8/8/8/8/8/8/8 w - - 0 1', ['bad-move'], { depth: 5 });
    expect(result).toBe('+0.11');
    expect(fallbackSpy).toHaveBeenCalled();
  });

  it('returns n/a from evaluateFenAfterMoves when fen is empty', async () => {
    const result = await StockfishService.evaluateFenAfterMoves(' ', ['e2e4']);
    expect(result).toBe('n/a');
  });

  it('returns top moves using multipv and caches the result', async () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    worker.emitScoreLine = false;
    worker.emitBestmove = false;
    await (StockfishService as any).ensureReady();
    const pending = StockfishService.getTopMoves(fen, { depth: 7, multiPv: 2 });
    await Promise.resolve();
    (StockfishService as any).onWorkerMessage({ data: 'info depth 7 multipv 1 pv e2e4 e7e5' } as MessageEvent<string>);
    (StockfishService as any).onWorkerMessage({ data: 'info depth 7 multipv 2 pv d2d4 d7d5' } as MessageEvent<string>);
    (StockfishService as any).onWorkerMessage({ data: 'bestmove e2e4' } as MessageEvent<string>);
    const top1 = await pending;
    const top2 = await StockfishService.getTopMoves(fen, { depth: 7, multiPv: 2 });

    expect(top1).toEqual(['e2e4', 'd2d4']);
    expect(top2).toEqual(['e2e4', 'd2d4']);
    expect(worker.postedCommands).toContain('setoption name MultiPV value 2');
  });

  it('returns bestmove as fallback when top move pv lines are absent', async () => {
    const topMoves = await StockfishService.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { depth: 6, multiPv: 3 });
    expect(topMoves).toEqual(['e2e4']);
  });

  it('handles getTopMoves empty fen and clamps multipv', async () => {
    const empty = await StockfishService.getTopMoves('   ');
    expect(empty).toEqual([]);

    await StockfishService.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { multiPv: 99 });
    expect(worker.postedCommands).toContain('setoption name MultiPV value 8');
  });

  it('uses movetime when requesting top moves', async () => {
    await StockfishService.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { movetimeMs: 15 });
    expect(worker.postedCommands).toContain('go movetime 15');
  });

  it('rejects and clears an active top-moves request', async () => {
    worker.emitScoreLine = false;
    worker.emitBestmove = false;
    await (StockfishService as any).ensureReady();
    const pending = StockfishService.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { depth: 8, multiPv: 2 });
    await Promise.resolve();
    (StockfishService as any).rejectPendingTopMoves('cancelled');
    await expectAsync(pending).toBeRejectedWithError('cancelled');
  });
});

describe('StockfishService edge paths (errors/readiness)', () => {
  let worker: WorkerStub;
  let createWorkerSpy: jasmine.Spy;

  beforeEach(() => {
    ({ worker, createWorkerSpy } = setupServiceWithWorkerStub());
  });

  afterEach(() => {
    resetStockfishStaticState();
  });

  it('rejects when worker emits error', async () => {
    const pending = StockfishService.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    setTimeout(() => worker.onerror?.(new Event('error')), 0);
    await expectAsync(pending).toBeRejectedWithError('Stockfish worker error');
  });

  it('rejects with worker error detail and resets worker state', async () => {
    const pending = StockfishService.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    setTimeout(() => worker.onerror?.({ message: 'Uncaught RuntimeError: unreachable', preventDefault: () => undefined } as any), 0);
    await expectAsync(pending).toBeRejectedWithError(
      'Stockfish worker error: Uncaught RuntimeError: unreachable'
    );
    expect(worker.terminated).toBeTrue();
    expect((StockfishService as any).worker).toBeNull();
    expect((StockfishService as any).ready).toBeFalse();
  });

  it('rejects when worker emits message error', async () => {
    const pending = StockfishService.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    setTimeout(() => worker.onmessageerror?.({ preventDefault: () => undefined } as any), 0);
    await expectAsync(pending).toBeRejectedWithError('Stockfish worker message error');
  });

  it('re-initializes with a fresh worker after a worker runtime failure', async () => {
    const firstWorker = new WorkerStub();
    const secondWorker = new WorkerStub();
    createWorkerSpy.and.returnValues(firstWorker as unknown as Worker, secondWorker as unknown as Worker);

    const firstPending = StockfishService.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    setTimeout(() => firstWorker.onerror?.({ message: 'Uncaught RuntimeError: unreachable', preventDefault: () => undefined } as any), 0);
    await expectAsync(firstPending).toBeRejected();

    const secondResult = await evaluateFenWithCancellationRetry('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(secondResult).toBe('+0.47');
    expect(createWorkerSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects pending getTopMoves when worker emits error', async () => {
    const pending = StockfishService.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { multiPv: 2 });
    setTimeout(() => worker.onerror?.(new Event('error')), 0);
    await expectAsync(pending).toBeRejectedWithError('Stockfish worker error');
  });

  it('rejects handshake on timeout and resets init promise', async () => {
    worker.emitReady = false;
    (StockfishService as any).HANDSHAKE_TIMEOUT_MS = 5;
    await expectAsync(StockfishService.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1')).toBeRejectedWithError(
      'Timed out waiting for Stockfish response'
    );
    expect((StockfishService as any).initPromise).toBeNull();
  });

  it('cancels previous pending evaluation when a newer request starts', async () => {
    const delayedWorker = new WorkerStub({ moveDelayMs: 20 });
    createWorkerSpy.and.returnValue(delayedWorker as unknown as Worker);
    const first = StockfishService.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    const second = StockfishService.evaluateFen('8/8/8/8/8/8/8/8 b - - 0 1');
    await expectAsync(first).toBeRejectedWithError('Evaluation cancelled');
    await expectAsync(second).toBeResolvedTo('-0.47');
  });

  it('throws when posting without initialized worker', () => {
    expect(() => (StockfishService as any).post('uci')).toThrowError('Stockfish worker is not initialized');
  });

  it('throws postMessage failure and tears down broken worker', async () => {
    await (StockfishService as any).ensureReady();
    spyOn(worker, 'postMessage').and.callFake(() => {
      throw new Error('DataCloneError');
    });

    expect(() => (StockfishService as any).post('uci'))
      .toThrowError('Stockfish worker postMessage failed: DataCloneError');
    expect(worker.terminated).toBeTrue();
    expect((StockfishService as any).worker).toBeNull();
  });

  it('returns early from ensureReady when already ready with a worker', async () => {
    (StockfishService as any).worker = worker as unknown as Worker;
    (StockfishService as any).ready = true;
    await expectAsync((StockfishService as any).ensureReady()).toBeResolved();
  });

  it('rejects ensureReady when worker creation throws', async () => {
    createWorkerSpy.and.callFake(() => {
      throw new Error('create failed');
    });
    await expectAsync(StockfishService.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1')).toBeRejectedWithError('create failed');
  });
});

describe('StockfishService edge paths (helpers)', () => {
  let worker: WorkerStub;

  beforeEach(() => {
    ({ worker } = setupServiceWithWorkerStub());
  });

  afterEach(() => {
    resetStockfishStaticState();
  });

  it('ignores empty/non-string worker messages', async () => {
    await evaluateFenWithCancellationRetry('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(() => (StockfishService as any).onWorkerMessage({ data: null } as MessageEvent<string>)).not.toThrow();
    expect(() => (StockfishService as any).onWorkerMessage({ data: '   ' } as MessageEvent<string>)).not.toThrow();
  });

  it('covers resolveWaiters unresolved branch', () => {
    const waiter = {
      predicate: () => false,
      resolve: jasmine.createSpy('resolve'),
      reject: jasmine.createSpy('reject'),
      timeoutId: setTimeout(() => undefined, 1000)
    };
    (StockfishService as any).waiters = [waiter];
    (StockfishService as any).resolveWaiters('line');
    expect((StockfishService as any).waiters.length).toBe(1);
    clearTimeout(waiter.timeoutId);
  });

  it('covers cp NaN branch via Number.isNaN guard', () => {
    const originalIsNaN = Number.isNaN;
    spyOn(Number, 'isNaN').and.callFake((value: unknown) => (value === 47 ? true : originalIsNaN(value)));
    const result = (StockfishService as any).parseScoreFromInfoLine('info depth 8 score cp 47', '8/8/8/8/8/8/8/8 w - - 0 1');
    expect(result).toBeNull();
  });

  it('covers helper branches for parsing/collecting and parity transformations', () => {
    expect((StockfishService as any).parseTopMoveFromInfoLine('x')).toBeNull();
    expect((StockfishService as any).parseTopMoveFromInfoLine('info depth 5 multipv 0 pv e2e4')).toBeNull();
    expect((StockfishService as any).parseTopMoveFromInfoLine('info depth 5 multipv 1')).toBeNull();
    expect((StockfishService as any).parseTopMoveFromInfoLine('info depth 5 multipv 2 pv g1f3')).toEqual({ pv: 2, move: 'g1f3' });

    expect((StockfishService as any).collectTopMoves({
      maxMoves: 2,
      bestmove: 'a2a4',
      movesByPv: new Map<number, string>()
    })).toEqual(['a2a4']);

    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    expect((StockfishService as any).withAppliedMoveParity(fen, 0)).toBe(fen);
    expect((StockfishService as any).withAppliedMoveParity(fen, 1)).toContain(' b ');
    expect((StockfishService as any).withAppliedMoveParity('8/8/8/8/8/8/8/8 b - - 0 1', 1)).toContain(' w ');
    expect((StockfishService as any).withAppliedMoveParity(undefined, 1)).toBeUndefined();
    expect((StockfishService as any).withAppliedMoveParity('badfen', 1)).toBe('badfen');
  });

  it('normalizes undefined move tokens in evaluateFenAfterMoves', async () => {
    spyOn<any>(StockfishService as any, 'ensureReady').and.resolveTo();
    const runEvaluationSpy = spyOn<any>(StockfishService as any, 'runEvaluation').and.resolveTo('-0.47');
    const score = await StockfishService.evaluateFenAfterMoves('8/8/8/8/8/8/8/8 w - - 0 1', [undefined as any, 'e2e4'], { depth: 4 });
    expect(score).toBe('-0.47');
    expect(runEvaluationSpy).toHaveBeenCalled();
    expect(runEvaluationSpy.calls.mostRecent().args[3]).toContain('moves e2e4');
  });

  it('handles undefined move array in evaluateFenAfterMoves', async () => {
    const score = await StockfishService.evaluateFenAfterMoves('8/8/8/8/8/8/8/8 w - - 0 1', undefined as any, { depth: 4 });
    expect(score).toBe('+0.47');
  });

  it('covers rejectPendingTopMoves no-op and terminate with no worker', () => {
    expect(() => (StockfishService as any).rejectPendingTopMoves('x')).not.toThrow();
    (StockfishService as any).worker = null;
    expect(() => StockfishService.terminate()).not.toThrow();
  });

  it('covers worker-failure fallback message and post error fallback helper', () => {
    (StockfishService as any).worker = null;
    const failure = (StockfishService as any).handleWorkerFailure('   ');
    const undefinedFailure = (StockfishService as any).handleWorkerFailure(undefined);
    expect(failure.message).toBe('Stockfish worker error');
    expect(undefinedFailure.message).toBe('Stockfish worker error');
    expect((StockfishService as any).extractPostErrorMessage({})).toBe('Stockfish worker postMessage failed');
  });

  it('creates worker with stockfish asset path', () => {
    ((StockfishService as any).createWorker as jasmine.Spy).and.callThrough();
    const originalWorker = (window as any).Worker;
    const workerPaths: string[] = [];
    (window as any).Worker = function WorkerCtor(path: string): Worker {
      workerPaths.push(path);
      return worker as unknown as Worker;
    };
    try {
      const created = (StockfishService as any).createWorker();
      expect(created).toBe(worker as any);
      expect(workerPaths).toEqual(['assets/stockfish/stockfish.js']);
    } finally {
      (window as any).Worker = originalWorker;
    }
  });
});
