import { StockfishService } from './stockfish.service';

class WorkerMock {
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

const setupServiceWithMockWorker = () => {
  (StockfishService as any).HANDSHAKE_TIMEOUT_MS = 8000;
  const service = new StockfishService();
  const worker = new WorkerMock();
  spyOn<any>(service, 'createWorker').and.returnValue(worker as unknown as Worker);
  return { service, worker };
};

describe('StockfishService evaluateFen', () => {
  let service: StockfishService;
  let worker: WorkerMock;

  beforeEach(() => {
    ({ service, worker } = setupServiceWithMockWorker());
  });

  it('completes handshake and parses cp score', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const score = await service.evaluateFen(fen, { depth: 10 });

    expect(score).toBe('-0.47');
    expect(worker.postedCommands).toContain('uci');
    expect(worker.postedCommands).toContain('isready');
    expect(worker.postedCommands).toContain(`position fen ${fen}`);
    expect(worker.postedCommands).toContain('go depth 10');
  });

  it('parses mate score and reuses cache by fen', async () => {
    const fen = 'matefen w - - 0 1';
    const score1 = await service.evaluateFen(fen, { movetimeMs: 80 });
    const score2 = await service.evaluateFen(fen, { movetimeMs: 80 });

    expect(score1).toBe('#-2');
    expect(score2).toBe('#-2');
    const goCommands = worker.postedCommands.filter(command => command.startsWith('go '));
    expect(goCommands.length).toBe(1);
    expect(goCommands[0]).toBe('go movetime 80');
  });

  it('terminates worker safely', async () => {
    await service.evaluateFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');
    service.terminate();

    expect(worker.terminated).toBeTrue();
  });

  it('returns n/a for empty fen', async () => {
    const result = await service.evaluateFen('   ');
    expect(result).toBe('n/a');
  });

  it('normalizes undefined fen and defaults side-to-move parsing to white', async () => {
    const result = await (service as any).evaluateFen(undefined);
    expect(result).toBe('n/a');
    expect((service as any).getSideToMoveFromFen(undefined)).toBe('w');
    expect(await service.evaluateFenAfterMoves(undefined as any, ['e2e4'])).toBe('n/a');
    expect(await service.getTopMoves(undefined as any)).toEqual([]);
  });

  it('returns initPromise while handshake is in progress', async () => {
    const slowWorker = new WorkerMock({ uciDelayMs: 2, readyDelayMs: 2, moveDelayMs: 0 });
    (service as any).createWorker.and.returnValue(slowWorker as unknown as Worker);

    const p1 = (service as any).ensureReady();
    const p2 = (service as any).ensureReady();
    await Promise.all([p1, p2]);

    expect(slowWorker.postedCommands.filter(command => command === 'uci').length).toBe(1);
  });

  it('returns n/a when bestmove arrives before any score line', async () => {
    worker.emitScoreLine = false;
    const score = await service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(score).toBe('n/a');
  });

  it('parses positive mate score with sign', async () => {
    worker.scoreLine = 'info depth 8 score mate 3';
    const score = await service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(score).toBe('#+3');
  });

  it('inverts mate score for black to move', async () => {
    worker.scoreLine = 'info depth 8 score mate 3';
    const score = await service.evaluateFen('8/8/8/8/8/8/8/8 b - - 0 1');
    expect(score).toBe('#-3');
  });

  it('parses non-score info as n/a', async () => {
    worker.scoreLine = 'info depth 8 pv e2e4 e7e5';
    const score = await service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(score).toBe('n/a');
  });

});

