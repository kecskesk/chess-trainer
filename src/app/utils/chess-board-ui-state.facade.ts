import { ChessColorsEnum } from '../model/enums/chess-colors.enum';

export interface IChessBoardDrawStateTransition {
  gameOver: true;
  checkmateColor: null;
  pendingDrawOfferBy: null;
  debugText: string;
  result: '1/2-1/2';
  historyReason: string;
}

export interface IChessBoardResignStateTransition {
  gameOver: true;
  checkmateColor: null;
  pendingDrawOfferBy: null;
  resignConfirmColor: null;
  debugText: string;
  result: '1-0' | '0-1';
  historyReason: string;
}

export class ChessBoardUiStateFacade {
  static getSubtleDebugText(reason: string, currentDebugText: string): string | null {
    if (!reason) {
      return null;
    }
    const subtleReason = `\u00B7 ${reason}`;
    if (subtleReason === currentDebugText) {
      return null;
    }
    return subtleReason;
  }

  static tryOfferDraw(
    gameOver: boolean,
    pendingDrawOfferBy: ChessColorsEnum | null,
    turnColor: ChessColorsEnum
  ): { offered: boolean; pendingDrawOfferBy: ChessColorsEnum | null } {
    if (gameOver || pendingDrawOfferBy !== null) {
      return { offered: false, pendingDrawOfferBy };
    }
    return {
      offered: true,
      pendingDrawOfferBy: turnColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White
    };
  }

  static buildDrawStateTransition(message: string, historyReason: string): IChessBoardDrawStateTransition {
    return {
      gameOver: true,
      checkmateColor: null,
      pendingDrawOfferBy: null,
      debugText: message,
      result: '1/2-1/2',
      historyReason
    };
  }

  static buildResignStateTransition(
    loserColor: ChessColorsEnum,
    whiteLabel: string,
    blackLabel: string,
    resignsText: string,
    resignsNoPeriodText: string
  ): IChessBoardResignStateTransition {
    const loserName = loserColor === ChessColorsEnum.White ? whiteLabel : blackLabel;
    return {
      gameOver: true,
      checkmateColor: null,
      pendingDrawOfferBy: null,
      resignConfirmColor: null,
      debugText: `${loserName} ${resignsText}`,
      result: loserColor === ChessColorsEnum.White ? '0-1' : '1-0',
      historyReason: `${loserName} ${resignsNoPeriodText}`
    };
  }
}
