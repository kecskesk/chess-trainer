import { ChessBoardPositionKeyComponent } from './chess-board-position-key.component';

describe('ChessBoardPositionKeyComponent', () => {
  let component: ChessBoardPositionKeyComponent;

  beforeEach(() => {
    component = new ChessBoardPositionKeyComponent();
  });

  it('emits debug panel toggle event', () => {
    const event = new Event('toggle');
    const emitSpy = spyOn(component.debugPanelToggle, 'emit');

    component.onToggle(event);

    expect(emitSpy).toHaveBeenCalledWith(event);
  });
});