describe('StockfishService evaluateFenAfterMoves and top moves', () => {
  let service: StockfishService;
  let worker: WorkerMock;

  beforeEach(() => {
    ({ service, worker } = setupServiceWithMockWorker());
  });

  it('evaluates fen after moves and caches by composite cache key', async () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    const score1 = await service.evaluateFenAfterMoves(fen, ['e2e4', '  E7E5  '], { depth: 9 });
    const score2 = await service.evaluateFenAfterMoves(fen, ['e2e4', 'e7e5'], { depth: 9 });

    expect(score1).toBe('+0.47');
    expect(score2).toBe('+0.47');
    expect(worker.postedCommands).toContain(`position fen ${fen} moves e2e4 e7e5`);
    expect(worker.postedCommands.filter(command => command.startsWith('go depth 9')).length).toBe(1);
  });

  it('falls back to evaluateFen from evaluateFenAfterMoves when no valid moves are provided', async () => {
    const fallbackSpy = spyOn(service, 'evaluateFen').and.returnValue(Promise.resolve('+0.11'));
    const result = await service.evaluateFenAfterMoves('8/8/8/8/8/8/8/8 w - - 0 1', ['bad-move'], { depth: 5 });
    expect(result).toBe('+0.11');
    expect(fallbackSpy).toHaveBeenCalled();
  });

  it('returns n/a from evaluateFenAfterMoves when fen is empty', async () => {
    const result = await service.evaluateFenAfterMoves(' ', ['e2e4']);
    expect(result).toBe('n/a');
  });

  it('returns top moves using multipv and caches the result', async () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    worker.emitScoreLine = false;
    worker.emitBestmove = false;
    await (service as any).ensureReady();
    const pending = service.getTopMoves(fen, { depth: 7, multiPv: 2 });
    await Promise.resolve();
    (service as any).onWorkerMessage({ data: 'info depth 7 multipv 1 pv e2e4 e7e5' } as MessageEvent<string>);
    (service as any).onWorkerMessage({ data: 'info depth 7 multipv 2 pv d2d4 d7d5' } as MessageEvent<string>);
    (service as any).onWorkerMessage({ data: 'bestmove e2e4' } as MessageEvent<string>);
    const top1 = await pending;
    const top2 = await service.getTopMoves(fen, { depth: 7, multiPv: 2 });

    expect(top1).toEqual(['e2e4', 'd2d4']);
    expect(top2).toEqual(['e2e4', 'd2d4']);
    expect(worker.postedCommands).toContain('setoption name MultiPV value 2');
  });

  it('returns bestmove as fallback when top move pv lines are absent', async () => {
    const topMoves = await service.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { depth: 6, multiPv: 3 });
    expect(topMoves).toEqual(['e2e4']);
  });

  it('handles getTopMoves empty fen and clamps multipv', async () => {
    const empty = await service.getTopMoves('   ');
    expect(empty).toEqual([]);

    await service.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { multiPv: 99 });
    expect(worker.postedCommands).toContain('setoption name MultiPV value 8');
  });

  it('uses movetime when requesting top moves', async () => {
    await service.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { movetimeMs: 15 });
    expect(worker.postedCommands).toContain('go movetime 15');
  });

  it('rejects and clears an active top-moves request', async () => {
    worker.emitScoreLine = false;
    worker.emitBestmove = false;
    await (service as any).ensureReady();
    const pending = service.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { depth: 8, multiPv: 2 });
    await Promise.resolve();
    (service as any).rejectPendingTopMoves('cancelled');
    await expectAsync(pending).toBeRejectedWithError('cancelled');
  });
});

