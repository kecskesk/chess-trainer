import { IGameplaySnapshot } from '../model/interfaces/chess-board-gameplay-snapshot.interface';
import { ChessBoardHistoryService } from '../services/chess-board-history.service';

export class ChessBoardTimelineFacade {
  static getVisibleHistory(history: string[], mockHistoryCursor: number | null): string[] {
    if (mockHistoryCursor === null) {
      return history;
    }
    if (history.length < 1) {
      return [];
    }
    const maxIndex = history.length - 1;
    const clampedIndex = Math.max(-1, Math.min(mockHistoryCursor, maxIndex));
    if (clampedIndex < 0) {
      return [];
    }
    return history.slice(0, clampedIndex + 1);
  }

  static canUndoMove(maxIndex: number, mockHistoryCursor: number | null): boolean {
    return ChessBoardHistoryService.getCurrentVisibleMoveIndex(maxIndex, mockHistoryCursor) >= 0;
  }

  static canRedoMove(maxIndex: number, mockHistoryCursor: number | null): boolean {
    if (maxIndex < 0 || mockHistoryCursor === null) {
      return false;
    }
    return mockHistoryCursor < maxIndex;
  }

  static getUndoCursor(maxIndex: number, mockHistoryCursor: number | null): number | null {
    const currentIndex = ChessBoardHistoryService.getCurrentVisibleMoveIndex(maxIndex, mockHistoryCursor);
    if (currentIndex < 0) {
      return null;
    }
    return currentIndex - 1;
  }

  static getRedoCursor(maxIndex: number, mockHistoryCursor: number | null): number | null {
    if (maxIndex < 0 || mockHistoryCursor === null) {
      return mockHistoryCursor;
    }
    if (mockHistoryCursor >= maxIndex) {
      return null;
    }
    const advancedCursor = mockHistoryCursor + 1;
    if (advancedCursor >= maxIndex) {
      return null;
    }
    return advancedCursor;
  }

  static getInitializedSnapshots(captureSnapshot: () => IGameplaySnapshot): IGameplaySnapshot[] {
    return [captureSnapshot()];
  }

  static appendSnapshotForCurrentState(
    moveSnapshots: IGameplaySnapshot[],
    activeSnapshotIndex: number,
    captureSnapshot: () => IGameplaySnapshot
  ): IGameplaySnapshot[] {
    const baseSnapshots = activeSnapshotIndex >= 0 && activeSnapshotIndex < moveSnapshots.length - 1
      ? moveSnapshots.slice(0, activeSnapshotIndex + 1)
      : moveSnapshots;
    return [...baseSnapshots, captureSnapshot()];
  }

  static replaceActiveSnapshot(
    moveSnapshots: IGameplaySnapshot[],
    activeSnapshotIndex: number,
    captureSnapshot: () => IGameplaySnapshot
  ): IGameplaySnapshot[] {
    const nextSnapshots = [...moveSnapshots];
    nextSnapshots[activeSnapshotIndex] = captureSnapshot();
    return nextSnapshots;
  }

  static getTargetSnapshotIndex(maxMoveIndex: number, mockHistoryCursor: number | null, moveSnapshotsLength: number): number {
    const targetSnapshotIndex = ChessBoardHistoryService.getCurrentVisibleMoveIndex(maxMoveIndex, mockHistoryCursor) + 1;
    if (targetSnapshotIndex < 0 || targetSnapshotIndex >= moveSnapshotsLength) {
      return -1;
    }
    return targetSnapshotIndex;
  }

  static shouldAutoScrollHistory(previewMode: boolean, mockHistoryCursor: number | null): boolean {
    return !previewMode && mockHistoryCursor === null;
  }
}
