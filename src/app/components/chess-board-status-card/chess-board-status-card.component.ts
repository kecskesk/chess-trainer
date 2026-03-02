import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';

@Component({
  selector: 'app-chess-board-status-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-status-card.component.html',
  styleUrls: ['./chess-board-status-card.component.less']
})
export class ChessBoardStatusCardComponent {
  @Input() uiText: typeof UiText = UiText;
  @Input() statusTitle = '';
  @Input() currentTurnColor: ChessColorsEnum | null = null;
  @Input() pendingDrawOfferBy: ChessColorsEnum | null = null;
  @Input() clockRunning = false;
  @Input() resignConfirmColor: ChessColorsEnum | null = null;
  @Input() chessColors: typeof ChessColorsEnum = ChessColorsEnum;
  @Input() canOfferDraw = false;
  @Input() canRespondToDrawOffer = false;
  @Input() canClaimDraw = false;
  @Input() canResignWhite = false;
  @Input() canResignBlack = false;
  @Input() resignConfirmTitle = '';

  @Output() showPossibleMoves = new EventEmitter<ChessColorsEnum | null>();
  @Output() startNewGame = new EventEmitter<void>();
  @Output() offerDraw = new EventEmitter<void>();
  @Output() acceptDraw = new EventEmitter<void>();
  @Output() declineDraw = new EventEmitter<void>();
  @Output() claimDraw = new EventEmitter<void>();
  @Output() openResignConfirm = new EventEmitter<ChessColorsEnum>();
  @Output() cancelResignConfirm = new EventEmitter<void>();
  @Output() confirmResign = new EventEmitter<void>();
}
