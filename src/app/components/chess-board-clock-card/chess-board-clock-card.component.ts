import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessHandicapEnum } from '../../model/enums/chess-handicap.enum';
import { ChessBoardClockUtils } from '../../utils/chess-board-clock.utils';

@Component({
  selector: 'app-chess-board-clock-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-clock-card.component.html',
  styleUrls: ['./chess-board-clock-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChessBoardClockCardComponent {
  readonly uiText = UiText;
  @Input() selectedLocale = '';
  @Input() chessColors: typeof ChessColorsEnum = ChessColorsEnum;
  @Input() selectedClockPresetLabel = '';
  @Input() clockStarted = false;
  @Input() clockRunning = false;
  @Input() blackClockMs = 0;
  @Input() whiteClockMs = 0;
  @Input() analysisMeterOffsetPercent = 50;
  @Input() currentAnalysisEvalText = 'n/a';
  @Input() turnColor: ChessColorsEnum = ChessColorsEnum.White;
  @Input() isGameOver = false;
  @Input() selectedHandicap: ChessHandicapEnum = ChessHandicapEnum.None;
  @Input() whiteHasInfiniteTime = false;

  @Output() timeControlChange = new EventEmitter<{ baseMinutes: number; incrementSeconds: number; label: string }>();
  @Output() handicapChange = new EventEmitter<ChessHandicapEnum>();
  @Output() toggleClock = new EventEmitter<void>();
  @Output() resetClock = new EventEmitter<void>();

  readonly handicapOptions: { value: ChessHandicapEnum; label: string }[] = [
    { value: ChessHandicapEnum.None, label: 'No handicap' },
    { value: ChessHandicapEnum.DoubleTime, label: '2x time for me' },
    { value: ChessHandicapEnum.InfiniteTime, label: 'Infinite time for me' },
    { value: ChessHandicapEnum.MinusPawns, label: 'I have minus pawns' },
    { value: ChessHandicapEnum.NoRook, label: 'I have no rook' },
    { value: ChessHandicapEnum.NoQueen, label: 'I have no queen' }
  ];

  onPreset(baseMinutes: number, incrementSeconds: number, label: string): void {
    this.timeControlChange.emit({ baseMinutes, incrementSeconds, label });
  }

  getClockButtonLabel(): string {
    return this.clockRunning ? this.uiText.clock.pause : this.uiText.clock.start;
  }

  formatClock(clockMs: number): string {
    return ChessBoardClockUtils.formatClock(clockMs);
  }

  onHandicapSelect(value: ChessHandicapEnum): void {
    this.handicapChange.emit(value);
  }

  formatPlayerClock(clockMs: number, isInfinite: boolean): string {
    if (isInfinite) {
      return 'INF';
    }
    return this.formatClock(clockMs);
  }

  get isBlackClockActive(): boolean {
    return this.isClockActive(this.chessColors.Black);
  }

  get isWhiteClockActive(): boolean {
    return this.isClockActive(this.chessColors.White);
  }

  get isBlackClockLow(): boolean {
    return this.isClockLow(this.chessColors.Black);
  }

  get isWhiteClockLow(): boolean {
    return this.isClockLow(this.chessColors.White);
  }

  private isClockActive(color: ChessColorsEnum): boolean {
    if (!this.clockRunning || !this.clockStarted || this.isGameOver) {
      return false;
    }
    return this.turnColor === color;
  }

  private isClockLow(color: ChessColorsEnum): boolean {
    const remainingTimeRaw = color === ChessColorsEnum.White ? this.whiteClockMs : this.blackClockMs;
    const remainingTime = Number.isFinite(remainingTimeRaw) ? remainingTimeRaw : 0;
    return remainingTime <= 10000;
  }
}
