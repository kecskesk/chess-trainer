import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';

@Component({
  selector: 'app-chess-board-clock-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-clock-card.component.html',
  styleUrls: ['./chess-board-clock-card.component.less']
})
export class ChessBoardClockCardComponent {
  @Input() uiText: typeof UiText = UiText;
  @Input() chessColors: typeof ChessColorsEnum = ChessColorsEnum;
  @Input() selectedClockPresetLabel = '';
  @Input() clockStarted = false;
  @Input() blackClockMs = 0;
  @Input() whiteClockMs = 0;
  @Input() getAnalysisMeterOffsetPercent!: () => number;
  @Input() getCurrentAnalysisEvalText!: () => string;
  @Input() isClockActive!: (color: ChessColorsEnum) => boolean;
  @Input() isClockLow!: (color: ChessColorsEnum) => boolean;
  @Input() formatClock!: (clockMs: number) => string;
  @Input() getClockButtonLabel!: () => string;

  @Output() timeControlChange = new EventEmitter<{ baseMinutes: number; incrementSeconds: number; label: string }>();
  @Output() toggleClock = new EventEmitter<void>();
  @Output() resetClock = new EventEmitter<void>();

  onPreset(baseMinutes: number, incrementSeconds: number, label: string): void {
    this.timeControlChange.emit({ baseMinutes, incrementSeconds, label });
  }
}
