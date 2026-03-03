/* istanbul ignore file */
import { AfterViewInit, Component, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragEnter, CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { ChessPieceDto } from '../../model/chess-piece.dto';
import { ChessArrowDto } from '../../model/chess-arrow.dto';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessConstants, ChessBoardUiConstants } from '../../constants/chess.constants';
import { IBoardHighlight } from '../../model/interfaces/board-highlight.interface';
import { ChessBoardComponentUtils } from '../../utils/chess-board-component.utils';
import { ChessBoardDisplayUtils } from '../../utils/chess-board-display.utils';
import { ChessPieceComponent } from '../chess-piece/chess-piece.component';
import { ChessRulesService } from '../../services/chess-rules.service';

export interface IChessBoardGridMovePreviewEvent {
  sourceRow: number;
  sourceCol: number;
  targetRow: number;
  targetCol: number;
  isValidMove: boolean;
}

@Component({
  selector: 'app-chess-board-grid',
  standalone: true,
  imports: [CommonModule, DragDropModule, ChessPieceComponent],
  templateUrl: './chess-board-grid.component.html'
})
export class ChessBoardGridComponent implements AfterViewInit {
  @Input() renderedBoardRows: number[] = [];
  @Input() renderedBoardCols: number[] = [];
  @Input() field: ChessPieceDto[][][] = [];
  @Input() boardHighlights: IBoardHighlight[] = [];
  @Input() arrows: ChessArrowDto[] = [];
  @Input() mateInOneTargets: { [key: string]: boolean } = {};
  @Input() mateInOneBlunderTargets: { [key: string]: boolean } = {};
  @Input() isBoardFlipped = false;
  @Input() previewMode = false;
  @Input() previewPreset: 'default' | 'piece-colors' = 'default';
  @Input() pieceStyle: 'font-awesome' | 'sprite-1' | 'ascii' = 'font-awesome';
  @Input() gameOver = false;
  @Input() turnColor: ChessColorsEnum = ChessColorsEnum.White;
  @Input() canDropPredicate: (drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>) => boolean = () => false;

  @Output() dropListEntered = new EventEmitter<IChessBoardGridMovePreviewEvent>();
  @Output() pieceDropped = new EventEmitter<CdkDragDrop<ChessPieceDto[]>>();
  @Output() dragStarted = new EventEmitter<void>();
  @Output() dragEnded = new EventEmitter<void>();
  @Output() squarePointerDown = new EventEmitter<ChessPieceDto | null>();

  @ViewChildren(CdkDropList) dropListElements: QueryList<CdkDropList>;
  dropLists: CdkDropList[] = [];

  ngAfterViewInit(): void {
    if (!this.dropListElements) {
      return;
    }
    setTimeout(() => {
      this.dropLists = this.dropListElements.toArray();
    }, 0);
  }

  getDisplayCell(displayRow: number, displayCol: number): ChessPieceDto[] {
    if (this.previewMode && this.previewPreset === 'piece-colors') {
      return ChessBoardComponentUtils.getPieceColorPreviewCell(
        displayRow,
        displayCol,
        this.renderedBoardRows,
        this.renderedBoardCols
      );
    }
    const { row: boardRow, col: boardCol } = ChessBoardComponentUtils.getDisplayBoardPosition(
      displayRow,
      displayCol,
      this.isBoardFlipped
    );
    const row = this.field[boardRow];
    return row ? row[boardCol] : [];
  }

  getDisplayPiece(displayRow: number, displayCol: number): ChessPieceDto | null {
    const cell = this.getDisplayCell(displayRow, displayCol);
    return cell && cell[0] ? cell[0] : null;
  }

  getDisplayFieldId(displayRow: number, displayCol: number): string {
    const { row: boardRow, col: boardCol } = ChessBoardComponentUtils.getDisplayBoardPosition(
      displayRow,
      displayCol,
      this.isBoardFlipped
    );
    return `${ChessBoardUiConstants.FIELD_ID_PREFIX}${boardRow}${boardCol}`;
  }

