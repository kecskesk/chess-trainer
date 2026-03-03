import { Injectable, OnDestroy } from '@angular/core';

export interface IStockfishAnalysisOptions {
  depth?: number;
  movetimeMs?: number;
  multiPv?: number;
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
  cacheKey: string;
  lastScore: string | null;
  resolve: (score: string) => void;
  reject: (error: Error) => void;
}

interface IPendingTopMoves {
  id: number;
  fen: string;
  maxMoves: number;
  bestmove: string | null;
  movesByPv: Map<number, string>;
  resolve: (moves: string[]) => void;
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
  private pendingTopMoves: IPendingTopMoves | null = null;
  private requestId = 0;
  private readonly evalCacheByFen = new Map<string, string>();
  private readonly topMovesCacheByFen = new Map<string, string[]>();

  ngOnDestroy(): void {
    this.terminate();
  }

  evaluateFen(fen: string, options: IStockfishAnalysisOptions = {}): Promise<string> {
    const normalizedFen = (fen || '').trim();
    if (!normalizedFen) {
      return Promise.resolve(StockfishService.NOT_AVAILABLE);
    }

    const cacheKey = normalizedFen;
    const cached = this.evalCacheByFen.get(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }

    return this.ensureReady().then(() => this.runEvaluation(normalizedFen, cacheKey, options));
  }

  evaluateFenAfterMoves(fen: string, uciMoves: string[], options: IStockfishAnalysisOptions = {}): Promise<string> {
    const normalizedFen = (fen || '').trim();
    if (!normalizedFen) {
      return Promise.resolve(StockfishService.NOT_AVAILABLE);
    }
    const sanitizedMoves = (uciMoves || [])
      .map(move => (move || '').trim().toLowerCase())
      .filter(move => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move));
    if (sanitizedMoves.length < 1) {
      return this.evaluateFen(normalizedFen, options);
    }

    const cacheKey = `${normalizedFen}|moves:${sanitizedMoves.join(' ')}`;
    const cached = this.evalCacheByFen.get(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }

