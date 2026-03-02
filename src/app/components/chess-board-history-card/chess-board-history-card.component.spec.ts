import { ChessBoardHistoryCardComponent } from './chess-board-history-card.component';

describe('ChessBoardHistoryCardComponent', () => {
  let component: ChessBoardHistoryCardComponent;

  beforeEach(() => {
    component = new ChessBoardHistoryCardComponent();
  });

  it('returns null history element when view child is not initialized', () => {
    expect(component.getHistoryElement()).toBeNull();
  });
});