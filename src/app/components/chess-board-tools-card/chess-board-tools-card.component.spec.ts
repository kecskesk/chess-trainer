import { ChessBoardToolsCardComponent } from './chess-board-tools-card.component';

describe('ChessBoardToolsCardComponent', () => {
  let component: ChessBoardToolsCardComponent;

  beforeEach(() => {
    component = new ChessBoardToolsCardComponent();
  });

  it('emits hovered suggested move and clear preview events', () => {
    const previewSpy = spyOn(component.previewMove, 'emit');
    const clearSpy = spyOn(component.clearPreview, 'emit');

    component.previewMove.emit('Qh5+');
    component.clearPreview.emit();

    expect(previewSpy).toHaveBeenCalledWith('Qh5+');
    expect(clearSpy).toHaveBeenCalled();
  });
});