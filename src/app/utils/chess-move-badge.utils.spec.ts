import { ChessMoveBadgeUtils } from './chess-move-badge.utils';

describe('ChessMoveBadgeUtils', () => {
  it('prefers stronger quality class across equivalent move keys', () => {
    const qualityByMove = {
      Nf3: 'history-quality--best',
      '...Nf3+': 'history-quality--great'
    };

    expect(ChessMoveBadgeUtils.getMoveClass('Nf3', qualityByMove)).toBe('history-quality--great');
  });

  it('treats brilliant as stronger than best for equivalent keys', () => {
    const qualityByMove = {
      Qh5: 'history-quality--best',
      'Qh5!': 'history-quality--brilliant'
    };

    expect(ChessMoveBadgeUtils.getMoveClass('Qh5', qualityByMove)).toBe('history-quality--brilliant');
  });

  it('keeps tactical fallback classes when no quality match exists', () => {
    expect(ChessMoveBadgeUtils.getMoveClass('Qxh7+', {})).toBe('suggested-move--check');
    expect(ChessMoveBadgeUtils.getMoveClass('Qxh7', {})).toBe('suggested-move--capture');
    expect(ChessMoveBadgeUtils.getMoveClass('Qh5', {})).toBe('suggested-move--threat');
  });
});
