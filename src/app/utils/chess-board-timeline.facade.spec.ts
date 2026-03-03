import { ChessBoardTimelineFacade } from './chess-board-timeline.facade';

describe('ChessBoardTimelineFacade', () => {
  it('returns current cursor when maxIndex is negative in getRedoCursor', () => {
    expect(ChessBoardTimelineFacade.getRedoCursor(-1, 2)).toBe(2);
  });
});
