export class ChessBoardHistoryService {
  static getMaxMoveIndex(historyLength: number, snapshotLength: number): number {
    return Math.max(historyLength - 1, snapshotLength - 2);
  }

  static getCurrentVisibleMoveIndex(maxIndex: number, mockHistoryCursor: number | null): number {
    if (maxIndex < 0) {
      return -1;
    }
    if (mockHistoryCursor === null) {
      return maxIndex;
    }
    return Math.max(-1, Math.min(mockHistoryCursor, maxIndex));
  }

  static getActiveSnapshotIndex(moveSnapshotsLength: number, mockHistoryCursor: number | null, maxHistoryIndex: number): number {
    if (moveSnapshotsLength < 1) {
      return -1;
    }
    if (mockHistoryCursor === null) {
      return moveSnapshotsLength - 1;
    }

    const clampedHistoryIndex = Math.max(-1, Math.min(mockHistoryCursor, maxHistoryIndex));
    return Math.max(0, Math.min(clampedHistoryIndex + 1, moveSnapshotsLength - 1));
  }
}
