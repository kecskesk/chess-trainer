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

  it('classifies suggested moves by notation markers', () => {
    expect(component.getSuggestedMoveClass('')).toBe('suggested-move--threat');
    expect(component.getSuggestedMoveClass('...Qh5+')).toBe('suggested-move--check');
    expect(component.getSuggestedMoveClass('Nxe5')).toBe('suggested-move--capture');
    expect(component.getSuggestedMoveClass('Re1')).toBe('suggested-move--threat');
  });
});