  getDisplaySquareHighlightClass(displayRow: number, displayCol: number): string {
    const { row: boardRow, col: boardCol } = ChessBoardComponentUtils.getDisplayBoardPosition(
      displayRow,
      displayCol,
      this.isBoardFlipped
    );
    return this.getSquareHighlightClass(boardRow, boardCol);
  }

  isDisplaySquareWhite(displayRow: number, displayCol: number): boolean {
    const { row: boardRow, col: boardCol } = ChessBoardComponentUtils.getDisplayBoardPosition(
      displayRow,
      displayCol,
      this.isBoardFlipped
    );
    return ((boardRow + boardCol) % 2) === 0;
  }

  getDisplayNotation(displayRow: number, displayCol: number): string {
    const { row: boardRow, col: boardCol } = ChessBoardComponentUtils.getDisplayBoardPosition(
      displayRow,
      displayCol,
      this.isBoardFlipped
    );
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + boardCol);
    const numberChar = ChessConstants.BOARD_SIZE - boardRow;
    return `${letterChar}${numberChar}`;
  }

  getArrowTopForDisplay(arrow: ChessArrowDto): string {
    return ChessBoardDisplayUtils.mapPercentCoordinateForDisplay(arrow ? arrow.top : '', this.isBoardFlipped);
  }

  getArrowLeftForDisplay(arrow: ChessArrowDto): string {
    return ChessBoardDisplayUtils.mapPercentCoordinateForDisplay(arrow ? arrow.left : '', this.isBoardFlipped);
  }

  getArrowTransformForDisplay(arrow: ChessArrowDto): string {
    const rotate = ChessBoardDisplayUtils.mapRotationForDisplay(arrow ? arrow.rotate : '', this.isBoardFlipped);
    return `translate(-50%, -50%) rotate(${rotate})`;
  }

  onDropListEntered(event: CdkDragEnter<ChessPieceDto[]>): void {
    if (!event || !event.item || !event.container || !event.item.dropContainer) {
      return;
    }
    const sourcePosition = ChessBoardComponentUtils.parseFieldId(event.item.dropContainer.id);
    const targetPosition = ChessBoardComponentUtils.parseFieldId(event.container.id);
    if (!sourcePosition || !targetPosition) {
      return;
    }

    const targetCell = this.field[targetPosition.row]?.[targetPosition.col];
    if (!targetCell) {
      return;
    }

    this.dropListEntered.emit({
      sourceRow: sourcePosition.row,
      sourceCol: sourcePosition.col,
      targetRow: targetPosition.row,
      targetCol: targetPosition.col,
      isValidMove: ChessRulesService.validateMove(
        targetPosition.row,
        targetPosition.col,
        targetCell,
        sourcePosition.row,
        sourcePosition.col
      ).isValid
    });
  }

  onSquarePointerDown(displayRow: number, displayCol: number): void {
    this.squarePointerDown.emit(this.getDisplayPiece(displayRow, displayCol));
  }

  private getSquareHighlightClass(targetRow: number, targetCol: number): string {
    if (this.mateInOneBlunderTargets[`${targetRow}${targetCol}`]) {
      return 'mate-one-danger';
    }
    if (this.mateInOneTargets[`${targetRow}${targetCol}`]) {
      return 'mate-one';
    }
    if (this.hasBoardHighlight(targetRow, targetCol, 'capture')) {
      return 'killer';
    }
    if (this.hasBoardHighlight(targetRow, targetCol, 'possible')) {
      return 'shaded';
    }
    return '';
  }

  private hasBoardHighlight(targetRow: number, targetCol: number, type: IBoardHighlight['type']): boolean {
    return this.boardHighlights.some(highlight => highlight.type === type && highlight.row === targetRow && highlight.col === targetCol);
  }
}
