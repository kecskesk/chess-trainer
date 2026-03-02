import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ICctRecommendation } from '../../model/interfaces/cct-recommendation.interface';

@Component({
  selector: 'app-chess-board-cct-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-cct-card.component.html',
  styleUrls: ['./chess-board-cct-card.component.less']
})
export class ChessBoardCctCardComponent {
  @Input() uiText: typeof UiText = UiText;
  @Input() captures: ICctRecommendation[] = [];
  @Input() checks: ICctRecommendation[] = [];
  @Input() threats: ICctRecommendation[] = [];

  @Output() previewMove = new EventEmitter<string>();
  @Output() clearPreview = new EventEmitter<void>();
}
