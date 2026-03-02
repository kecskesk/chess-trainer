import { Injectable, OnDestroy } from '@angular/core';

export interface IStockfishAnalysisOptions {
  depth?: number;
  movetimeMs?: number;
}

interface ILineWaiter {
  predicate: (line: string) => boolean;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface IPendingEvaluation {
  id: number;
  fen: string;
  lastScore: string | null;
  resolve: (score: string) => void;
  reject: (error: Error) => void;
}

@Injectable({ providedIn: 'root' })
export class StockfishService implements OnDestroy {
  private static readonly DEFAULT_DEPTH = 12;
  private static readonly HANDSHAKE_TIMEOUT_MS = 8000;
  private static readonly NOT_AVAILABLE = 'n/a';

  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private ready = false;
  private waiters: ILineWaiter[] = [];
  private pendingEvaluation: IPendingEvaluation | null = null;
  private requestId = 0;
  private readonly evalCacheByFen = new Map<string, string>();

  ngOnDestroy(): void {
    this.terminate();
  }

  evaluateFen(fen: string, options: IStockfishAnalysisOptions = {}): Promise<string> {
    const normalizedFen = (fen || '').trim();
    if (!normalizedFen) {
      return Promise.resolve(StockfishService.NOT_AVAILABLE);
    }

    const cached = this.evalCacheByFen.get(normalizedFen);
    if (cached) {
      return Promise.resolve(cached);
    }

    return this.ensureReady().then(() => this.runEvaluation(normalizedFen, options));
  }

  terminate(): void {
    this.rejectPendingEvaluation('Stockfish terminated');
    this.rejectAllWaiters('Stockfish terminated');
    this.ready = false;
    this.initPromise = null;
    if (!this.worker) {
      return;
    }
    try {
      this.worker.postMessage('quit');
    } catch {
      // Ignore postMessage failures while shutting down.
    }
    this.worker.terminate();
    this.worker = null;
  }

  private ensureReady(): Promise<void> {
    if (this.ready && this.worker) {
      return Promise.resolve();
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        this.worker = this.createWorker();
        this.worker.onmessage = (event: MessageEvent<string>) => this.onWorkerMessage(event);
        this.worker.onerror = () => {
          const error = new Error('Stockfish worker error');
          this.rejectPendingEvaluation(error.message);
          this.rejectAllWaiters(error.message);
          reject(error);
        };

        this.post('uci');
        this.waitForLine(line => line === 'uciok', StockfishService.HANDSHAKE_TIMEOUT_MS)
          .then(() => {
            this.post('isready');
            return this.waitForLine(line => line === 'readyok', StockfishService.HANDSHAKE_TIMEOUT_MS);
          })
          .then(() => {
            this.ready = true;
            resolve();
          })
          .catch((error: Error) => {
            this.terminate();
            reject(error);
          });
      } catch (error) {
        reject(error as Error);
      }
    }).finally(() => {
      if (!this.ready) {
        this.initPromise = null;
      }
    });

    return this.initPromise;
  }

  private runEvaluation(fen: string, options: IStockfishAnalysisOptions): Promise<string> {
    this.rejectPendingEvaluation('Evaluation cancelled');
    this.post('stop');

    const id = ++this.requestId;
    return new Promise<string>((resolve, reject) => {
      this.pendingEvaluation = { id, fen, lastScore: null, resolve, reject };
      this.post(`position fen ${fen}`);
      if (options.movetimeMs && options.movetimeMs > 0) {
        this.post(`go movetime ${Math.max(1, Math.floor(options.movetimeMs))}`);
        return;
      }
      const depth = options.depth && options.depth > 0
        ? Math.floor(options.depth)
        : StockfishService.DEFAULT_DEPTH;
      this.post(`go depth ${depth}`);
    });
  }

  private onWorkerMessage(event: MessageEvent<string>): void {
    const line = (event && typeof event.data === 'string' ? event.data : '').trim();
    if (!line) {
      return;
    }

    this.resolveWaiters(line);

    const active = this.pendingEvaluation;
    if (!active) {
      return;
    }

    const parsedScore = this.parseScoreFromInfoLine(line, active.fen);
    if (parsedScore !== null) {
      active.lastScore = parsedScore;
    }

    if (!line.startsWith('bestmove')) {
      return;
    }

    if (this.pendingEvaluation && this.pendingEvaluation.id === active.id) {
      const finalScore = active.lastScore || StockfishService.NOT_AVAILABLE;
      this.evalCacheByFen.set(active.fen, finalScore);
      active.resolve(finalScore);
      this.pendingEvaluation = null;
    }
  }

  private parseScoreFromInfoLine(line: string, fen: string): string | null {
    if (!line.startsWith('info ')) {
      return null;
    }
    const isBlackToMove = this.getSideToMoveFromFen(fen) === 'b';

    const mateMatch = line.match(/\bscore mate (-?\d+)\b/);
    if (mateMatch) {
      let matePlies = Number(mateMatch[1]);
      if (!Number.isNaN(matePlies)) {
        if (isBlackToMove) {
          matePlies *= -1;
        }
        const signed = matePlies > 0 ? `+${matePlies}` : `${matePlies}`;
        return `#${signed}`;
      }
    }

    const cpMatch = line.match(/\bscore cp (-?\d+)\b/);
    if (!cpMatch) {
      return null;
    }
    let centipawns = Number(cpMatch[1]);
    if (Number.isNaN(centipawns)) {
      return null;
    }
    if (isBlackToMove) {
      centipawns *= -1;
    }

    const pawns = centipawns / 100;
    const sign = pawns >= 0 ? '+' : '';
    return `${sign}${pawns.toFixed(2)}`;
  }

  private getSideToMoveFromFen(fen: string): 'w' | 'b' {
    const parts = (fen || '').trim().split(/\s+/);
    return parts[1] === 'b' ? 'b' : 'w';
  }

  private waitForLine(predicate: (line: string) => boolean, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waiters = this.waiters.filter(waiter => waiter.timeoutId !== timeoutId);
        reject(new Error('Timed out waiting for Stockfish response'));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timeoutId });
    });
  }

  private resolveWaiters(line: string): void {
    if (this.waiters.length < 1) {
      return;
    }

    const unresolved: ILineWaiter[] = [];
    this.waiters.forEach(waiter => {
      if (waiter.predicate(line)) {
        clearTimeout(waiter.timeoutId);
        waiter.resolve();
        return;
      }
      unresolved.push(waiter);
    });
    this.waiters = unresolved;
  }

  private rejectAllWaiters(message: string): void {
    this.waiters.forEach(waiter => {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error(message));
    });
    this.waiters = [];
  }

  private rejectPendingEvaluation(message: string): void {
    if (!this.pendingEvaluation) {
      return;
    }
    this.pendingEvaluation.reject(new Error(message));
    this.pendingEvaluation = null;
  }

  private post(command: string): void {
    if (!this.worker) {
      throw new Error('Stockfish worker is not initialized');
    }
    this.worker.postMessage(command);
  }

  private createWorker(): Worker {
    return new Worker('assets/stockfish/stockfish.js');
  }
}
