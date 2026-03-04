import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardUiStateFacade } from './chess-board-ui-state.facade';
import { UiText } from '../constants/ui-text.constants';

describe('ChessBoardUiStateFacade', () => {
  it('builds subtle debug text only when changed', () => {
    expect(ChessBoardUiStateFacade.getSubtleDebugText('', '')).toBeNull();
    expect(ChessBoardUiStateFacade.getSubtleDebugText('Reason', '· Reason')).toBeNull();
    expect(ChessBoardUiStateFacade.getSubtleDebugText('Reason', '')).toBe('· Reason');
  });

  it('offers draw only when there is no game-over and no pending offer', () => {
    const blockedByGameOver = ChessBoardUiStateFacade.tryOfferDraw(true, null, ChessColorsEnum.White);
    expect(blockedByGameOver.offered).toBeFalse();

    const blockedByPending = ChessBoardUiStateFacade.tryOfferDraw(false, ChessColorsEnum.White, ChessColorsEnum.Black);
    expect(blockedByPending.offered).toBeFalse();

    const offered = ChessBoardUiStateFacade.tryOfferDraw(false, null, ChessColorsEnum.White);
    expect(offered.offered).toBeTrue();
    expect(offered.pendingDrawOfferBy).toBe(ChessColorsEnum.Black);
  });

  it('builds draw transition payload', () => {
    const result = ChessBoardUiStateFacade.buildDrawStateTransition('Draw', 'Draw by agreement');
    expect(result.gameOver).toBeTrue();
    expect(result.checkmateColor).toBeNull();
    expect(result.pendingDrawOfferBy).toBeNull();
    expect(result.result).toBe('1/2-1/2');
  });

  it('builds resign transition payload', () => {
    UiText.status.white = 'White';
    UiText.message.resigns = 'resigns.';
    UiText.message.resignsNoPeriod = 'resigns';
    const result = ChessBoardUiStateFacade.buildResignStateTransition(ChessColorsEnum.White);
    expect(result.result).toBe('0-1');
    expect(result.debugText).toContain('White');
    expect(result.pendingDrawOfferBy).toBeNull();
  });
});
