import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';

@Component({
  selector: 'app-chess-board-clock-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-clock-card.component.html',
  styleUrls: ['./chess-board-clock-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChessBoardClockCardComponent {
  @Input() uiText: typeof UiText = UiText;
  @Input() selectedLocale = '';
  @Input() chessColors: typeof ChessColorsEnum = ChessColorsEnum;
  @Input() selectedClockPresetLabel = '';
  @Input() clockStarted = false;
  @Input() clockRunning = false;
  @Input() blackClockMs = 0;
  @Input() whiteClockMs = 0;
  @Input() analysisMeterOffsetPercent = 50;
  @Input() currentAnalysisEvalText = 'n/a';
  @Input() isBlackClockActive = false;
  @Input() isWhiteClockActive = false;
  @Input() isBlackClockLow = false;
  @Input() isWhiteClockLow = false;

  @Output() timeControlChange = new EventEmitter<{ baseMinutes: number; incrementSeconds: number; label: string }>();
  @Output() toggleClock = new EventEmitter<void>();
  @Output() resetClock = new EventEmitter<void>();

  onPreset(baseMinutes: number, incrementSeconds: number, label: string): void {
    this.timeControlChange.emit({ baseMinutes, incrementSeconds, label });
  }

  getClockButtonLabel(): string {
    return this.clockRunning ? this.uiText.clock.pause : this.uiText.clock.start;
  }

  formatClock(clockMs: number): string {
    const totalMs = Math.max(0, Math.floor(clockMs));
    const totalSeconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((totalMs % 1000) / 100);
    if (minutes >= 1) {
      return `${this.padToTwo(minutes)}:${this.padToTwo(seconds)}`;
    }
    return `${this.padToTwo(minutes)}:${this.padToTwo(seconds)}.${tenths}`;
  }

  private padToTwo(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}
