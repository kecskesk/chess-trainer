import { ChessBoardHistoryService } from './chess-board-history.service';

describe('ChessBoardHistoryService', () => {
  it('computes max move index from history and snapshots', () => {
    expect(ChessBoardHistoryService.getMaxMoveIndex(0, 0)).toBe(-1);
    expect(ChessBoardHistoryService.getMaxMoveIndex(5, 3)).toBe(4);
    expect(ChessBoardHistoryService.getMaxMoveIndex(2, 8)).toBe(6);
  });

  it('computes current visible move index for all cursor branches', () => {
    expect(ChessBoardHistoryService.getCurrentVisibleMoveIndex(-1, null)).toBe(-1);
    expect(ChessBoardHistoryService.getCurrentVisibleMoveIndex(4, null)).toBe(4);
    expect(ChessBoardHistoryService.getCurrentVisibleMoveIndex(4, 2)).toBe(2);
    expect(ChessBoardHistoryService.getCurrentVisibleMoveIndex(4, 99)).toBe(4);
    expect(ChessBoardHistoryService.getCurrentVisibleMoveIndex(4, -5)).toBe(-1);
  });

  it('computes active snapshot index for all branches', () => {
    expect(ChessBoardHistoryService.getActiveSnapshotIndex(0, null, 3)).toBe(-1);
    expect(ChessBoardHistoryService.getActiveSnapshotIndex(5, null, 3)).toBe(4);
    expect(ChessBoardHistoryService.getActiveSnapshotIndex(5, 2, 3)).toBe(3);
    expect(ChessBoardHistoryService.getActiveSnapshotIndex(5, 99, 3)).toBe(4);
    expect(ChessBoardHistoryService.getActiveSnapshotIndex(5, -9, 3)).toBe(0);
  });
});
