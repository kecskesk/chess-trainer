import { ChessBoardClockUtils } from './chess-board-clock.utils';

describe('ChessBoardClockUtils', () => {
  it('pads values to two digits', () => {
    expect(ChessBoardClockUtils.padToTwo(0)).toBe('00');
    expect(ChessBoardClockUtils.padToTwo(9)).toBe('09');
    expect(ChessBoardClockUtils.padToTwo(10)).toBe('10');
  });

  it('formats clock with and without tenths', () => {
    expect(ChessBoardClockUtils.formatClock(500)).toBe('00:00.5');
    expect(ChessBoardClockUtils.formatClock(65000)).toBe('01:05');
    expect(ChessBoardClockUtils.formatClock(10 * 60 * 1000)).toBe('10:00');
  });
});
