import { ChessBoardSnapshotService } from './chess-board-snapshot.service';
import { ChessBoardStateService } from './chess-board-state.service';
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

describe('ChessBoardSnapshotService', () => {
  let chessBoardStateService: ChessBoardStateService;
  let restoreContext: () => void;

  beforeEach(() => {
    const ctx = setupStateServiceTestContext();
    chessBoardStateService = ctx.chessBoardStateService;
    restoreContext = ctx.restore;
  });

  afterEach(() => {
    restoreContext();
  });

  it('captures a snapshot and clones mutable pieces', () => {
    chessBoardStateService.boardHelper.debugText = 'debug';
    chessBoardStateService.repetitionCounts = { abc: 2 };
    const snapshot = ChessBoardSnapshotService.captureSnapshot(
      chessBoardStateService,
      7,
      ChessColorsEnum.Black,
      true,
      true,
      111,
      222
    );

    expect(snapshot.trackedHistoryLength).toBe(7);
    expect(snapshot.pendingDrawOfferBy).toBe(ChessColorsEnum.Black);
    expect(snapshot.clockStarted).toBeTrue();
    expect(snapshot.clockRunning).toBeTrue();
    expect(snapshot.whiteClockMs).toBe(111);
    expect(snapshot.blackClockMs).toBe(222);
    expect(snapshot.boardHelper.debugText).toBe('debug');
    expect(snapshot.repetitionCounts).toEqual({ abc: 2 });

    // Mutate original and ensure snapshot is unaffected (clone)
    chessBoardStateService.field[0][0] = [] as any;
    expect(snapshot.field[0][0].length).toBeGreaterThanOrEqual(1);
  });

  it('handles missing repetitionCounts by falling back to empty object', () => {
    (chessBoardStateService as any).repetitionCounts = null;
    const snapshot = ChessBoardSnapshotService.captureSnapshot(
      chessBoardStateService,
      0,
      null,
      false,
      false,
      0,
      0
    );
    expect(snapshot.repetitionCounts).toEqual({});
  });

  it('restores a snapshot into state and returns restore metadata', () => {
    const snapshot = ChessBoardSnapshotService.captureSnapshot(
      chessBoardStateService,
      3,
      ChessColorsEnum.White,
      false,
      false,
      10,
      20
    );

    // change state to ensure restore actually applies
    chessBoardStateService.field[0][0] = [] as any;
    chessBoardStateService.boardHelper.debugText = 'changed';

    const result = ChessBoardSnapshotService.restoreSnapshot(snapshot, chessBoardStateService) as any;

    expect(result).not.toBeNull();
    expect(result.pendingDrawOfferBy).toBe(ChessColorsEnum.White);
    expect(result.trackedHistoryLength).toBe(3);
    expect(result.whiteClockMs).toBe(10);
    expect(result.blackClockMs).toBe(20);
    expect((ChessBoardStateService as any).BOARD_HELPER).toBe(chessBoardStateService.boardHelper);
    expect((ChessBoardStateService as any).CHESS_FIELD).toBe(chessBoardStateService.field);
    expect(chessBoardStateService.repetitionCounts).toEqual(snapshot.repetitionCounts);
  });

  it('restoreSnapshot returns null for invalid inputs', () => {
    const snapshot = ChessBoardSnapshotService.captureSnapshot(
      chessBoardStateService,
      1,
      null,
      false,
      false,
      0,
      0
    );

    expect(ChessBoardSnapshotService.restoreSnapshot(null as any, chessBoardStateService)).toBeNull();
    expect(ChessBoardSnapshotService.restoreSnapshot(snapshot, null as any)).toBeNull();

    // make boardHelper missing on the provided state service
    chessBoardStateService.boardHelper = null as any;
    expect(ChessBoardSnapshotService.restoreSnapshot(snapshot, chessBoardStateService)).toBeNull();
  });
});
