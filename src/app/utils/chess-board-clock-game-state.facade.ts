import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardClockUtils, ITimeForfeitResult } from './chess-board-clock.utils';

export class ChessBoardClockGameStateFacade {
  static canOfferDraw(gameOver: boolean, pendingDrawOfferBy: ChessColorsEnum | null): boolean {
    return !gameOver && pendingDrawOfferBy === null;
  }

  static canRespondToDrawOffer(
    gameOver: boolean,
    pendingDrawOfferBy: ChessColorsEnum | null,
    turnColor: ChessColorsEnum
  ): boolean {
    if (gameOver || pendingDrawOfferBy === null) {
      return false;
    }
    return pendingDrawOfferBy !== turnColor;
  }

  static getClaimDrawReason(isThreefoldRepetition: boolean, isFiftyMoveRule: boolean): 'threefold' | 'fifty-move' | null {
    if (isThreefoldRepetition) {
      return 'threefold';
    }
    if (isFiftyMoveRule) {
      return 'fifty-move';
    }
    return null;
  }

  static canResign(gameOver: boolean, color: ChessColorsEnum): boolean {
    if (gameOver) {
      return false;
    }
    return color === ChessColorsEnum.White || color === ChessColorsEnum.Black;
  }

  static canToggleClock(gameOver: boolean): boolean {
    return !gameOver;
  }

  static handleTimeForfeit(
    loserColor: ChessColorsEnum,
    isGameOver: boolean
  ): ITimeForfeitResult | null {
    return ChessBoardClockUtils.handleTimeForfeit(
      loserColor,
      isGameOver
    );
  }
}
