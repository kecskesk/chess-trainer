export class ChessBoardHistoryService {
  static getMaxMoveIndex(historyLength: number, snapshotLength: number): number {
    return Math.max(historyLength - 1, snapshotLength - 2);
  }

  static getCurrentVisibleMoveIndex(maxIndex: number, historyCursor: number | null): number {
    if (maxIndex < 0) {
      return -1;
    }
    if (historyCursor === null) {
      return maxIndex;
    }
    return Math.max(-1, Math.min(historyCursor, maxIndex));
  }

  static getActiveSnapshotIndex(moveSnapshotsLength: number, historyCursor: number | null, maxHistoryIndex: number): number {
    if (moveSnapshotsLength < 1) {
      return -1;
    }
    if (historyCursor === null) {
      return moveSnapshotsLength - 1;
    }

    const clampedHistoryIndex = Math.max(-1, Math.min(historyCursor, maxHistoryIndex));
    return Math.max(0, Math.min(clampedHistoryIndex + 1, moveSnapshotsLength - 1));
  }
}

