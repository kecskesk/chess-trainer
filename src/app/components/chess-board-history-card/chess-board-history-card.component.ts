import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';

@Component({
  selector: 'app-chess-board-history-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-history-card.component.html',
  styleUrls: ['./chess-board-history-card.component.less']
})
export class ChessBoardHistoryCardComponent {
  @Input() uiText: typeof UiText = UiText;
  @Input() canUndo = false;
  @Input() canRedo = false;
  @Input() visibleHistory: string[] = [];
  @Input() getMoveQualityClass!: (halfMoveIndex: number) => string;
  @Input() getMoveQualityLabel!: (halfMoveIndex: number) => string;
  @Input() getEvaluationForMove!: (halfMoveIndex: number) => string;

  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();

  @ViewChild('historyLog') historyLogRef!: ElementRef<HTMLDivElement>;

  getHistoryElement(): HTMLDivElement | null {
    return this.historyLogRef?.nativeElement ?? null;
  }
}
