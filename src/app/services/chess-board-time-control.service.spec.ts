import { ChessBoardTimeControlService } from './chess-board-time-control.service';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';

describe('ChessBoardTimeControlService', () => {
  let service: ChessBoardTimeControlService;

  beforeEach(() => {
    service = new ChessBoardTimeControlService();
  });

  it('applyTimeControl sets expected defaults and clamps negative values', () => {
    service.applyTimeControl(-5, -2, 'custom');

    expect(service.selectedClockPresetLabel).toBe('custom');
    expect(service.incrementMs).toBe(0);
    expect(service.whiteClockMs).toBe(0);
    expect(service.blackClockMs).toBe(0);
    expect(service.clockStarted).toBeFalse();
    expect(service.clockRunning).toBeFalse();
    expect(service.lastClockTickAt).toBe(0);
  });

  it('startClock returns existing interval id when already running and does not render', () => {
    service.clockRunning = false;
    service.lastClockTickAt = 123;
    const renderSpy = jasmine.createSpy('render');

    const returnedId = service.startClock(9, () => undefined, renderSpy);

    expect(returnedId).toBe(9);
    expect(service.clockRunning).toBeFalse();
    expect(service.lastClockTickAt).toBe(123);
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('startClock starts interval, updates state, and requests render', () => {
    const renderSpy = jasmine.createSpy('render');
    const setIntervalSpy = spyOn(window, 'setInterval').and.returnValue(77 as any);
    const dateNowSpy = spyOn(Date, 'now').and.returnValue(500);

    const returnedId = service.startClock(null, () => undefined, renderSpy);

    expect(setIntervalSpy).toHaveBeenCalled();
    expect(returnedId).toBe(77);
    expect(service.clockRunning).toBeTrue();
    expect(service.lastClockTickAt).toBe(500);
    expect(renderSpy).toHaveBeenCalled();

    dateNowSpy.and.callThrough();
  });

  it('stopClock clears running state, returns null id, and requests render', () => {
    service.clockRunning = true;
    const renderSpy = jasmine.createSpy('render');
    const clearIntervalSpy = spyOn(window, 'clearInterval').and.callThrough();

    const returnedId = service.stopClock(7, renderSpy);

    expect(clearIntervalSpy).toHaveBeenCalledWith(7);
    expect(returnedId).toBeNull();
    expect(service.clockRunning).toBeFalse();
    expect(renderSpy).toHaveBeenCalled();
  });

  it('tickClock returns shouldStop when clock is not active', () => {
    service.clockRunning = false;
    service.clockStarted = true;
    service.lastClockTickAt = 100;
    service.whiteClockMs = 1000;
    service.blackClockMs = 1000;

    const tickResult = service.tickClock(false, ChessColorsEnum.White);

    expect(tickResult.shouldStop).toBeTrue();
    expect(service.lastClockTickAt).toBe(100);
    expect(service.whiteClockMs).toBe(1000);
    expect(service.blackClockMs).toBe(1000);
  });

  it('tickClock updates white side and reports white forfeit at zero', () => {
    service.clockRunning = true;
    service.clockStarted = true;
    service.lastClockTickAt = 100;
    service.whiteClockMs = 100;
    service.blackClockMs = 1000;
    const dateNowSpy = spyOn(Date, 'now').and.returnValue(250);

    const tickResult = service.tickClock(false, ChessColorsEnum.White);

    expect(tickResult.shouldStop).toBeFalse();
    expect(tickResult.forfeitColor).toBe(ChessColorsEnum.White);
    expect(service.whiteClockMs).toBe(0);
    expect(service.blackClockMs).toBe(1000);
    expect(service.lastClockTickAt).toBe(250);

    dateNowSpy.and.callThrough();
  });

  it('addIncrementToColor applies increment only when allowed', () => {
    service.clockStarted = true;
    service.incrementMs = 2000;
    service.whiteClockMs = 3000;
    service.blackClockMs = 4000;

    service.addIncrementToColor(ChessColorsEnum.Black, false);
    expect(service.whiteClockMs).toBe(3000);
    expect(service.blackClockMs).toBe(6000);

    service.clockStarted = false;
    service.addIncrementToColor(ChessColorsEnum.White, false);
    expect(service.whiteClockMs).toBe(3000);
    expect(service.blackClockMs).toBe(6000);
  });

  it('requestClockRender calls markForCheck only when valid', () => {
    const cdr = { markForCheck: jasmine.createSpy('markForCheck') } as any;

    service.requestClockRender(undefined, false);
    service.requestClockRender(cdr, true);
    service.requestClockRender({} as any, false);
    expect(cdr.markForCheck).not.toHaveBeenCalled();

    service.requestClockRender(cdr, false);
    expect(cdr.markForCheck).toHaveBeenCalled();
  });
});
