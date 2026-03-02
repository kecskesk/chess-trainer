import { ChessBoardDisplayUtils } from './chess-board-display.utils';

describe('ChessBoardDisplayUtils', () => {
  it('maps board index for normal and flipped orientation', () => {
    expect(ChessBoardDisplayUtils.getBoardIndexForDisplay(2, false)).toBe(2);
    expect(ChessBoardDisplayUtils.getBoardIndexForDisplay(2, true)).toBe(5);
  });

  it('maps percent coordinates for display with fallback cases', () => {
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('25%', false)).toBe('25%');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('', true)).toBe('');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('abc', true)).toBe('abc');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('12.5%', true)).toBe('87.5%');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('10%', true)).toBe('90%');
  });

  it('maps rotation values for display with all branches', () => {
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('30deg', false)).toBe('30deg');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('', true)).toBe('');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('bad', true)).toBe('bad');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('390deg', true)).toBe('210deg');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('-300deg', true)).toBe('240deg');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('540deg', true)).toBe('0deg');
  });
});
