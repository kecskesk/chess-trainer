import { StockfishService } from './stockfish.service';

class WorkerMock {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly postedCommands: string[] = [];
  terminated = false;
  private currentFen = '';

  postMessage(command: string): void {
    this.postedCommands.push(command);
    if (command === 'uci') {
      setTimeout(() => this.emit('uciok'), 0);
      return;
    }
    if (command === 'isready') {
      setTimeout(() => this.emit('readyok'), 0);
      return;
    }
    if (command.startsWith('position fen ')) {
      this.currentFen = command.replace('position fen ', '');
      return;
    }
    if (command.startsWith('go ')) {
      setTimeout(() => {
        if (this.currentFen.includes('matefen')) {
          this.emit('info depth 10 score mate -2');
        } else {
          this.emit('info depth 12 score cp 47');
        }
        this.emit('bestmove e2e4');
      }, 0);
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  private emit(line: string): void {
    this.onmessage?.({ data: line } as MessageEvent<string>);
  }
}

describe('StockfishService', () => {
  let service: StockfishService;
  let worker: WorkerMock;

  beforeEach(() => {
    service = new StockfishService();
    worker = new WorkerMock();
    spyOn<any>(service, 'createWorker').and.returnValue(worker as unknown as Worker);
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
});
