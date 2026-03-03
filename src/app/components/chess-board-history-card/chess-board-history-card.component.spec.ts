import { ChessBoardHistoryCardComponent } from './chess-board-history-card.component';
import { ElementRef } from '@angular/core';

describe('ChessBoardHistoryCardComponent', () => {
  let component: ChessBoardHistoryCardComponent;

  beforeEach(() => {
    component = new ChessBoardHistoryCardComponent();
  });

  it('returns null history element when view child is not initialized', () => {
    expect(component.getHistoryElement()).toBeNull();
  });

  it('returns evaluation by index with fallback', () => {
    component.evaluations = ['+0.10', '-0.20'];
    component.naPlaceholder = 'n/a';
    expect(component.getEvaluationForMove(0)).toBe('+0.10');
    expect(component.getEvaluationForMove(1)).toBe('-0.20');
    expect(component.getEvaluationForMove(2)).toBe('n/a');
    expect(component.getEvaluationForMove(-1)).toBe('n/a');
  });

  it('returns quality label/class for valid and invalid history indexes', () => {
    component.evaluations = ['+1.00', '+0.00'];
    expect(component.getMoveQualityLabel(1)).toBe('great');
    expect(component.getMoveQualityClass(1)).toBe('history-quality--great');
    expect(component.getMoveQualityLabel(10)).toBe('');
    expect(component.getMoveQualityClass(10)).toBe('');
  });

  it('falls back to na placeholder for empty-string evaluation entry', () => {
    component.evaluations = [''];
    component.naPlaceholder = 'n/a';
    expect(component.getEvaluationForMove(0)).toBe('n/a');
  });

  it('returns history native element when view child exists', () => {
    const el = document.createElement('div');
    (component as any).historyLogRef = new ElementRef<HTMLDivElement>(el);
    expect(component.getHistoryElement()).toBe(el);
  });
});
