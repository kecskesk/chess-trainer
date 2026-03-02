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

  it('returns start/pause labels based on running state', () => {
    component.clockRunning = false;
    expect(component.getClockButtonLabel()).toBe(component.uiText.clock.start);

    component.clockRunning = true;
    expect(component.getClockButtonLabel()).toBe(component.uiText.clock.pause);
  });

  it('formats clock with and without tenths and pads double-digit minutes', () => {
    expect(component.formatClock(500)).toBe('00:00.5');
    expect(component.formatClock(65000)).toBe('01:05');
    expect(component.formatClock(10 * 60 * 1000)).toBe('10:00');
  });
});
