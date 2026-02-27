import { ChessBoardUtils } from './chess-utils';

describe('ChessBoardUtils', () => {
  it('converts algebraic notation both ways', () => {
    expect(ChessBoardUtils.toAlgebraic(7, 0)).toBe('a1');
    expect(ChessBoardUtils.fromAlgebraic('e4')).toEqual({ row: 4, col: 4 });
  });

  it('returns direction vector between two squares', () => {
    expect(ChessBoardUtils.getDirection(6, 4, 4, 4)).toEqual({ rowDir: -1, colDir: 0 });
    expect(ChessBoardUtils.getDirection(4, 4, 5, 6)).toEqual({ rowDir: 1, colDir: 1 });
  });

  it('returns squares between source and target', () => {
    expect(ChessBoardUtils.getSquaresBetween(7, 0, 7, 3)).toEqual([
      { row: 7, col: 1 },
      { row: 7, col: 2 }
    ]);
  });
});
