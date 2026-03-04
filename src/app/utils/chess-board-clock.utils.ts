import { NgZone } from '@angular/core';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardUiConstants } from '../constants/chess.constants';
import { UiText } from '../constants/ui-text.constants';

export interface IClockTickResult {
  shouldStop: boolean;
  shouldRender: boolean;
  forfeitColor: ChessColorsEnum | null;
  lastClockTickAt: number;
  whiteClockMs: number;
  blackClockMs: number;
}

export interface ITimeForfeitResult {
  winnerResult: '1-0' | '0-1' | '1/2-1/2';
  debugText: string;
  appendReason: string;
}

export class ChessBoardClockUtils {
  static startClock(
    clockIntervalId: number | null,
    lastClockTickAt: number,
    tick: () => void,
    ngZone?: NgZone
  ): { started: boolean, clockIntervalId: number | null, lastClockTickAt: number, clockRunning: boolean } {
    if (clockIntervalId !== null) {
      return { started: false, clockIntervalId, lastClockTickAt, clockRunning: true };
    }

    const scheduledTick = ngZone ? () => ngZone.run(tick) : tick;
    const nextClockIntervalId = window.setInterval(scheduledTick, ChessBoardUiConstants.CLOCK_TICK_INTERVAL_MS);
    return {
      started: true,
      clockIntervalId: nextClockIntervalId,
      lastClockTickAt: Date.now(),
      clockRunning: true
    };
  }

  static stopClock(
    clockIntervalId: number | null
  ): { clockIntervalId: null, clockRunning: boolean } {
    if (clockIntervalId !== null) {
      window.clearInterval(clockIntervalId);
    }
    return { clockIntervalId: null, clockRunning: false };
  }

  static tickClock(
    clockRunning: boolean,
    clockStarted: boolean,
    isGameOver: boolean,
    lastClockTickAt: number,
    activeColor: ChessColorsEnum,
    whiteClockMs: number,
    blackClockMs: number
  ): IClockTickResult {
    if (!clockRunning || !clockStarted || isGameOver) {
      return {
        shouldStop: true,
        shouldRender: false,
        forfeitColor: null,
        lastClockTickAt,
        whiteClockMs,
        blackClockMs
      };
    }

    const now = Date.now();
    const elapsedMs = now - lastClockTickAt;
    if (elapsedMs <= 0) {
      return {
        shouldStop: false,
        shouldRender: false,
        forfeitColor: null,
        lastClockTickAt: now,
        whiteClockMs,
        blackClockMs
      };
    }

    if (activeColor === ChessColorsEnum.White) {
      const nextWhiteClockMs = Math.max(0, whiteClockMs - elapsedMs);
      return {
        shouldStop: false,
        shouldRender: true,
        forfeitColor: nextWhiteClockMs === 0 ? ChessColorsEnum.White : null,
        lastClockTickAt: now,
        whiteClockMs: nextWhiteClockMs,
        blackClockMs
      };
    }

    const nextBlackClockMs = Math.max(0, blackClockMs - elapsedMs);
    return {
      shouldStop: false,
      shouldRender: true,
      forfeitColor: nextBlackClockMs === 0 ? ChessColorsEnum.Black : null,
      lastClockTickAt: now,
      whiteClockMs,
      blackClockMs: nextBlackClockMs
    };
  }

  static addIncrementToColor(
    color: ChessColorsEnum,
    clockStarted: boolean,
    incrementMs: number,
    isGameOver: boolean,
    whiteClockMs: number,
    blackClockMs: number
  ): { whiteClockMs: number, blackClockMs: number } {
    if (!clockStarted || incrementMs <= 0 || isGameOver) {
      return { whiteClockMs, blackClockMs };
    }
    if (color === ChessColorsEnum.White) {
      return { whiteClockMs: whiteClockMs + incrementMs, blackClockMs };
    }
    return { whiteClockMs, blackClockMs: blackClockMs + incrementMs };
  }

  static handleTimeForfeit(
    loserColor: ChessColorsEnum,
    isGameOver: boolean
  ): ITimeForfeitResult | null {
    if (isGameOver) {
      return null;
    }

    const winnerColor = loserColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const winnerResult = winnerColor === ChessColorsEnum.White ? '1-0' : '0-1';
    const loserName = loserColor === ChessColorsEnum.White ? UiText.status.white : UiText.status.black;
    const forfeitReason = `${loserName} ${UiText.message.forfeitsOnTimeNoPeriod}`;
    return {
      winnerResult,
      appendReason: forfeitReason,
      debugText: `${loserName} ${UiText.message.forfeitsOnTime}`
    };
  }

  static formatClock(clockMs: number): string {
    const totalMs = Math.max(0, Math.floor(clockMs));
    const totalSeconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((totalMs % 1000) / 100);
    if (minutes >= 1) {
      return `${ChessBoardClockUtils.padToTwo(minutes)}:${ChessBoardClockUtils.padToTwo(seconds)}`;
    }
    return `${ChessBoardClockUtils.padToTwo(minutes)}:${ChessBoardClockUtils.padToTwo(seconds)}.${tenths}`;
  }

  static padToTwo(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}
