import { ChessBoardClockGameStateFacade } from './chess-board-clock-game-state.facade';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { UiText } from '../constants/ui-text.constants';

describe('ChessBoardClockGameStateFacade', () => {
  it('canOfferDraw returns true only when game is active and no pending offer', () => {
    expect(ChessBoardClockGameStateFacade.canOfferDraw(false, null)).toBeTrue();
    expect(ChessBoardClockGameStateFacade.canOfferDraw(true, null)).toBeFalse();
    expect(ChessBoardClockGameStateFacade.canOfferDraw(false, ChessColorsEnum.White)).toBeFalse();
  });

  it('canRespondToDrawOffer returns true only for opposing side while game is active', () => {
    expect(ChessBoardClockGameStateFacade.canRespondToDrawOffer(false, ChessColorsEnum.White, ChessColorsEnum.Black)).toBeTrue();
    expect(ChessBoardClockGameStateFacade.canRespondToDrawOffer(false, ChessColorsEnum.White, ChessColorsEnum.White)).toBeFalse();
    expect(ChessBoardClockGameStateFacade.canRespondToDrawOffer(false, null, ChessColorsEnum.White)).toBeFalse();
    expect(ChessBoardClockGameStateFacade.canRespondToDrawOffer(true, ChessColorsEnum.White, ChessColorsEnum.Black)).toBeFalse();
  });

  it('getClaimDrawReason prioritizes threefold, then fifty-move, otherwise null', () => {
    expect(ChessBoardClockGameStateFacade.getClaimDrawReason(true, true)).toBe('threefold');
    expect(ChessBoardClockGameStateFacade.getClaimDrawReason(false, true)).toBe('fifty-move');
    expect(ChessBoardClockGameStateFacade.getClaimDrawReason(false, false)).toBeNull();
  });

  it('canResign validates game state and side color', () => {
    expect(ChessBoardClockGameStateFacade.canResign(false, ChessColorsEnum.White)).toBeTrue();
    expect(ChessBoardClockGameStateFacade.canResign(false, ChessColorsEnum.Black)).toBeTrue();
    expect(ChessBoardClockGameStateFacade.canResign(true, ChessColorsEnum.White)).toBeFalse();
    expect(ChessBoardClockGameStateFacade.canResign(false, null as any)).toBeFalse();
  });

  it('canToggleClock returns false only when game is over', () => {
    expect(ChessBoardClockGameStateFacade.canToggleClock(false)).toBeTrue();
    expect(ChessBoardClockGameStateFacade.canToggleClock(true)).toBeFalse();
  });

  it('handleTimeForfeit returns null when game is over and formats winner otherwise', () => {
    UiText.status.white = 'White';
    UiText.status.black = 'Black';
    UiText.message.forfeitsOnTime = 'forfeits on time.';
    UiText.message.forfeitsOnTimeNoPeriod = 'forfeits on time';
    expect(
      ChessBoardClockGameStateFacade.handleTimeForfeit(
        ChessColorsEnum.White,
        true
      )
    ).toBeNull();

    const result = ChessBoardClockGameStateFacade.handleTimeForfeit(
      ChessColorsEnum.Black,
      false
    );

    expect(result).not.toBeNull();
    expect(result?.winnerResult).toBe('1-0');
    expect(result?.appendReason).toBe('Black forfeits on time');
    expect(result?.debugText).toBe('Black forfeits on time.');
  });
});
