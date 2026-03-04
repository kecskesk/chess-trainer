import { Injectable } from '@angular/core';
import { ChessBoardStateService } from './chess-board-state.service';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { IGameplaySnapshot } from '../model/interfaces/chess-board-gameplay-snapshot.interface';
import { ChessBoardLogicUtils } from '../utils/chess-board-logic.utils';
import { ChessBoardHistoryService } from './chess-board-history.service';
import { ChessBoardTimeControlService } from './chess-board-time-control.service';

export interface IRestoreSnapshotResult {
  pendingDrawOfferBy: ChessColorsEnum | null;
  repetitionCounts: {[positionKey: string]: number};
  trackedHistoryLength: number;
  clockStarted: boolean;
  whiteClockMs: number;
  blackClockMs: number;
  shouldRunClock: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChessBoardSnapshotService {
  pendingDrawOfferBy: ChessColorsEnum | null = null;
  resignConfirmColor: ChessColorsEnum | null = null;

  getActiveSnapshotIndex(moveSnapshotsLength: number, historyCursor: number | null, maxHistoryIndex: number): number {
    return ChessBoardHistoryService.getActiveSnapshotIndex(moveSnapshotsLength, historyCursor, maxHistoryIndex);
  }

  captureCurrentSnapshot(
    chessBoardStateService: ChessBoardStateService,
    timeControlService: ChessBoardTimeControlService
  ): IGameplaySnapshot {
    return this.captureSnapshot(
      chessBoardStateService,
      chessBoardStateService.trackedHistoryLength,
      this.pendingDrawOfferBy,
      timeControlService.clockStarted,
      timeControlService.clockRunning,
      timeControlService.whiteClockMs,
      timeControlService.blackClockMs
    );
  }

  restoreSnapshot(
    snapshot: IGameplaySnapshot,
    chessBoardStateService: ChessBoardStateService,
    timeControlService: ChessBoardTimeControlService
  ): boolean {
    const restoredState = this.restoreSnapshotToState(snapshot, chessBoardStateService);
    if (!restoredState) {
      return false;
    }
    this.pendingDrawOfferBy = restoredState.pendingDrawOfferBy;
    this.resignConfirmColor = null;
    chessBoardStateService.repetitionCounts = restoredState.repetitionCounts;
    chessBoardStateService.trackedHistoryLength = restoredState.trackedHistoryLength;
    timeControlService.clockStarted = restoredState.clockStarted;
    timeControlService.whiteClockMs = restoredState.whiteClockMs;
    timeControlService.blackClockMs = restoredState.blackClockMs;
    return restoredState.shouldRunClock;
  }

  captureSnapshot(
    chessBoardStateService: ChessBoardStateService,
    trackedHistoryLength: number,
    pendingDrawOfferBy: ChessColorsEnum | null,
    clockStarted: boolean,
    clockRunning: boolean,
    whiteClockMs: number,
    blackClockMs: number
  ): IGameplaySnapshot {
    const boardHelper = chessBoardStateService.boardHelper;
    return {
      field: ChessBoardLogicUtils.cloneField(chessBoardStateService.field),
      boardHelper: {
        debugText: boardHelper ? boardHelper.debugText : '',
        history: boardHelper && boardHelper.history ? { ...boardHelper.history } : {},
        colorTurn: boardHelper ? boardHelper.colorTurn : ChessColorsEnum.White,
        canPromote: boardHelper && boardHelper.canPromote !== undefined ? boardHelper.canPromote : null,
        justDidEnPassant: ChessBoardLogicUtils.clonePosition(boardHelper ? boardHelper.justDidEnPassant : null),
        justDidCastle: ChessBoardLogicUtils.clonePosition(boardHelper ? boardHelper.justDidCastle : null),
        gameOver: !!(boardHelper && boardHelper.gameOver),
        checkmateColor: boardHelper ? boardHelper.checkmateColor : null
      },
      repetitionCounts: { ...(chessBoardStateService.repetitionCounts || {}) },
      trackedHistoryLength,
      pendingDrawOfferBy,
      clockStarted,
      clockRunning,
      whiteClockMs,
      blackClockMs
    };
  }

  restoreSnapshotToState(snapshot: IGameplaySnapshot, chessBoardStateService: ChessBoardStateService): IRestoreSnapshotResult | null {
    if (!snapshot || !chessBoardStateService || !chessBoardStateService.boardHelper) {
      return null;
    }

    chessBoardStateService.field = ChessBoardLogicUtils.cloneField(snapshot.field);
    ChessBoardStateService.CHESS_FIELD = chessBoardStateService.field;

    const boardHelper = chessBoardStateService.boardHelper;
    boardHelper.debugText = snapshot.boardHelper.debugText;
    boardHelper.possibles = {};
    boardHelper.hits = {};
    boardHelper.checks = {};
    boardHelper.arrows = {};
    boardHelper.history = { ...snapshot.boardHelper.history };
    boardHelper.colorTurn = snapshot.boardHelper.colorTurn;
    boardHelper.canPromote = snapshot.boardHelper.canPromote;
    boardHelper.justDidEnPassant = ChessBoardLogicUtils.clonePosition(snapshot.boardHelper.justDidEnPassant);
    boardHelper.justDidCastle = ChessBoardLogicUtils.clonePosition(snapshot.boardHelper.justDidCastle);
    boardHelper.gameOver = snapshot.boardHelper.gameOver;
    boardHelper.checkmateColor = snapshot.boardHelper.checkmateColor;
    ChessBoardStateService.BOARD_HELPER = boardHelper;

    // restore repetition counts into the state service as well
    chessBoardStateService.repetitionCounts = { ...snapshot.repetitionCounts };
    return {
      pendingDrawOfferBy: snapshot.pendingDrawOfferBy,
      repetitionCounts: { ...snapshot.repetitionCounts },
      trackedHistoryLength: snapshot.trackedHistoryLength,
      clockStarted: snapshot.clockStarted,
      whiteClockMs: snapshot.whiteClockMs,
      blackClockMs: snapshot.blackClockMs,
      shouldRunClock: snapshot.clockRunning
    };
  }
}
