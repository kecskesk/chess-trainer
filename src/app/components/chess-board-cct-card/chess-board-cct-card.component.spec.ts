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
    expect(component.getMoveClass('Nf3')).toBe('suggested-move--threat');
    expect(component.getMoveScore('Nf3')).toBe('');
  });

  it('uses provided move quality and score maps when present', () => {
    component.moveQualityByMove = { Nf3: 'history-quality--great' };
    component.moveEvalByMove = { Nf3: '+0.35' };
    expect(component.getMoveClass('Nf3')).toBe('history-quality--great');
    expect(component.getMoveScore('Nf3')).toBe('+0.35');
  });

  it('returns empty defaults for empty move input', () => {
    expect(component.getMoveClass('')).toBe('');
    expect(component.getMoveScore('')).toBe('');
  });
});
