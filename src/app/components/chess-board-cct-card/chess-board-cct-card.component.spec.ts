import { ChessBoardCctCardComponent } from './chess-board-cct-card.component';

describe('ChessBoardCctCardComponent', () => {
  let component: ChessBoardCctCardComponent;

  beforeEach(() => {
    component = new ChessBoardCctCardComponent();
  });

  it('emits preview and clear events for recommendation hover lifecycle', () => {
    const previewSpy = spyOn(component.previewMove, 'emit');
    const clearSpy = spyOn(component.clearPreview, 'emit');

    component.previewMove.emit('Nf7+');
    component.clearPreview.emit();

    expect(previewSpy).toHaveBeenCalledWith('Nf7+');
    expect(clearSpy).toHaveBeenCalled();
  });

  it('exposes default move class and score providers', () => {
    expect(component.getMoveClass('Nf3')).toBe('');
    expect(component.getMoveScore('Nf3')).toBe('');
  });
});
