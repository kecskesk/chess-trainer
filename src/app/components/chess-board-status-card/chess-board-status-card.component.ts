import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';

interface IStatusBoardState {
  colorTurn: ChessColorsEnum;
  gameOver: boolean;
  checkmateColor: ChessColorsEnum | null;
}

@Component({
  selector: 'app-chess-board-status-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-status-card.component.html',
  styleUrls: ['./chess-board-status-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChessBoardStatusCardComponent {
  @Input() uiText: typeof UiText = UiText;
  @Input() boardState: IStatusBoardState | null = null;
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

  @Output() showPossibleMoves = new EventEmitter<ChessColorsEnum | null>();
  @Output() startNewGame = new EventEmitter<void>();
  @Output() offerDraw = new EventEmitter<void>();
  @Output() acceptDraw = new EventEmitter<void>();
  @Output() declineDraw = new EventEmitter<void>();
  @Output() claimDraw = new EventEmitter<void>();
  @Output() openResignConfirm = new EventEmitter<ChessColorsEnum>();
  @Output() cancelResignConfirm = new EventEmitter<void>();
  @Output() confirmResign = new EventEmitter<void>();

  get statusTitle(): string {
    if (!this.boardState) {
      return '';
    }
    if (!this.boardState.gameOver) {
      return `${this.boardState.colorTurn} ${this.uiText.status.toMoveSuffix}`;
    }
    if (this.boardState.checkmateColor !== null) {
      return `${this.uiText.status.checkmatePrefix} - ${this.boardState.checkmateColor === ChessColorsEnum.White ? this.uiText.status.black : this.uiText.status.white} ${this.uiText.message.checkmateWinner}`;
    }
    return this.uiText.status.drawFallback;
  }

  get resignConfirmTitle(): string {
    const colorName = this.resignConfirmColor === ChessColorsEnum.White
      ? this.uiText.status.white
      : this.uiText.status.black;
    return this.uiText.resignConfirm.titleTemplate.replace('{color}', colorName);
  }
}
