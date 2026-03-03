import { NgZone } from '@angular/core';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardClockUtils, IClockTickResult, ITimeForfeitResult } from './chess-board-clock.utils';

export class ChessBoardClockGameStateFacade {
  static canOfferDraw(gameOver: boolean, pendingDrawOfferBy: ChessColorsEnum | null): boolean {
    return !gameOver && pendingDrawOfferBy === null;
  }

  static canRespondToDrawOffer(
    gameOver: boolean,
    pendingDrawOfferBy: ChessColorsEnum | null,
    turnColor: ChessColorsEnum
  ): boolean {
    if (gameOver || pendingDrawOfferBy === null) {
      return false;
    }
    return pendingDrawOfferBy !== turnColor;
  }

  static getClaimDrawReason(isThreefoldRepetition: boolean, isFiftyMoveRule: boolean): 'threefold' | 'fifty-move' | null {
    if (isThreefoldRepetition) {
      return 'threefold';
    }
    if (isFiftyMoveRule) {
      return 'fifty-move';
    }
    return null;
  }

  static canResign(gameOver: boolean, color: ChessColorsEnum): boolean {
    if (gameOver) {
      return false;
    }
    return color === ChessColorsEnum.White || color === ChessColorsEnum.Black;
  }

  static getAppliedTimeControl(baseMinutes: number, incrementSeconds: number, label: string): {
    selectedClockPresetLabel: string;
    incrementMs: number;
    whiteClockMs: number;
    blackClockMs: number;
    clockStarted: boolean;
    clockRunning: boolean;
    lastClockTickAt: number;
  } {
    const baseMs = Math.max(0, baseMinutes) * 60 * 1000;
    return {
      selectedClockPresetLabel: label,
      incrementMs: Math.max(0, incrementSeconds) * 1000,
      whiteClockMs: baseMs,
      blackClockMs: baseMs,
      clockStarted: false,
      clockRunning: false,
      lastClockTickAt: 0
    };
  }

  static canToggleClock(gameOver: boolean): boolean {
    return !gameOver;
  }

  static startClock(
    clockIntervalId: number | null,
    lastClockTickAt: number,
    clockTickIntervalMs: number,
    tick: () => void,
    ngZone?: NgZone
  ): { started: boolean, clockIntervalId: number | null, lastClockTickAt: number, clockRunning: boolean } {
    return ChessBoardClockUtils.startClock(clockIntervalId, lastClockTickAt, clockTickIntervalMs, tick, ngZone);
  }

  static stopClock(clockIntervalId: number | null): { clockIntervalId: null, clockRunning: boolean } {
    return ChessBoardClockUtils.stopClock(clockIntervalId);
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
    return ChessBoardClockUtils.tickClock(
      clockRunning,
      clockStarted,
      isGameOver,
      lastClockTickAt,
      activeColor,
      whiteClockMs,
      blackClockMs
    );
  }

  static addIncrementToColor(
    color: ChessColorsEnum,
    clockStarted: boolean,
    incrementMs: number,
    isGameOver: boolean,
    whiteClockMs: number,
    blackClockMs: number
  ): { whiteClockMs: number, blackClockMs: number } {
    return ChessBoardClockUtils.addIncrementToColor(color, clockStarted, incrementMs, isGameOver, whiteClockMs, blackClockMs);
  }

  static handleTimeForfeit(
    loserColor: ChessColorsEnum,
    isGameOver: boolean,
    whiteLabel: string,
    blackLabel: string,
    forfeitsOnTimeText: string,
    forfeitsOnTimeNoPeriodText: string
  ): ITimeForfeitResult | null {
    return ChessBoardClockUtils.handleTimeForfeit(
      loserColor,
      isGameOver,
      whiteLabel,
      blackLabel,
      forfeitsOnTimeText,
      forfeitsOnTimeNoPeriodText
    );
  }
}