describe('StockfishService edge paths (errors/readiness)', () => {
  let service: StockfishService;
  let worker: WorkerMock;

  beforeEach(() => {
    ({ service, worker } = setupServiceWithMockWorker());
  });

  it('rejects when worker emits error', async () => {
    const pending = service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    setTimeout(() => worker.onerror?.(new Event('error')), 0);
    await expectAsync(pending).toBeRejectedWithError('Stockfish worker error');
  });

  it('rejects with worker error detail and resets worker state', async () => {
    const pending = service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    setTimeout(() => worker.onerror?.({ message: 'Uncaught RuntimeError: unreachable', preventDefault: () => undefined } as any), 0);
    await expectAsync(pending).toBeRejectedWithError(
      'Stockfish worker error: Uncaught RuntimeError: unreachable'
    );
    expect(worker.terminated).toBeTrue();
    expect((service as any).worker).toBeNull();
    expect((service as any).ready).toBeFalse();
  });

  it('rejects when worker emits message error', async () => {
    const pending = service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    setTimeout(() => worker.onmessageerror?.({ preventDefault: () => undefined } as any), 0);
    await expectAsync(pending).toBeRejectedWithError('Stockfish worker message error');
  });

  it('re-initializes with a fresh worker after a worker runtime failure', async () => {
    const firstWorker = new WorkerMock();
    const secondWorker = new WorkerMock();
    const createWorkerSpy = (service as any).createWorker as jasmine.Spy;
    createWorkerSpy.and.returnValues(firstWorker as unknown as Worker, secondWorker as unknown as Worker);

    const firstPending = service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    setTimeout(() => firstWorker.onerror?.({ message: 'Uncaught RuntimeError: unreachable', preventDefault: () => undefined } as any), 0);
    await expectAsync(firstPending).toBeRejected();

    const secondResult = await service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(secondResult).toBe('+0.47');
    expect(createWorkerSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects pending getTopMoves when worker emits error', async () => {
    const pending = service.getTopMoves('8/8/8/8/8/8/8/8 w - - 0 1', { multiPv: 2 });
    setTimeout(() => worker.onerror?.(new Event('error')), 0);
    await expectAsync(pending).toBeRejectedWithError('Stockfish worker error');
  });

  it('rejects handshake on timeout and resets init promise', async () => {
    worker.emitReady = false;
    (StockfishService as any).HANDSHAKE_TIMEOUT_MS = 5;
    await expectAsync(service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1')).toBeRejectedWithError(
      'Timed out waiting for Stockfish response'
    );
    expect((service as any).initPromise).toBeNull();
  });

  it('cancels previous pending evaluation when a newer request starts', async () => {
    const delayedWorker = new WorkerMock({ moveDelayMs: 20 });
    (service as any).createWorker.and.returnValue(delayedWorker as unknown as Worker);
    const first = service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    const second = service.evaluateFen('8/8/8/8/8/8/8/8 b - - 0 1');
    await expectAsync(first).toBeRejectedWithError('Evaluation cancelled');
    await expectAsync(second).toBeResolvedTo('-0.47');
  });

  it('throws when posting without initialized worker', () => {
    expect(() => (service as any).post('uci')).toThrowError('Stockfish worker is not initialized');
  });

  it('throws postMessage failure and tears down broken worker', async () => {
    await (service as any).ensureReady();
    spyOn(worker, 'postMessage').and.callFake(() => {
      throw new Error('DataCloneError');
    });

    expect(() => (service as any).post('uci'))
      .toThrowError('Stockfish worker postMessage failed: DataCloneError');
    expect(worker.terminated).toBeTrue();
    expect((service as any).worker).toBeNull();
  });

  it('returns early from ensureReady when already ready with a worker', async () => {
    (service as any).worker = worker as unknown as Worker;
    (service as any).ready = true;
    await expectAsync((service as any).ensureReady()).toBeResolved();
  });

  it('rejects ensureReady when worker creation throws', async () => {
    (service as any).createWorker.and.callFake(() => {
      throw new Error('create failed');
    });
    await expectAsync(service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1')).toBeRejectedWithError('create failed');
  });
});

describe('StockfishService edge paths (helpers)', () => {
  let service: StockfishService;
  let worker: WorkerMock;

  beforeEach(() => {
    ({ service, worker } = setupServiceWithMockWorker());
  });

  it('ignores empty/non-string worker messages', async () => {
    await service.evaluateFen('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(() => (service as any).onWorkerMessage({ data: null } as MessageEvent<string>)).not.toThrow();
    expect(() => (service as any).onWorkerMessage({ data: '   ' } as MessageEvent<string>)).not.toThrow();
  });

  it('covers resolveWaiters unresolved branch', () => {
    const waiter = {
      predicate: () => false,
      resolve: jasmine.createSpy('resolve'),
      reject: jasmine.createSpy('reject'),
      timeoutId: setTimeout(() => undefined, 1000)
    };
    (service as any).waiters = [waiter];
    (service as any).resolveWaiters('line');
    expect((service as any).waiters.length).toBe(1);
    clearTimeout(waiter.timeoutId);
  });

  it('covers cp NaN branch via Number.isNaN guard', () => {
    const originalIsNaN = Number.isNaN;
    spyOn(Number, 'isNaN').and.callFake((value: unknown) => (value === 47 ? true : originalIsNaN(value)));
    const result = (service as any).parseScoreFromInfoLine('info depth 8 score cp 47', '8/8/8/8/8/8/8/8 w - - 0 1');
    expect(result).toBeNull();
  });

  it('covers helper branches for parsing/collecting and parity transformations', () => {
    expect((service as any).parseTopMoveFromInfoLine('x')).toBeNull();
    expect((service as any).parseTopMoveFromInfoLine('info depth 5 multipv 0 pv e2e4')).toBeNull();
    expect((service as any).parseTopMoveFromInfoLine('info depth 5 multipv 1')).toBeNull();
    expect((service as any).parseTopMoveFromInfoLine('info depth 5 multipv 2 pv g1f3')).toEqual({ pv: 2, move: 'g1f3' });

    expect((service as any).collectTopMoves({
      maxMoves: 2,
      bestmove: 'a2a4',
      movesByPv: new Map<number, string>()
    })).toEqual(['a2a4']);

    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    expect((service as any).withAppliedMoveParity(fen, 0)).toBe(fen);
    expect((service as any).withAppliedMoveParity(fen, 1)).toContain(' b ');
    expect((service as any).withAppliedMoveParity('8/8/8/8/8/8/8/8 b - - 0 1', 1)).toContain(' w ');
    expect((service as any).withAppliedMoveParity(undefined, 1)).toBeUndefined();
    expect((service as any).withAppliedMoveParity('badfen', 1)).toBe('badfen');
  });

  it('normalizes undefined move tokens in evaluateFenAfterMoves', async () => {
    const score = await service.evaluateFenAfterMoves('8/8/8/8/8/8/8/8 w - - 0 1', [undefined as any, 'e2e4'], { depth: 4 });
    expect(score).toBe('-0.47');
  });

  it('handles undefined move array in evaluateFenAfterMoves', async () => {
    const score = await service.evaluateFenAfterMoves('8/8/8/8/8/8/8/8 w - - 0 1', undefined as any, { depth: 4 });
    expect(score).toBe('+0.47');
  });

  it('covers rejectPendingTopMoves no-op and terminate with no worker', () => {
    expect(() => (service as any).rejectPendingTopMoves('x')).not.toThrow();
    (service as any).worker = null;
    expect(() => service.terminate()).not.toThrow();
  });

  it('covers worker-failure fallback message and post error fallback helper', () => {
    (service as any).worker = null;
    const failure = (service as any).handleWorkerFailure('   ');
    const undefinedFailure = (service as any).handleWorkerFailure(undefined);
    expect(failure.message).toBe('Stockfish worker error');
    expect(undefinedFailure.message).toBe('Stockfish worker error');
    expect((service as any).extractPostErrorMessage({})).toBe('Stockfish worker postMessage failed');
  });

  it('creates worker with stockfish asset path', () => {
    const originalWorker = (window as any).Worker;
    const workerPaths: string[] = [];
    (window as any).Worker = function WorkerCtor(path: string): Worker {
      workerPaths.push(path);
      return worker as unknown as Worker;
    };
    try {
      const directService = new StockfishService();
      const created = (directService as any).createWorker();
      expect(created).toBe(worker as any);
      expect(workerPaths).toEqual(['assets/stockfish/stockfish.js']);
    } finally {
      (window as any).Worker = originalWorker;
    }
  });
});
