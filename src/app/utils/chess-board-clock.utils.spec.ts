import { ChessBoardClockUtils } from './chess-board-clock.utils';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { NgZone } from '@angular/core';
import { UiText } from '../constants/ui-text.constants';

describe('ChessBoardClockUtils formatting', () => {
  it('pads values to two digits', () => {
    expect(ChessBoardClockUtils.padToTwo(0)).toBe('00');
    expect(ChessBoardClockUtils.padToTwo(9)).toBe('09');
    expect(ChessBoardClockUtils.padToTwo(10)).toBe('10');
  });

  it('formats clock with and without tenths', () => {
    expect(ChessBoardClockUtils.formatClock(500)).toBe('00:00.5');
    expect(ChessBoardClockUtils.formatClock(65000)).toBe('01:05');
    expect(ChessBoardClockUtils.formatClock(10 * 60 * 1000)).toBe('10:00');
    expect(ChessBoardClockUtils.formatClock(Number.NaN)).toBe('00:00.0');
    expect(ChessBoardClockUtils.formatClock(Number.POSITIVE_INFINITY)).toBe('00:00.0');
  });
});

describe('ChessBoardClockUtils interval lifecycle', () => {
  it('starts and stops clock intervals', () => {
    const tick = jasmine.createSpy('tick');
    let scheduledTick: TimerHandler | null = null;
    const setIntervalSpy = spyOn(window, 'setInterval').and.callFake((handler: TimerHandler) => {
      scheduledTick = handler;
      return 9 as any;
    });
    spyOn(Date, 'now').and.returnValue(500);
    const startResult = ChessBoardClockUtils.startClock(
      null,
      0,
      tick
    );
    expect(startResult.started).toBeTrue();
    expect(startResult.clockIntervalId).toBe(9);
    expect(startResult.lastClockTickAt).toBe(500);
    expect(startResult.clockRunning).toBeTrue();
    expect(scheduledTick).not.toBeNull();
    expect(setIntervalSpy).toHaveBeenCalled();

    const stopSpy = spyOn(window, 'clearInterval').and.callThrough();
    const stopResult = ChessBoardClockUtils.stopClock(9);
    expect(stopSpy).toHaveBeenCalledWith(9 as any);
    expect(stopResult.clockIntervalId).toBeNull();
    expect(stopResult.clockRunning).toBeFalse();
  });

  it('covers start/stop guard branches and ngZone scheduling', () => {
    const alreadyRunning = ChessBoardClockUtils.startClock(5, 100, () => undefined);
    expect(alreadyRunning.started).toBeFalse();
    expect(alreadyRunning.clockIntervalId).toBe(5);

    let ran = false;
    const zone = {
      run: (fn: () => void) => fn()
    } as unknown as NgZone;
    let handler: TimerHandler | null = null;
    spyOn(Date, 'now').and.returnValue(10);
    spyOn(window, 'setInterval').and.callFake((tick: TimerHandler) => {
      handler = tick;
      return 1 as any;
    });
    ChessBoardClockUtils.startClock(
      null,
      0,
      () => {
        ran = true;
      },
      zone
    );
    if (typeof handler === 'function') {
      handler();
    }
    expect(ran).toBeTrue();

    const stopped = ChessBoardClockUtils.stopClock(null);
    expect(stopped.clockRunning).toBeFalse();
  });
});

describe('ChessBoardClockUtils tick behavior', () => {
  it('ticks the active side and marks forfeits', () => {
    spyOn(Date, 'now').and.returnValue(1600);
    const tickWhite = ChessBoardClockUtils.tickClock(
      true,
      true,
      false,
      1000,
      ChessColorsEnum.White,
      1200,
      2500
    );
    expect(tickWhite.whiteClockMs).toBe(600);
    expect(tickWhite.blackClockMs).toBe(2500);
    expect(tickWhite.forfeitColor).toBeNull();

    const tickBlackForfeit = ChessBoardClockUtils.tickClock(
      true,
      true,
      false,
      1000,
      ChessColorsEnum.Black,
      1200,
      300
    );
    expect(tickBlackForfeit.blackClockMs).toBe(0);
    expect(tickBlackForfeit.forfeitColor).toBe(ChessColorsEnum.Black);
  });

  it('covers tick early-return and non-progress branches', () => {
    const nowSpy = spyOn(Date, 'now').and.returnValue(1001);
    const stopped = ChessBoardClockUtils.tickClock(
      false,
      true,
      false,
      1000,
      ChessColorsEnum.White,
      1000,
      1000
    );
    expect(stopped.shouldStop).toBeTrue();

    nowSpy.and.returnValue(1000);
    const nonProgress = ChessBoardClockUtils.tickClock(
      true,
      true,
      false,
      1000,
      ChessColorsEnum.White,
      1000,
      1000
    );
    expect(nonProgress.shouldRender).toBeFalse();
    expect(nonProgress.shouldStop).toBeFalse();
  });

});

describe('ChessBoardClockUtils increment and forfeit behavior', () => {
  it('adds increment and formats time-forfeit result', () => {
    const incrementedWhite = ChessBoardClockUtils.addIncrementToColor(
      ChessColorsEnum.White,
      true,
      2000,
      false,
      10000,
      10000
    );
    expect(incrementedWhite.whiteClockMs).toBe(12000);
    expect(incrementedWhite.blackClockMs).toBe(10000);

    const noIncrement = ChessBoardClockUtils.addIncrementToColor(
      ChessColorsEnum.Black,
      false,
      2000,
      false,
      10000,
      10000
    );
    expect(noIncrement.blackClockMs).toBe(10000);

    UiText.status.white = 'White';
    UiText.status.black = 'Black';
    UiText.message.forfeitsOnTime = 'forfeits on time.';
    UiText.message.forfeitsOnTimeNoPeriod = 'forfeits on time';
    const forfeit = ChessBoardClockUtils.handleTimeForfeit(
      ChessColorsEnum.White,
      false
    );
    expect(forfeit).not.toBeNull();
    expect(forfeit?.winnerResult).toBe('0-1');
    expect(forfeit?.debugText).toBe('White forfeits on time.');

    const blackForfeit = ChessBoardClockUtils.handleTimeForfeit(
      ChessColorsEnum.Black,
      false
    );
    expect(blackForfeit?.winnerResult).toBe('1-0');

    expect(
      ChessBoardClockUtils.handleTimeForfeit(
        ChessColorsEnum.Black,
        true
      )
    ).toBeNull();

    const blackIncrement = ChessBoardClockUtils.addIncrementToColor(
      ChessColorsEnum.Black,
      true,
      500,
      false,
      1000,
      1000
    );
    expect(blackIncrement.blackClockMs).toBe(1500);

    const guardIncrement = ChessBoardClockUtils.addIncrementToColor(
      ChessColorsEnum.White,
      true,
      500,
      true,
      1000,
      1000
    );
    expect(guardIncrement.whiteClockMs).toBe(1000);
  });
});
