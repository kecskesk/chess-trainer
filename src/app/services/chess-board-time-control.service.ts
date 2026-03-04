import { ChangeDetectorRef, Injectable, NgZone } from '@angular/core';
import { ChessBoardUiConstants } from '../constants/chess.constants';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardClockUtils, IClockTickResult } from '../utils/chess-board-clock.utils';

@Injectable({
  providedIn: 'root'
})
export class ChessBoardTimeControlService {
  selectedClockPresetLabel = ChessBoardUiConstants.DEFAULT_CLOCK_PRESET_LABEL;
  incrementMs = 0;
  whiteClockMs = 0;
  blackClockMs = 0;
  clockStarted = false;
  clockRunning = false;
  lastClockTickAt = 0;

  applyTimeControl(
    baseMinutes: number,
    incrementSeconds: number,
    label: string
  ): void {
    const baseMs = Math.max(0, baseMinutes) * 60 * 1000;
    this.selectedClockPresetLabel = label;
    this.incrementMs = Math.max(0, incrementSeconds) * 1000;
    this.whiteClockMs = baseMs;
    this.blackClockMs = baseMs;
    this.clockStarted = false;
    this.clockRunning = false;
    this.lastClockTickAt = 0;
  }

  startClock(
    clockIntervalId: number | null,
    clockTickIntervalMs: number,
    tick: () => void,
    requestRender: () => void,
    ngZone?: NgZone
  ): number | null {
    const startResult = ChessBoardClockUtils.startClock(
      clockIntervalId,
      this.lastClockTickAt,
      clockTickIntervalMs,
      tick,
      ngZone
    );
    if (!startResult.started) {
      return clockIntervalId;
    }
    this.lastClockTickAt = startResult.lastClockTickAt;
    this.clockRunning = startResult.clockRunning;
    requestRender();
    return startResult.clockIntervalId;
  }

  stopClock(clockIntervalId: number | null, requestRender: () => void): null {
    const stopResult = ChessBoardClockUtils.stopClock(clockIntervalId);
    this.clockRunning = stopResult.clockRunning;
    requestRender();
    return stopResult.clockIntervalId;
  }

  tickClock(isGameOver: boolean, activeColor: ChessColorsEnum): IClockTickResult {
    const tickResult = ChessBoardClockUtils.tickClock(
      this.clockRunning,
      this.clockStarted,
      isGameOver,
      this.lastClockTickAt,
      activeColor,
      this.whiteClockMs,
      this.blackClockMs
    );
    if (tickResult.shouldStop) {
      return tickResult;
    }
    this.lastClockTickAt = tickResult.lastClockTickAt;
    this.whiteClockMs = tickResult.whiteClockMs;
    this.blackClockMs = tickResult.blackClockMs;
    return tickResult;
  }

  addIncrementToColor(color: ChessColorsEnum, isGameOver: boolean): void {
    const nextClocks = ChessBoardClockUtils.addIncrementToColor(
      color,
      this.clockStarted,
      this.incrementMs,
      isGameOver,
      this.whiteClockMs,
      this.blackClockMs
    );
    this.whiteClockMs = nextClocks.whiteClockMs;
    this.blackClockMs = nextClocks.blackClockMs;
  }

  requestClockRender(cdr: ChangeDetectorRef | undefined, isDestroyed: boolean): void {
    if (!cdr || isDestroyed || typeof cdr.markForCheck !== 'function') {
      return;
    }
    cdr.markForCheck();
  }
}
