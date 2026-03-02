import { ChessBoardClockCardComponent } from './chess-board-clock-card.component';

describe('ChessBoardClockCardComponent', () => {
  let component: ChessBoardClockCardComponent;

  beforeEach(() => {
    component = new ChessBoardClockCardComponent();
  });

  it('emits selected time control preset payload', () => {
    const emitSpy = spyOn(component.timeControlChange, 'emit');

    component.onPreset(3, 2, '3+2');

    expect(emitSpy).toHaveBeenCalledWith({ baseMinutes: 3, incrementSeconds: 2, label: '3+2' });
  });
});