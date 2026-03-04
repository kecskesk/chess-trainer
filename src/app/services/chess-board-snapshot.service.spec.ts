import { ChessBoardSnapshotService } from './chess-board-snapshot.service';
import { ChessBoardStateService } from './chess-board-state.service';
import { ChessBoardTimeControlService } from './chess-board-time-control.service';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';

const setupStateServiceTestContext = () => {
  const chessBoardStateService = new ChessBoardStateService();
  const originalBoardHelper = (ChessBoardStateService as any).BOARD_HELPER;
  const originalField = (ChessBoardStateService as any).CHESS_FIELD;

  return {
    chessBoardStateService,
    restore: () => {
      (ChessBoardStateService as any).BOARD_HELPER = originalBoardHelper;
      (ChessBoardStateService as any).CHESS_FIELD = originalField;
    }
  };
};

describe('ChessBoardSnapshotService capture helpers', () => {
  let service: ChessBoardSnapshotService;
  let chessBoardStateService: ChessBoardStateService;
  let timeControlService: ChessBoardTimeControlService;
  let restoreContext: () => void;

  beforeEach(() => {
    service = new ChessBoardSnapshotService();
    timeControlService = new ChessBoardTimeControlService();
    const ctx = setupStateServiceTestContext();
    chessBoardStateService = ctx.chessBoardStateService;
    restoreContext = ctx.restore;
  });

  afterEach(() => {
    restoreContext();
  });

  it('computes active snapshot index via history service', () => {
    expect(service.getActiveSnapshotIndex(0, null, 5)).toBe(-1);
    expect(service.getActiveSnapshotIndex(4, null, 5)).toBe(3);
    expect(service.getActiveSnapshotIndex(4, 1, 5)).toBe(2);
  });

  it('captures current snapshot and clones mutable pieces', () => {
    chessBoardStateService.boardHelper.debugText = 'debug';
    chessBoardStateService.repetitionCounts = { abc: 2 };
    chessBoardStateService.trackedHistoryLength = 7;
    service.pendingDrawOfferBy = ChessColorsEnum.Black;
    timeControlService.clockStarted = true;
    timeControlService.clockRunning = true;
    timeControlService.whiteClockMs = 111;
    timeControlService.blackClockMs = 222;

    const snapshot = service.captureCurrentSnapshot(chessBoardStateService, timeControlService);

    expect(snapshot.trackedHistoryLength).toBe(7);
    expect(snapshot.pendingDrawOfferBy).toBe(ChessColorsEnum.Black);
    expect(snapshot.clockStarted).toBeTrue();
    expect(snapshot.clockRunning).toBeTrue();
    expect(snapshot.whiteClockMs).toBe(111);
    expect(snapshot.blackClockMs).toBe(222);
    expect(snapshot.boardHelper.debugText).toBe('debug');
    expect(snapshot.repetitionCounts).toEqual({ abc: 2 });

    chessBoardStateService.field[0][0] = [] as any;
    expect(snapshot.field[0][0].length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to empty repetition map when source repetitionCounts is null', () => {
    (chessBoardStateService as any).repetitionCounts = null;
    const snapshot = service.captureSnapshot(chessBoardStateService, 0, null, false, false, 0, 0);
    expect(snapshot.repetitionCounts).toEqual({});
  });
});

describe('ChessBoardSnapshotService restore helpers', () => {
  let service: ChessBoardSnapshotService;
  let chessBoardStateService: ChessBoardStateService;
  let timeControlService: ChessBoardTimeControlService;
  let restoreContext: () => void;

  beforeEach(() => {
    service = new ChessBoardSnapshotService();
    timeControlService = new ChessBoardTimeControlService();
    const ctx = setupStateServiceTestContext();
    chessBoardStateService = ctx.chessBoardStateService;
    restoreContext = ctx.restore;
  });

  afterEach(() => {
    restoreContext();
  });

  it('restoreSnapshot updates service variables and returns whether clock should run', () => {
    const snapshot = service.captureSnapshot(chessBoardStateService, 3, ChessColorsEnum.White, false, true, 10, 20);
    service.resignConfirmColor = ChessColorsEnum.Black;

    const shouldRunClock = service.restoreSnapshot(snapshot, chessBoardStateService, timeControlService);

    expect(service.pendingDrawOfferBy).toBe(ChessColorsEnum.White);
    expect(service.resignConfirmColor).toBeNull();
    expect(chessBoardStateService.trackedHistoryLength).toBe(3);
    expect(timeControlService.clockStarted).toBeFalse();
    expect(timeControlService.whiteClockMs).toBe(10);
    expect(timeControlService.blackClockMs).toBe(20);
    expect(shouldRunClock).toBeTrue();

    const pausedSnapshot = service.captureSnapshot(chessBoardStateService, 4, null, true, false, 15, 25);
    expect(service.restoreSnapshot(pausedSnapshot, chessBoardStateService, timeControlService)).toBeFalse();
  });

  it('restoreSnapshotToState returns null for invalid inputs', () => {
    const snapshot = service.captureSnapshot(chessBoardStateService, 1, null, false, false, 0, 0);

    expect(service.restoreSnapshotToState(null as any, chessBoardStateService)).toBeNull();
    expect(service.restoreSnapshotToState(snapshot, null as any)).toBeNull();

    chessBoardStateService.boardHelper = null as any;
    expect(service.restoreSnapshotToState(snapshot, chessBoardStateService)).toBeNull();
  });
});