    const perspectiveFen = this.withAppliedMoveParity(normalizedFen, sanitizedMoves.length);
    const positionCommand = `position fen ${normalizedFen} moves ${sanitizedMoves.join(' ')}`;
    return this.ensureReady().then(() => this.runEvaluation(perspectiveFen, cacheKey, options, positionCommand));
  }

  getTopMoves(fen: string, options: IStockfishAnalysisOptions = {}): Promise<string[]> {
    const normalizedFen = (fen || '').trim();
    if (!normalizedFen) {
      return Promise.resolve([]);
    }

    const requestedCount = options.multiPv && options.multiPv > 0 ? Math.floor(options.multiPv) : 3;
    const maxMoves = Math.max(1, Math.min(8, requestedCount));
    const cacheKey = `${normalizedFen}|${maxMoves}`;
    const cached = this.topMovesCacheByFen.get(cacheKey);
    if (cached) {
      return Promise.resolve([...cached]);
    }

    return this.ensureReady().then(() => this.runTopMoves(normalizedFen, maxMoves, options, cacheKey));
  }

  terminate(): void {
    this.rejectPendingEvaluation('Stockfish terminated');
    this.rejectPendingTopMoves('Stockfish terminated');
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
    this.destroyWorker();
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
        this.worker.onerror = (event: Event | ErrorEvent) => {
          if (typeof (event as ErrorEvent).preventDefault === 'function') {
            (event as ErrorEvent).preventDefault();
          }
          reject(this.handleWorkerFailure(this.extractWorkerErrorMessage(event)));
        };
        this.worker.onmessageerror = (event: MessageEvent<unknown>) => {
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          reject(this.handleWorkerFailure('Stockfish worker message error'));
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

  private runEvaluation(
    fen: string,
    cacheKey: string,
    options: IStockfishAnalysisOptions,
    positionCommand: string = `position fen ${fen}`
  ): Promise<string> {
    this.rejectPendingEvaluation('Evaluation cancelled');
    this.rejectPendingTopMoves('Evaluation cancelled');
    this.post('stop');
    this.post('setoption name MultiPV value 1');

    const id = ++this.requestId;
    return new Promise<string>((resolve, reject) => {
      this.pendingEvaluation = { id, fen, cacheKey, lastScore: null, resolve, reject };
      this.post(positionCommand);
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

  private runTopMoves(
    fen: string,
    maxMoves: number,
    options: IStockfishAnalysisOptions,
    cacheKey: string
  ): Promise<string[]> {
    this.rejectPendingEvaluation('Evaluation cancelled');
    this.rejectPendingTopMoves('Evaluation cancelled');
    this.post('stop');
    this.post(`setoption name MultiPV value ${maxMoves}`);

    const id = ++this.requestId;
    return new Promise<string[]>((resolve, reject) => {
      this.pendingTopMoves = {
        id,
        fen,
        maxMoves,
        bestmove: null,
        movesByPv: new Map<number, string>(),
        resolve: (moves: string[]) => {
          this.topMovesCacheByFen.set(cacheKey, [...moves]);
          resolve(moves);
        },
        reject
      };
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
    if (active) {
      const parsedScore = this.parseScoreFromInfoLine(line, active.fen);
      if (parsedScore !== null) {
        active.lastScore = parsedScore;
      }
    }

    const activeTopMoves = this.pendingTopMoves;
    if (activeTopMoves) {
      const parsedTopMove = this.parseTopMoveFromInfoLine(line);
      if (parsedTopMove) {
        activeTopMoves.movesByPv.set(parsedTopMove.pv, parsedTopMove.move);
      }
    }

    if (!line.startsWith('bestmove')) {
      return;
    }

    if (active && this.pendingEvaluation && this.pendingEvaluation.id === active.id) {
      const finalScore = active.lastScore || StockfishService.NOT_AVAILABLE;
      this.evalCacheByFen.set(active.cacheKey, finalScore);
      active.resolve(finalScore);
      this.pendingEvaluation = null;
    }

    if (activeTopMoves && this.pendingTopMoves && this.pendingTopMoves.id === activeTopMoves.id) {
      const bestmoveMatch = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
      if (bestmoveMatch) {
        activeTopMoves.bestmove = bestmoveMatch[1];
      }
      const topMoves = this.collectTopMoves(activeTopMoves);
      activeTopMoves.resolve(topMoves);
      this.pendingTopMoves = null;
    }
  }

  private parseTopMoveFromInfoLine(line: string): { pv: number; move: string } | null {
    if (!line.startsWith('info ')) {
      return null;
    }
    const pvMatch = line.match(/\bmultipv\s+(\d+)\b/);
    const pv = pvMatch ? Number(pvMatch[1]) : 1;
    if (Number.isNaN(pv) || pv < 1) {
      return null;
    }
    const moveMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
    if (!moveMatch) {
      return null;
    }
    return { pv, move: moveMatch[1] };
  }

  private collectTopMoves(pending: IPendingTopMoves): string[] {
    const moves: string[] = [];
    for (let pv = 1; pv <= pending.maxMoves; pv++) {
      const move = pending.movesByPv.get(pv);
      if (move) {
        moves.push(move);
      }
    }
    if (moves.length < 1 && pending.bestmove) {
      moves.push(pending.bestmove);
    }
    return moves;
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

  private withAppliedMoveParity(fen: string, moveCount: number): string {
    if (moveCount % 2 === 0) {
      return fen;
    }
    const parts = (fen || '').trim().split(/\s+/);
    if (parts.length < 2) {
      return fen;
    }
    parts[1] = parts[1] === 'b' ? 'w' : 'b';
    return parts.join(' ');
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

  private rejectPendingTopMoves(message: string): void {
    if (!this.pendingTopMoves) {
      return;
    }
    this.pendingTopMoves.reject(new Error(message));
    this.pendingTopMoves = null;
  }

  private post(command: string): void {
    if (!this.worker) {
      throw new Error('Stockfish worker is not initialized');
    }
    try {
      this.worker.postMessage(command);
    } catch (error) {
      throw this.handleWorkerFailure(this.extractPostErrorMessage(error));
    }
  }

  private createWorker(): Worker {
    return new Worker('assets/stockfish/stockfish.js');
  }

  private handleWorkerFailure(message: string): Error {
    const errorMessage = (message || '').trim() || 'Stockfish worker error';
    this.rejectPendingEvaluation(errorMessage);
    this.rejectPendingTopMoves(errorMessage);
    this.rejectAllWaiters(errorMessage);
    this.ready = false;
    this.initPromise = null;
    this.destroyWorker();
    return new Error(errorMessage);
  }

  private destroyWorker(): void {
    if (!this.worker) {
      return;
    }
    this.worker.terminate();
    this.worker = null;
  }

  private extractWorkerErrorMessage(event: Event | ErrorEvent): string {
    const message = typeof (event as ErrorEvent).message === 'string'
      ? (event as ErrorEvent).message.trim()
      : '';
    return message ? `Stockfish worker error: ${message}` : 'Stockfish worker error';
  }

  private extractPostErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return `Stockfish worker postMessage failed: ${error.message}`;
    }
    return 'Stockfish worker postMessage failed';
  }
}
