import { ChessBoardStateService } from './chess-board-state.service';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { IGameplaySnapshot } from '../model/interfaces/chess-board-gameplay-snapshot.interface';
import { ChessBoardLogicUtils } from '../utils/chess-board-logic.utils';

export interface IRestoreSnapshotResult {
  pendingDrawOfferBy: ChessColorsEnum | null;
  repetitionCounts: {[positionKey: string]: number};
  trackedHistoryLength: number;
  clockStarted: boolean;
  whiteClockMs: number;
  blackClockMs: number;
  shouldRunClock: boolean;
}

export class ChessBoardSnapshotService {
  static captureSnapshot(
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

  static restoreSnapshot(snapshot: IGameplaySnapshot, chessBoardStateService: ChessBoardStateService): IRestoreSnapshotResult | null {
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
