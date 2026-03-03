import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ChessBoardEvaluationUtils } from '../../utils/chess-board-evaluation.utils';
import { ChessBoardTimelineFacade } from '../../utils/chess-board-timeline.facade';

@Component({
  selector: 'app-chess-board-history-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-history-card.component.html',
  styleUrls: ['./chess-board-history-card.component.less']
})
export class ChessBoardHistoryCardComponent {
  @Input() uiText: typeof UiText = UiText;
  @Input() history: string[] = [];
  @Input() historyCursor: number | null = null;
  @Input() maxMoveIndex = -1;
  @Input() evaluations: string[] = [];
  @Input() pendingEvaluationPlaceholder = '...';
  @Input() evaluationErrorPlaceholder = 'err';
  @Input() naPlaceholder = 'n/a';
  @Input() analysisClampPawns = 10;

  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();

  @ViewChild('historyLog') historyLogRef!: ElementRef<HTMLDivElement>;

  get visibleHistory(): string[] {
    return ChessBoardTimelineFacade.getVisibleHistory(this.history || [], this.historyCursor);
  }

  get canUndo(): boolean {
    return ChessBoardTimelineFacade.canUndoMove(this.maxMoveIndex, this.historyCursor);
  }

  get canRedo(): boolean {
    return ChessBoardTimelineFacade.canRedoMove(this.maxMoveIndex, this.historyCursor);
  }

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
