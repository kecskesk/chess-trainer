import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ChessBoardEvaluationUtils } from '../../utils/chess-board-evaluation.utils';

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
  @Input() evaluations: string[] = [];
  @Input() pendingEvaluationPlaceholder = '...';
  @Input() evaluationErrorPlaceholder = 'err';
  @Input() naPlaceholder = 'n/a';
  @Input() analysisClampPawns = 10;

  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();

  @ViewChild('historyLog') historyLogRef!: ElementRef<HTMLDivElement>;

  getMoveQualityLabel(halfMoveIndex: number): string {
    const quality = this.getMoveQuality(halfMoveIndex);
    return quality ? quality.label : '';
  }

  getMoveQualityClass(halfMoveIndex: number): string {
    const quality = this.getMoveQuality(halfMoveIndex);
    return quality ? quality.className : '';
  }

  getEvaluationForMove(halfMoveIndex: number): string {
    if (halfMoveIndex < 0 || halfMoveIndex >= this.evaluations.length) {
      return this.naPlaceholder;
    }
    return this.evaluations[halfMoveIndex] || this.naPlaceholder;
  }

  getHistoryElement(): HTMLDivElement | null {
    return this.historyLogRef?.nativeElement ?? null;
  }

  private getMoveQuality(halfMoveIndex: number): { label: string; className: string } | null {
    return ChessBoardEvaluationUtils.getMoveQuality(
      halfMoveIndex,
      (idx) => this.getEvaluationForMove(idx),
      this.pendingEvaluationPlaceholder,
      this.evaluationErrorPlaceholder,
      this.naPlaceholder,
      this.analysisClampPawns
    );
  }
}
