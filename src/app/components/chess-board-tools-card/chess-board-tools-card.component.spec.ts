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

  it('uses provided quality class and score providers when present', () => {
    component.suggestedMoveClassProvider = jasmine.createSpy('suggestedMoveClassProvider').and.returnValue('history-quality--great');
    component.suggestedMoveScoreProvider = jasmine.createSpy('suggestedMoveScoreProvider').and.returnValue('+0.42');

    expect(component.getSuggestedMoveClass('Nf3')).toBe('history-quality--great');
    expect(component.getSuggestedMoveScore('Nf3')).toBe('+0.42');
    expect(component.suggestedMoveClassProvider).toHaveBeenCalledWith('Nf3');
    expect(component.suggestedMoveScoreProvider).toHaveBeenCalledWith('Nf3');
  });

  it('returns empty score when default score provider is used', () => {
    expect(component.getSuggestedMoveScore('Nf3')).toBe('');
  });
});
