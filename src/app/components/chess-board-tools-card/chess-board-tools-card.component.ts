import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ChessMoveBadgeUtils } from '../../utils/chess-move-badge.utils';

@Component({
  selector: 'app-chess-board-tools-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-tools-card.component.html',
  styleUrls: ['./chess-board-tools-card.component.less']
})
export class ChessBoardToolsCardComponent {
  readonly uiText = UiText;
  @Input() activeTool: string | null = null;
  @Input() isBoardFlipped = false;
  @Input() canPromote = false;
  @Input() suggestedMoves: string[] = [];
  @Input() suggestedMoveQualityByMove: Record<string, string> = {};
  @Input() suggestedMoveEvalByMove: Record<string, string> = {};
  @Input() openingRecognition = '';
  @Input() endgameRecognition = '';

  @Output() promotePiece = new EventEmitter<string>();
  @Output() showThreats = new EventEmitter<boolean>();
  @Output() showProtected = new EventEmitter<boolean>();
  @Output() showHangingPieces = new EventEmitter<boolean>();
  @Output() showForkIdeas = new EventEmitter<void>();
  @Output() showPinIdeas = new EventEmitter<void>();
  @Output() toggleBoardFlip = new EventEmitter<void>();
  @Output() exportPgn = new EventEmitter<void>();
  @Output() exportBoardImage = new EventEmitter<void>();
  @Output() exportFen = new EventEmitter<void>();
  @Output() previewMove = new EventEmitter<string>();
  @Output() clearPreview = new EventEmitter<void>();

  getSuggestedMoveClass(move: string): string {
    return ChessMoveBadgeUtils.getMoveClass(move, this.suggestedMoveQualityByMove, 'suggested-move--threat');
  }

  getSuggestedMoveScore(move: string): string {
    return ChessMoveBadgeUtils.getMoveScore(move, this.suggestedMoveEvalByMove);
  }
}
