import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragEnter, CdkDragStart, CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChessArrowDto } from 'src/app/model/chess-arrow.dto';
import { ChessPieceDto } from 'src/app/model/chess-piece.dto';
import { ChessBoardStateService } from '../../services/chess-board-state.service';
import { ChessRulesService } from '../../services/chess-rules.service';
import { ChessPositionDto } from '../../model/chess-position.dto';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../../model/enums/chess-pieces.enum';
import { IBoardHighlight } from '../../model/interfaces/board-highlight.interface';
import { IVisualizationArrow } from '../../model/interfaces/visualization-arrow.interface';
import { CctCategoryEnum } from '../../model/enums/cct-category.enum';
import { ICctRecommendation, ICctRecommendationScored } from '../../model/interfaces/cct-recommendation.interface';
import { IOpeningAssetItem } from '../../model/interfaces/opening-asset-item.interface';
import { IParsedOpening } from '../../model/interfaces/parsed-opening.interface';
import { ChessMoveNotation } from '../../utils/chess-utils';
import { ChessBoardMessageConstants, ChessBoardUiConstants, ChessConstants } from '../../constants/chess.constants';
import { UiText } from '../../constants/ui-text.constants';
import { ChessPieceComponent } from '../chess-piece/chess-piece.component';
import { UiTextLoaderService } from '../../services/ui-text-loader.service';

interface IBoardHelperSnapshot {
  debugText: string;
  history: {[name: string]: string};
  colorTurn: ChessColorsEnum;
  canPromote: number | null;
  justDidEnPassant: ChessPositionDto | null;
  justDidCastle: ChessPositionDto | null;
  gameOver: boolean;
  checkmateColor: ChessColorsEnum | null;
}

interface IGameplaySnapshot {
  field: ChessPieceDto[][][];
  boardHelper: IBoardHelperSnapshot;
  repetitionCounts: {[positionKey: string]: number};
  trackedHistoryLength: number;
  pendingDrawOfferBy: ChessColorsEnum | null;
  clockStarted: boolean;
  clockRunning: boolean;
  whiteClockMs: number;
  blackClockMs: number;
}

@Component({
  selector: 'app-chess-board',
  templateUrl: './chess-board.component.html',
  styleUrls: ['./chess-board.component.less'],
  standalone: true,
  imports: [CommonModule, DragDropModule, ChessPieceComponent]
})
export class ChessBoardComponent implements AfterViewInit, OnDestroy {
  private static readonly NA_PLACEHOLDER = 'n/a';
  readonly uiText = UiText;
  readonly boardIndices: number[] = Array.from({ length: ChessConstants.BOARD_SIZE }, (_, idx) => idx);
  @ViewChild('chessField') chessField: ElementRef;
  @ViewChildren(CdkDropList) dropListElements: QueryList<CdkDropList>;

  dropLists: CdkDropList[] = [];
  mateInOneTargets: {[key: string]: boolean} = {};
  mateInOneBlunderTargets: {[key: string]: boolean} = {};
  isDragPreviewActive = false;
  private lastMatePreviewKey = '';
  private repetitionCounts: {[positionKey: string]: number} = {};
  private trackedHistoryLength = -1;
  private moveSnapshots: IGameplaySnapshot[] = [];
  private isFinalizingDropState = false;
  chessColors = ChessColorsEnum;
  clockPresets: {label: string; baseMinutes: number; incrementSeconds: number}[] = ChessBoardUiConstants.CLOCK_PRESETS;
  selectedClockPresetLabel = ChessBoardUiConstants.DEFAULT_CLOCK_PRESET_LABEL;
  whiteClockMs = 0;
  blackClockMs = 0;
  clockRunning = false;
  clockStarted = false;
  private clockIntervalId: number | null = null;
  private lastClockTickAt = 0;
  private incrementMs = 0;
  private readonly clockTickIntervalMs = ChessBoardUiConstants.CLOCK_TICK_INTERVAL_MS;
  pendingDrawOfferBy: ChessColorsEnum | null = null;
  resignConfirmColor: ChessColorsEnum | null = null;
  mockHistoryCursor: number | null = null;
  isBoardFlipped = false;
  mockExportMessage = '';
  areMockControlsDisabled = true;
  isDebugPanelOpen = false;
  selectedLocale = UiTextLoaderService.DEFAULT_LOCALE;
  isLanguageSwitching = false;
  private isDestroyed = false;

  /**
   * Used by the UI to indicate which visualization toggle is currently active.
   * null means nothing is active.
   */
  activeTool: string | null = null;

  cctCategory = CctCategoryEnum;
  private readonly debugPanelStorageKey = ChessBoardUiConstants.DEBUG_PANEL_STORAGE_KEY;
  private readonly windowRef: Pick<Window, 'location'> = window;
  private cctRecommendationsCacheKey = '';
  private cctRecommendationsCache: Record<CctCategoryEnum, ICctRecommendation[]> = {
    [CctCategoryEnum.Captures]: [],
    [CctCategoryEnum.Checks]: [],
    [CctCategoryEnum.Threats]: []
  };
  private readonly mockEvalCycle: string[] = [
    '+0.1', '+0.3', '+0.0', '-0.2', '+0.5', '+0.8', '-0.1', '+1.1'
  ];
  openingsLoaded = false;
  private openings: IParsedOpening[] = [];
  private activeOpening: IParsedOpening | null = null;
  private activeOpeningHistoryKey = '';
  private openingsLoadId = 0;
  private suggestedMoveArrowSnapshot: Record<string, ChessArrowDto> | null = null;
  ambientStyle: {[key: string]: string} = {};
  canDropPredicate = (drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean =>
    this.canDrop(drag, drop);

  constructor(
    public chessBoardStateService: ChessBoardStateService,
    private readonly http: HttpClient,
    private readonly ngZone?: NgZone,
    private readonly cdr?: ChangeDetectorRef,
    private readonly uiTextLoaderService?: UiTextLoaderService
  ) {
    this.randomizeAmbientStyle();
    this.applyTimeControl(5, 0, ChessBoardUiConstants.DEFAULT_CLOCK_PRESET_LABEL);
    this.isDebugPanelOpen = this.readDebugPanelOpenState();
    if (this.uiTextLoaderService) {
      this.selectedLocale = this.uiTextLoaderService.getCurrentLocale();
    }
    this.initializeSnapshotTimeline();
    void this.loadOpeningsFromAssets(this.selectedLocale);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.stopClock();
    this.syncFlippedDragClass();
  }

  ngAfterViewInit(): void {
    if (this.dropListElements) {
      setTimeout(() => {
        this.dropLists = this.dropListElements.toArray();
      }, 0);
    }
  }

  canDrop(drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    if (this.chessBoardStateService.boardHelper.gameOver) {
      this.setSubtleDebugReason(ChessBoardMessageConstants.GAME_OVER_NO_MOVES);
      return false;
    }
    if (!drag || !drop || !drag.dropContainer || !drop.data || !drag.dropContainer.data) {
      return false;
    }
    if (!drag.dropContainer.data[0]) {
      return false;
    }

    const targetPosition = this.parseFieldId(drop.id);
    const sourcePosition = this.parseFieldId(drag.dropContainer.id);
    if (!targetPosition || !sourcePosition) {
      return false;
    }
    const targetRow = targetPosition.row;
    const targetCol = targetPosition.col;
    const sourceRow = sourcePosition.row;
    const sourceCol = sourcePosition.col;

    if (sourceRow === targetRow && sourceCol === targetCol) {
      return false;
    }

    const sourcePiece = drag.dropContainer.data[0];
    if (!sourcePiece) {
      return false;
    }
    if (sourcePiece.color !== this.chessBoardStateService.boardHelper.colorTurn) {
      this.setSubtleDebugReason(ChessBoardMessageConstants.turnMessage(this.chessBoardStateService.boardHelper.colorTurn));
      return false;
    }

    const validationResult = ChessRulesService.validateMove(targetRow, targetCol, drop.data, sourceRow, sourceCol);
    if (!validationResult.isValid) {
      const dragFailureReason = this.getDragFailureReason(sourceRow, sourceCol, sourcePiece);
      if (dragFailureReason) {
        this.setSubtleDebugReason(dragFailureReason);
      }
      return false;
    }

    return true;
  }

  onDropListEntered(event: CdkDragEnter<ChessPieceDto[]>): void {
    if (!event || !event.item || !event.container || !event.item.dropContainer) {
      return;
    }
    const sourceId = event.item.dropContainer.id;
    const targetId = event.container.id;
    if (!sourceId || !targetId ||
      !sourceId.startsWith(ChessBoardUiConstants.FIELD_ID_PREFIX) || !targetId.startsWith(ChessBoardUiConstants.FIELD_ID_PREFIX)) {
      return;
    }
    const sourcePosition = this.parseFieldId(sourceId);
    const targetPosition = this.parseFieldId(targetId);
    if (!sourcePosition || !targetPosition) {
      return;
    }
    const sourceRow = sourcePosition.row;
    const sourceCol = sourcePosition.col;
    const targetRow = targetPosition.row;
    const targetCol = targetPosition.col;

    const targetData = this.chessBoardStateService.field[targetRow][targetCol];
    const isValidMove = ChessRulesService.validateMove(targetRow, targetCol, targetData, sourceRow, sourceCol).isValid;
    this.previewHoverMateInOne(sourceRow, sourceCol, targetRow, targetCol, isValidMove);
  }

  onDragStarted(event?: CdkDragStart<ChessPieceDto>): void {
    this.isDragPreviewActive = true;
    this.syncFlippedDragClass();
    if (!event || !event.source || !event.source.dropContainer || !event.source.dropContainer.data) {
      return;
    }

    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return;
    }

    const sourcePiece = event.source.dropContainer.data[0];
    if (!sourcePiece || sourcePiece.color !== this.chessBoardStateService.boardHelper.colorTurn) {
      return;
    }

    const sourcePosition = this.parseFieldId(event.source.dropContainer.id);
    if (!sourcePosition) {
      return;
    }

    const legalTargetCount = this.getLegalTargetCount(sourcePosition.row, sourcePosition.col);
    if (legalTargetCount < 1) {
      const dragFailureReason = this.getDragFailureReason(sourcePosition.row, sourcePosition.col, sourcePiece);
      if (dragFailureReason) {
        this.setSubtleDebugReason(dragFailureReason);
      }
    }
  }

  onSquarePointerDown(cell: ChessPieceDto[]): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return;
    }

    if (this.chessBoardStateService.boardHelper.gameOver) {
      this.setSubtleDebugReason(ChessBoardMessageConstants.GAME_OVER_START_NEW);
      return;
    }

    if (!(cell && cell[0])) {
      this.setSubtleDebugReason(ChessBoardMessageConstants.NO_PIECE_ON_SQUARE);
      return;
    }

    const piece = cell[0];
    if (piece.color !== this.chessBoardStateService.boardHelper.colorTurn) {
      this.setSubtleDebugReason(ChessBoardMessageConstants.turnMessage(this.chessBoardStateService.boardHelper.colorTurn));
    }
  }

  onDragEnded(): void {
    this.isDragPreviewActive = false;
    this.syncFlippedDragClass();
    this.clearDragPreviewHighlights();
  }

  onDrop(event: CdkDragDrop<ChessPieceDto[]>): void {
    if (!this.canProcessDropEvent(event)) {
      return;
    }
    if (event.previousContainer === event.container) {
      return;
    }

    this.ensureRepetitionTrackingState();
    const moveContext = this.buildDropMoveContext(event);
    if (!moveContext) {
      return;
    }

    if (!this.validateDropMove(moveContext, event)) {
      return;
    }

    this.prepareUiForDrop(moveContext);
    this.applyPromotionAvailability(moveContext);

    const moveFlags = this.applyPreTransferBoardState(event, moveContext);
    this.movePieceBetweenCells(event.previousContainer.data, event.container.data);
    this.finalizeDropState(moveContext, moveFlags);
  }

  private movePieceBetweenCells(sourceCell: ChessPieceDto[], targetCell: ChessPieceDto[]): void {
    if (!sourceCell || !targetCell || !sourceCell[0]) {
      return;
    }
    const movingPiece = sourceCell[0];
    sourceCell.splice(0, sourceCell.length);
    targetCell.splice(0, targetCell.length);
    targetCell.push(movingPiece);
  }

  private canProcessDropEvent(event: CdkDragDrop<ChessPieceDto[]>): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    if (this.chessBoardStateService.boardHelper.gameOver) {
      this.setSubtleDebugReason(ChessBoardMessageConstants.GAME_OVER_NO_MOVES);
      return false;
    }
    if (!event || !event.previousContainer || !event.container || !event.previousContainer.data || !event.container.data) {
      return false;
    }
    return !!event.previousContainer.data[0];
  }

  private buildDropMoveContext(event: CdkDragDrop<ChessPieceDto[]>): {
    targetRow: number;
    targetCell: number;
    srcRow: number;
    srcCell: number;
    srcPiece: ChessPiecesEnum;
    srcColor: ChessColorsEnum;
  } | null {
    const targetPosition = this.parseFieldId(event.container.id);
    const sourcePosition = this.parseFieldId(event.previousContainer.id);
    const sourceData = event.previousContainer.data[0];
    if (!targetPosition || !sourcePosition || !sourceData) {
      return null;
    }

    return {
      targetRow: targetPosition.row,
      targetCell: targetPosition.col,
      srcRow: sourcePosition.row,
      srcCell: sourcePosition.col,
      srcPiece: sourceData.piece,
      srcColor: sourceData.color
    };
  }

  private validateDropMove(
    moveContext: { targetRow: number; targetCell: number; srcRow: number; srcCell: number; srcPiece: ChessPiecesEnum; srcColor: ChessColorsEnum; },
    event: CdkDragDrop<ChessPieceDto[]>
  ): boolean {
    const isValidMove = ChessRulesService.validateMove(
      moveContext.targetRow,
      moveContext.targetCell,
      this.chessBoardStateService.field[moveContext.targetRow][moveContext.targetCell],
      moveContext.srcRow,
      moveContext.srcCell
    ).isValid;

    if (isValidMove) {
      return true;
    }

    const sourcePiece = event.previousContainer.data[0];
    const dragFailureReason = this.getDragFailureReason(moveContext.srcRow, moveContext.srcCell, sourcePiece);
    if (dragFailureReason) {
      this.setSubtleDebugReason(dragFailureReason);
    }
    return false;
  }

  private prepareUiForDrop(moveContext: { srcColor: ChessColorsEnum }): void {
    if (!this.clockStarted) {
      this.clockStarted = true;
      this.startClock();
    }

    this.randomizeAmbientStyle();
    if (this.pendingDrawOfferBy !== null && this.pendingDrawOfferBy !== moveContext.srcColor) {
      this.pendingDrawOfferBy = null;
    }

    this.chessBoardStateService.boardHelper.debugText = '';
    this.chessBoardStateService.boardHelper.possibles = {};
    this.chessBoardStateService.boardHelper.hits = {};
    this.chessBoardStateService.boardHelper.checks = {};
    this.chessBoardStateService.boardHelper.arrows = {};
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};
  }

  private applyPromotionAvailability(moveContext: {
    srcPiece: ChessPiecesEnum;
    srcColor: ChessColorsEnum;
    targetRow: number;
    targetCell: number;
  }): void {
    const promotionTargetRow = moveContext.srcColor === ChessColorsEnum.White ? 0 : 7;
    if (moveContext.srcPiece === ChessPiecesEnum.Pawn && moveContext.targetRow === promotionTargetRow) {
      this.chessBoardStateService.boardHelper.canPromote = moveContext.targetCell;
    }
  }

  private applyPreTransferBoardState(
    event: CdkDragDrop<ChessPieceDto[]>,
    moveContext: {
      targetRow: number;
      targetCell: number;
      srcRow: number;
      srcCell: number;
      srcPiece: ChessPiecesEnum;
      srcColor: ChessColorsEnum;
    }
  ): { isHit: boolean; isEP: boolean; castleData: string | null } {
    let isHit = false;
    let isEP = false;
    let castleData: string | null = null;

    if (event.container && event.container.data && event.container.data[0]) {
      this.chessBoardStateService.field[moveContext.targetRow][moveContext.targetCell].splice(0, 1);
      isHit = true;
    }

    const isPawnDiagonalToEmpty = moveContext.srcPiece === ChessPiecesEnum.Pawn
      && Math.abs(moveContext.targetCell - moveContext.srcCell) === 1
      && (!event.container.data || event.container.data.length < 1);
    const targetDirectionStep = moveContext.srcColor === ChessColorsEnum.White ? -1 : 1;
    const enemyFirstStep = moveContext.srcColor === ChessColorsEnum.Black ? 5 : 2;
    if (isPawnDiagonalToEmpty && (moveContext.targetRow - moveContext.srcRow) === targetDirectionStep &&
      moveContext.targetRow === enemyFirstStep) {
      const epTargetRow = moveContext.srcColor === ChessColorsEnum.White ? 3 : 4;
      const epSourceRow = moveContext.srcColor === ChessColorsEnum.White ? 1 : 6;
      const lastHistory = this.chessBoardStateService.history[this.chessBoardStateService.history.length - 1];
      const possibleEP = ChessBoardStateService.translateNotation(
        epTargetRow,
        moveContext.targetCell,
        epSourceRow,
        moveContext.targetCell,
        ChessPiecesEnum.Pawn,
        false,
        false,
        false,
        false,
        null
      );
      if (lastHistory === possibleEP && this.chessBoardStateService.field[epTargetRow][moveContext.targetCell].length > 0) {
        this.chessBoardStateService.field[epTargetRow][moveContext.targetCell].splice(0, 1);
        isHit = true;
        isEP = true;
      }
    }

    this.chessBoardStateService.boardHelper.justDidEnPassant = null;
    const justDidCastle = this.chessBoardStateService.boardHelper.justDidCastle;
    if (justDidCastle) {
      const rookCol = justDidCastle.col === 2 ? 0 : 7;
      const rookDestCol = justDidCastle.col === 2 ? 3 : 5;
      const castleRook = this.chessBoardStateService.field[justDidCastle.row][rookCol];
      if (castleRook && castleRook[0]) {
        const sourceColor = castleRook[0].color as ChessColorsEnum;
        this.chessBoardStateService.field[justDidCastle.row][rookCol].splice(0, 1);
        const newCastleRook = new ChessPieceDto(sourceColor, ChessPiecesEnum.Rook);
        this.chessBoardStateService.field[justDidCastle.row][rookDestCol].push(newCastleRook);
        this.chessBoardStateService.boardHelper.justDidCastle = null;
        castleData = justDidCastle.col === 2 ? 'O-O-O' : 'O-O';
      }
    }

    return { isHit, isEP, castleData };
  }

  private finalizeDropState(
    moveContext: {
      targetRow: number;
      targetCell: number;
      srcRow: number;
      srcCell: number;
      srcPiece: ChessPiecesEnum;
      srcColor: ChessColorsEnum;
    },
    moveFlags: { isHit: boolean; isEP: boolean; castleData: string | null }
  ): void {
    this.isFinalizingDropState = true;
    const enemyColor = moveContext.srcColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const isCheck = this.isKingInCheck(this.chessBoardStateService.field, enemyColor);
    const hasLegalMoves = this.hasAnyLegalMove(this.chessBoardStateService.field, enemyColor);
    const isMatch = isCheck && !hasLegalMoves;
    if (isMatch) {
      this.chessBoardStateService.boardHelper.gameOver = true;
      this.chessBoardStateService.boardHelper.checkmateColor = enemyColor;
      this.chessBoardStateService.boardHelper.debugText =
        `${this.uiText.message.checkmateCallout} ${moveContext.srcColor === ChessColorsEnum.White ? this.uiText.status.white : this.uiText.status.black} ${this.uiText.message.checkmateWinner}`;
    }

    const lastNotation = ChessBoardStateService.translateNotation(
      moveContext.targetRow,
      moveContext.targetCell,
      moveContext.srcRow,
      moveContext.srcCell,
      moveContext.srcPiece,
      moveFlags.isHit,
      isCheck,
      isMatch,
      moveFlags.isEP,
      moveFlags.castleData
    );
    ChessBoardStateService.addHistory(lastNotation);
    this.addIncrementToColor(moveContext.srcColor);
    this.chessBoardStateService.boardHelper.colorTurn =
      this.chessBoardStateService.boardHelper.colorTurn === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    if (!isMatch) {
      this.applyDrawRules(hasLegalMoves, isCheck);
    }
    this.isFinalizingDropState = false;
    this.pushSnapshotForCurrentState();
  }

  private setSubtleDebugReason(reason: string): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !reason) {
      return;
    }
    const subtleReason = `· ${reason}`;
    if (this.chessBoardStateService.boardHelper.debugText === subtleReason) {
      return;
    }
    this.chessBoardStateService.boardHelper.debugText = subtleReason;
  }

  private getDragFailureReason(sourceRow: number, sourceCol: number, sourcePiece: ChessPieceDto): string | null {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !sourcePiece) {
      return null;
    }

    if (sourcePiece.color !== this.chessBoardStateService.boardHelper.colorTurn) {
      return ChessBoardMessageConstants.turnMessage(this.chessBoardStateService.boardHelper.colorTurn);
    }

    if (this.getLegalTargetCount(sourceRow, sourceCol) < 1) {
      return ChessBoardMessageConstants.noLegalTargetsMessage(sourcePiece.piece);
    }

    return null;
  }

  private getLegalTargetCount(sourceRow: number, sourceCol: number): number {
    if (!this.chessBoardStateService || !this.chessBoardStateService.field) {
      return 0;
    }

    let legalTargetCount = 0;
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        if (row === sourceRow && col === sourceCol) {
          continue;
        }
        const targetCell = this.chessBoardStateService.field[row][col];
        if (ChessRulesService.validateMove(row, col, targetCell, sourceRow, sourceCol).isValid) {
          legalTargetCount += 1;
        }
      }
    }
    return legalTargetCount;
  }

  private parseFieldId(fieldId: string): { row: number, col: number } | null {
    // Expected id format: `fieldRC`, where R=row digit and C=column digit.
    // Example: `field34` => row=3, col=4.
    if (!fieldId || !fieldId.startsWith(ChessBoardUiConstants.FIELD_ID_PREFIX) ||
      fieldId.length < ChessBoardUiConstants.FIELD_ID_MIN_LENGTH) {
      return null;
    }
    const row = Number(fieldId.charAt(ChessBoardUiConstants.FIELD_ID_ROW_INDEX));
    const col = Number(fieldId.charAt(ChessBoardUiConstants.FIELD_ID_COL_INDEX));
    if (isNaN(row) || isNaN(col) ||
      row < ChessConstants.MIN_INDEX || row > ChessConstants.MAX_INDEX ||
      col < ChessConstants.MIN_INDEX || col > ChessConstants.MAX_INDEX) {
      return null;
    }
    return { row, col };
  }

  private readDebugPanelOpenState(): boolean {
    try {
      return localStorage.getItem(this.debugPanelStorageKey) === ChessBoardUiConstants.STORAGE_OPEN;
    } catch {
      return false;
    }
  }

  private persistDebugPanelOpenState(isOpen: boolean): void {
    try {
      localStorage.setItem(this.debugPanelStorageKey, isOpen ? ChessBoardUiConstants.STORAGE_OPEN : ChessBoardUiConstants.STORAGE_CLOSED);
    } catch {
      return;
    }
  }

  isTarget(targetRow: number, targetCol: number): boolean {
    return this.hasBoardHighlight(targetRow, targetCol, 'possible');
  }

  isHit(targetRow: number, targetCol: number): boolean {
    return this.hasBoardHighlight(targetRow, targetCol, 'capture');
  }

  isCheck(targetRow: number, targetCol: number): boolean {
    return this.hasBoardHighlight(targetRow, targetCol, 'check');
  }

  isMateInOneTarget(targetRow: number, targetCol: number): boolean {
    return !!this.mateInOneTargets[`${targetRow}${targetCol}`];
  }

  isMateInOneBlunderTarget(targetRow: number, targetCol: number): boolean {
    return !!this.mateInOneBlunderTargets[`${targetRow}${targetCol}`];
  }

  getSquareHighlightClass(targetRow: number, targetCol: number): string {
    if (this.isMateInOneBlunderTarget(targetRow, targetCol)) {
      return 'mate-one-danger';
    }
    if (this.isMateInOneTarget(targetRow, targetCol)) {
      return 'mate-one';
    }
    if (this.isHit(targetRow, targetCol)) {
      return 'killer';
    }
    if (this.isTarget(targetRow, targetCol)) {
      return 'shaded';
    }
    return '';
  }

  isWhiteSquare(targetRow: number, targetCol: number): boolean {
    return ((targetRow + targetCol) % 2) === 0;
  }

  getDisplayCell(displayRow: number, displayCol: number): ChessPieceDto[] {
    const boardRow = this.getBoardIndexForDisplay(displayRow);
    const boardCol = this.getBoardIndexForDisplay(displayCol);
    return this.chessBoardStateService.field[boardRow][boardCol];
  }

  getDisplayPiece(displayRow: number, displayCol: number): ChessPieceDto | null {
    const cell = this.getDisplayCell(displayRow, displayCol);
    return (cell && cell[0]) ? cell[0] : null;
  }

  getDisplayFieldId(displayRow: number, displayCol: number): string {
    const boardRow = this.getBoardIndexForDisplay(displayRow);
    const boardCol = this.getBoardIndexForDisplay(displayCol);
    return `${ChessBoardUiConstants.FIELD_ID_PREFIX}${boardRow}${boardCol}`;
  }

  getDisplaySquareHighlightClass(displayRow: number, displayCol: number): string {
    const boardRow = this.getBoardIndexForDisplay(displayRow);
    const boardCol = this.getBoardIndexForDisplay(displayCol);
    return this.getSquareHighlightClass(boardRow, boardCol);
  }

  isDisplaySquareWhite(displayRow: number, displayCol: number): boolean {
    const boardRow = this.getBoardIndexForDisplay(displayRow);
    const boardCol = this.getBoardIndexForDisplay(displayCol);
    return this.isWhiteSquare(boardRow, boardCol);
  }

  getDisplayNotation(displayRow: number, displayCol: number): string {
    const boardRow = this.getBoardIndexForDisplay(displayRow);
    const boardCol = this.getBoardIndexForDisplay(displayCol);
    return this.translateFieldNames(boardRow, boardCol);
  }

  getArrowTopForDisplay(arrow: ChessArrowDto): string {
    return this.mapPercentCoordinateForDisplay(arrow ? arrow.top : '');
  }

  getArrowLeftForDisplay(arrow: ChessArrowDto): string {
    return this.mapPercentCoordinateForDisplay(arrow ? arrow.left : '');
  }

  getArrowTransformForDisplay(arrow: ChessArrowDto): string {
    const rotate = this.mapRotationForDisplay(arrow ? arrow.rotate : '');
    return `translate(-50%, -50%) rotate(${rotate})`;
  }

  onDebugPanelToggle(event: Event): void {
    const detailsElement = event && event.target ? event.target as HTMLDetailsElement : null;
    this.isDebugPanelOpen = !!(detailsElement && detailsElement.open);
    this.persistDebugPanelOpenState(this.isDebugPanelOpen);
  }

  getStatusTitle(): string {
    const boardHelper = this.chessBoardStateService.boardHelper;
    if (!boardHelper) {
      return '';
    }
    if (!boardHelper.gameOver) {
      return `${boardHelper.colorTurn} ${this.uiText.status.toMoveSuffix}`;
    }
    if (boardHelper.checkmateColor !== null) {
      return `${this.uiText.status.checkmatePrefix} - ${boardHelper.checkmateColor === ChessColorsEnum.White ? this.uiText.status.black : this.uiText.status.white} ${this.uiText.message.checkmateWinner}`;
    }
    return boardHelper.debugText || this.uiText.status.drawFallback;
  }

  getAmbientThemeClass(): string {
    if (this.pendingDrawOfferBy !== null) {
      return 'ambient-math--draw-pending';
    }
    return this.chessBoardStateService.boardHelper.colorTurn === ChessColorsEnum.White
      ? 'ambient-math--white-turn'
      : 'ambient-math--black-turn';
  }

  translateFieldNames(idxX: number, idxY: number): string {
    // A = 0 - H = 7
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + idxY);
    // Flip table count bottom-up
    const numberChar = (ChessConstants.BOARD_SIZE - idxX);
    return `${letterChar}${numberChar}`;
  }

  promotePiece(toPiece: ChessPiecesEnum): void {
    if (this.chessBoardStateService.boardHelper.canPromote !== null) {
      const targetCol = Number(this.chessBoardStateService.boardHelper.canPromote);
      const whitePromotionSquare = this.chessBoardStateService.field[ChessConstants.MIN_INDEX][targetCol];
      const blackPromotionSquare = this.chessBoardStateService.field[ChessConstants.MAX_INDEX][targetCol];
      let targetSquare = null;
      if (whitePromotionSquare && whitePromotionSquare[0] && whitePromotionSquare[0].piece === ChessPiecesEnum.Pawn) {
        targetSquare = whitePromotionSquare;
      } else if (blackPromotionSquare && blackPromotionSquare[0] && blackPromotionSquare[0].piece === ChessPiecesEnum.Pawn) {
        targetSquare = blackPromotionSquare;
      }
      if (targetSquare && targetSquare[0]) {
        targetSquare[0].piece = toPiece;
        const historyEntries = this.chessBoardStateService.boardHelper.history;
        const historyLength = Object.keys(historyEntries).length;
        if (historyLength > 0 && historyEntries[`${historyLength}`]) {
          historyEntries[`${historyLength}`] =
            historyEntries[`${historyLength}`] + '=' + ChessBoardStateService.translatePieceNotation(toPiece);
        }
        this.chessBoardStateService.boardHelper.canPromote = null;
        this.replaceActiveSnapshot();
      }
    }
  }

  showPossibleMoves(ofColor: ChessColorsEnum): void {
    // de-activate any visualization tool and clear overlay arrows
    this.clearOverlay();

    // Clear existing move/highlight state
    this.chessBoardStateService.boardHelper.possibles = {};
    this.chessBoardStateService.boardHelper.hits = {};
    this.chessBoardStateService.boardHelper.checks = {};
    this.chessBoardStateService.boardHelper.arrows = {};
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};
    if (ofColor) {
      this.chessBoardStateService.field.forEach((row, rowIdx) => {
        row.forEach((cell, cellIdx) => {
          // All pieces of the color
          if (cell && cell[0] && cell[0].color === ofColor) {
            for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
              for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
                const data = this.chessBoardStateService.field[targetRow][targetCol];
                ChessRulesService.canStepThere(targetRow, targetCol, data, rowIdx, cellIdx);
              }
            }
          }
        });
      });
    }
  }

  startNewGame(): void {
    this.windowRef.location.reload();
  }

  async switchLocale(locale: string): Promise<void> {
    if (!this.uiTextLoaderService || locale === this.selectedLocale) {
      return;
    }

    this.isLanguageSwitching = true;
    try {
      await this.uiTextLoaderService.setActiveLocale(locale);
      this.selectedLocale = this.uiTextLoaderService.getCurrentLocale();
      void this.loadOpeningsFromAssets(this.selectedLocale);
      this.requestClockRender();
    } finally {
      this.isLanguageSwitching = false;
    }
  }

  offerDraw(): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return;
    }
    if (this.chessBoardStateService.boardHelper.gameOver) {
      return;
    }
    if (!this.canOfferDraw()) {
      return;
    }
    this.pendingDrawOfferBy = this.getOpponentColor(this.chessBoardStateService.boardHelper.colorTurn);
    this.randomizeAmbientStyle();
  }

  canOfferDraw(): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    return !this.chessBoardStateService.boardHelper.gameOver && this.pendingDrawOfferBy === null;
  }

  canRespondToDrawOffer(): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    if (this.chessBoardStateService.boardHelper.gameOver || this.pendingDrawOfferBy === null) {
      return false;
    }
    return this.pendingDrawOfferBy !== this.chessBoardStateService.boardHelper.colorTurn;
  }

  acceptDrawOffer(): void {
    if (!this.canRespondToDrawOffer()) {
      return;
    }
    this.setDrawState(ChessBoardMessageConstants.DRAW_BY_AGREEMENT_TEXT, ChessBoardMessageConstants.DRAW_BY_AGREEMENT_TITLE);
    this.randomizeAmbientStyle();
  }

  declineDrawOffer(): void {
    if (!this.canRespondToDrawOffer()) {
      return;
    }
    this.pendingDrawOfferBy = null;
    this.randomizeAmbientStyle();
  }

  applyTimeControl(baseMinutes: number, incrementSeconds: number, label: string): void {
    this.stopClock();
    this.selectedClockPresetLabel = label;
    const baseMs = Math.max(0, baseMinutes) * 60 * 1000;
    this.incrementMs = Math.max(0, incrementSeconds) * 1000;
    this.whiteClockMs = baseMs;
    this.blackClockMs = baseMs;
    this.clockStarted = false;
    this.clockRunning = false;
    this.lastClockTickAt = 0;
  }

  startOrPauseClock(): void {
    if (this.chessBoardStateService.boardHelper.gameOver) {
      return;
    }
    if (this.clockRunning) {
      this.stopClock();
      return;
    }
    this.clockStarted = true;
    this.startClock();
  }

  resetClock(): void {
    const selectedPreset = this.clockPresets.find(preset => preset.label === this.selectedClockPresetLabel);
    if (!selectedPreset) {
      return;
    }
    this.applyTimeControl(selectedPreset.baseMinutes, selectedPreset.incrementSeconds, selectedPreset.label);
  }

  getClockButtonLabel(): string {
    return this.clockRunning ? this.uiText.clock.pause : this.uiText.clock.start;
  }

  getResignConfirmTitle(): string {
    const colorName = this.resignConfirmColor === ChessColorsEnum.White
      ? this.uiText.status.white
      : this.uiText.status.black;
    return this.uiText.resignConfirm.titleTemplate.replace('{color}', colorName);
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

  isClockActive(color: ChessColorsEnum): boolean {
    if (!this.clockRunning || !this.clockStarted || this.chessBoardStateService.boardHelper.gameOver) {
      return false;
    }
    return this.chessBoardStateService.boardHelper.colorTurn === color;
  }

  isClockLow(color: ChessColorsEnum): boolean {
    const remainingTime = color === ChessColorsEnum.White ? this.whiteClockMs : this.blackClockMs;
    return remainingTime <= 10000;
  }

  canClaimDraw(): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    if (this.chessBoardStateService.boardHelper.gameOver) {
      return false;
    }
    this.ensureRepetitionTrackingState();
    return this.isThreefoldRepetition() || this.isFiftyMoveRule();
  }

  claimDraw(): void {
    if (!this.canClaimDraw()) {
      return;
    }
    if (this.isThreefoldRepetition()) {
      this.setDrawState(ChessBoardMessageConstants.DRAW_BY_THREEFOLD_TEXT, ChessBoardMessageConstants.DRAW_BY_THREEFOLD_TITLE);
      return;
    }
    if (this.isFiftyMoveRule()) {
      this.setDrawState(ChessBoardMessageConstants.DRAW_BY_FIFTY_MOVE_TEXT, ChessBoardMessageConstants.DRAW_BY_FIFTY_MOVE_TITLE);
    }
  }

  canResign(color: ChessColorsEnum): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    if (this.chessBoardStateService.boardHelper.gameOver) {
      return false;
    }
    return color === ChessColorsEnum.White || color === ChessColorsEnum.Black;
  }

  openResignConfirm(color: ChessColorsEnum): void {
    if (!this.canResign(color)) {
      return;
    }
    this.resignConfirmColor = color;
  }

  cancelResignConfirm(): void {
    this.resignConfirmColor = null;
  }

  confirmResign(): void {
    if (this.resignConfirmColor === null) {
      return;
    }
    const color = this.resignConfirmColor;
    this.resignConfirmColor = null;
    this.resign(color);
  }

  getVisibleHistory(): string[] {
    const history = this.chessBoardStateService.history || [];
    if (this.mockHistoryCursor === null) {
      return history;
    }
    if (history.length < 1) {
      return [];
    }
    const maxIndex = history.length - 1;
    const clampedIndex = Math.max(-1, Math.min(this.mockHistoryCursor, maxIndex));
    if (clampedIndex < 0) {
      return [];
    }
    return history.slice(0, clampedIndex + 1);
  }

  canUndoMoveMock(): boolean {
    return this.getCurrentVisibleMoveIndex() >= 0;
  }

  canRedoMoveMock(): boolean {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0 || this.mockHistoryCursor === null) {
      return false;
    }
    return this.mockHistoryCursor < maxIndex;
  }

  undoMoveMock(): void {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0) {
      return;
    }
    const currentIndex = this.getCurrentVisibleMoveIndex();
    if (currentIndex < 0) {
      return;
    }
    this.mockHistoryCursor = currentIndex - 1;
    this.restoreSnapshotForVisibleHistory();
  }

  redoMoveMock(): void {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0 || this.mockHistoryCursor === null) {
      return;
    }
    if (this.mockHistoryCursor >= maxIndex) {
      this.mockHistoryCursor = null;
      this.restoreSnapshotForVisibleHistory();
      return;
    }
    this.mockHistoryCursor += 1;
    if (this.mockHistoryCursor >= maxIndex) {
      this.mockHistoryCursor = null;
    }
    this.restoreSnapshotForVisibleHistory();
  }

  getMockEvaluationForMove(halfMoveIndex: number): string {
    if (halfMoveIndex < 0) {
      return '+0.0';
    }
    return this.mockEvalCycle[halfMoveIndex % this.mockEvalCycle.length];
  }

  toggleBoardFlip(): void {
    // flipping should also turn off any active visualization overlay
    this.clearOverlay();
    this.isBoardFlipped = !this.isBoardFlipped;
    this.cdr?.detectChanges();
    this.syncFlippedDragClass();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.syncFlippedDragClass());
    }
  }

  private getBoardIndexForDisplay(displayIndex: number): number {
    if (!this.isBoardFlipped) {
      return displayIndex;
    }
    return ChessConstants.MAX_INDEX - displayIndex;
  }

  private mapPercentCoordinateForDisplay(value: string): string {
    if (!this.isBoardFlipped || !value) {
      return value;
    }
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)%$/);
    if (!match) {
      return value;
    }
    const parsed = Number(match[1]);
    return `${Number((100 - parsed).toFixed(4))}%`;
  }

  private mapRotationForDisplay(value: string): string {
    if (!this.isBoardFlipped || !value) {
      return value;
    }
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (!match) {
      return value;
    }
    const parsed = Number(match[1]);
    let rotated = parsed + 180;
    while (rotated >= 360) {
      rotated -= 360;
    }
    while (rotated < 0) {
      rotated += 360;
    }
    return `${Number(rotated.toFixed(4))}deg`;
  }

  private syncFlippedDragClass(): void {
    if (typeof document === 'undefined' || !document.body) {
      return;
    }
    const shouldApply = this.isBoardFlipped && this.isDragPreviewActive;
    document.body.classList.toggle('board-flipped-drag-active', shouldApply);
  }

  getMockOpeningRecognition(): string {
    this.updateRecognizedOpeningForCurrentHistory();
    const historySteps = this.getVisibleHistory()
      .map(step => this.normalizeNotationToken(step))
      .filter(step => step.length > 0);
    const moveCount = historySteps.length;
    if (moveCount < 1) {
      return this.uiText.recognition.waitingForOpening;
    }
    if (!this.openingsLoaded) {
      return this.uiText.recognition.loadingOpenings;
    }
    if (this.activeOpening) {
      return this.getDisplayedOpeningName(this.activeOpening, historySteps);
    }
    return this.uiText.recognition.noOpeningMatch;
  }

  private getDisplayedOpeningName(opening: IParsedOpening, historySteps: string[]): string {
    if (!opening || !opening.raw) {
      return '';
    }

    const suggestedName = (opening.raw.suggested_best_response_name || '').trim();
    const suggestedStep = opening.raw.suggested_best_response_notation_step || '';
    const suggestedMove = this.extractNotationSteps(suggestedStep)[0] || '';
    if (!suggestedName || !suggestedMove || historySteps.length <= opening.steps.length) {
      return opening.name;
    }

    const openingPrefixMatches = opening.steps.every((step, idx) => historySteps[idx] === step);
    if (!openingPrefixMatches) {
      return opening.name;
    }

    if (historySteps[opening.steps.length] === suggestedMove) {
      if (this.shouldPrefixSuggestedOpeningName(opening.name, suggestedName)) {
        return `${opening.name}: ${suggestedName}`;
      }
      return suggestedName;
    }

    return opening.name;
  }

  private shouldPrefixSuggestedOpeningName(openingName: string, suggestedName: string): boolean {
    const base = (openingName || '').trim();
    const suggestion = (suggestedName || '').trim();
    if (!base || !suggestion) {
      return false;
    }

    const normalizedBase = base.toLowerCase();
    const normalizedSuggestion = suggestion.toLowerCase();
    return !(normalizedSuggestion.includes(normalizedBase) || normalizedBase.includes(normalizedSuggestion));
  }

  private loadOpeningsFromAssets(locale: string): void {
    const loadId = ++this.openingsLoadId;
    const openingFiles = ['openings1.json', 'openings2.json', 'openings3.json'];
    const effectiveLocale = locale || UiTextLoaderService.DEFAULT_LOCALE;
    let remainingFiles = openingFiles.length;

    this.openingsLoaded = false;
    this.openings = [];
    this.activeOpening = null;
    this.activeOpeningHistoryKey = '';

    openingFiles.forEach((fileName) => {
      this.getOpeningAsset$(fileName, effectiveLocale).subscribe({
        next: (items) => {
          if (loadId !== this.openingsLoadId) {
            return;
          }
          const parsedItems = this.parseOpeningsPayload(items);
          if (parsedItems.length > 0) {
            this.openings = [...this.openings, ...parsedItems];
          }
        },
        complete: () => {
          if (loadId !== this.openingsLoadId) {
            return;
          }
          remainingFiles -= 1;
          if (remainingFiles > 0) {
            return;
          }
          this.openingsLoaded = true;
          this.updateRecognizedOpeningForCurrentHistory();
          this.requestClockRender();
        }
      });
    });
  }

  private getOpeningAsset$(fileName: string, locale: string): Observable<IOpeningAssetItem[]> {
    const fallbackPath = `assets/openings/${fileName}`;
    if (locale === UiTextLoaderService.DEFAULT_LOCALE) {
      return this.http.get<IOpeningAssetItem[]>(fallbackPath).pipe(
        catchError(() => of([]))
      );
    }

    const localizedPath = `assets/openings/${locale}/${fileName}`;
    return this.http.get<IOpeningAssetItem[]>(localizedPath).pipe(
      catchError(() => this.http.get<IOpeningAssetItem[]>(fallbackPath).pipe(
        catchError(() => of([]))
      ))
    );
  }

  private parseOpeningsPayload(items: IOpeningAssetItem[]): IParsedOpening[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(item => !!(item && item.name && item.long_algebraic_notation))
      .map(item => ({
        name: item.name,
        raw: item,
        steps: this.extractNotationSteps(item.long_algebraic_notation)
      }))
      .filter(item => item.steps.length > 0);
  }

  private extractNotationSteps(notation: string): string[] {
    if (!notation) {
      return [];
    }
    return notation
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 0)
      .filter(token => !/^\d+\.{1,3}$/.test(token))
      .map(token => this.normalizeNotationToken(token))
        .filter(token => ChessMoveNotation.isValidLongNotation(token))
      .filter(token => token.length > 0);
  }

  private normalizeNotationToken(token: string): string {
    if (!token) {
      return '';
    }
    return token
      .replace(/[+#?!]+$/g, '')
      .replace(/\s*e\.p\.$/i, '')
      .trim();
  }

  private updateRecognizedOpeningForCurrentHistory(): void {
    if (this.openings.length < 1) {
      this.activeOpening = null;
      return;
    }

    const historySteps = this.getVisibleHistory()
      .map(step => this.normalizeNotationToken(step))
      .filter(step => step.length > 0);

    let bestMatch: IParsedOpening | null = null;
    let bestMatchDepth = 0;
    let bestMatchBaseDepth = 0;
    let bestMatchIsComplete = false;
    let bestMatchStepLength = Number.MAX_SAFE_INTEGER;

    this.openings.forEach(opening => {
      const maxComparableLength = Math.min(historySteps.length, opening.steps.length);
      let baseMatchedDepth = 0;
      for (let idx = 0; idx < maxComparableLength; idx++) {
        if (historySteps[idx] !== opening.steps[idx]) {
          break;
        }
        baseMatchedDepth += 1;
      }

      if (baseMatchedDepth < 1) {
        return;
      }

      let effectiveMatchedDepth = baseMatchedDepth;
      let effectiveStepLength = opening.steps.length;
      const suggestedSequence = this.extractNotationSteps(opening.raw.suggested_best_response_notation_step || '');
      const hasStartedSuggestedLine =
        baseMatchedDepth === opening.steps.length &&
        suggestedSequence.length > 0 &&
        historySteps.length > opening.steps.length &&
        historySteps[opening.steps.length] === suggestedSequence[0];

      if (hasStartedSuggestedLine) {
        const extraHistoryCount = Math.max(historySteps.length - opening.steps.length, 0);
        const maxComparableSuggestedCount = Math.min(extraHistoryCount, suggestedSequence.length);
        for (let idx = 0; idx < maxComparableSuggestedCount; idx++) {
          if (historySteps[opening.steps.length + idx] !== suggestedSequence[idx]) {
            break;
          }
          effectiveMatchedDepth += 1;
        }
        effectiveStepLength += suggestedSequence.length;
      }

      const isCompleteMatch = effectiveMatchedDepth === effectiveStepLength;

      if (effectiveMatchedDepth > bestMatchDepth) {
        bestMatchDepth = effectiveMatchedDepth;
        bestMatchBaseDepth = baseMatchedDepth;
        bestMatch = opening;
        bestMatchIsComplete = isCompleteMatch;
        bestMatchStepLength = effectiveStepLength;
        return;
      }

      if (effectiveMatchedDepth === bestMatchDepth) {
        if (isCompleteMatch && !bestMatchIsComplete) {
          bestMatch = opening;
          bestMatchBaseDepth = baseMatchedDepth;
          bestMatchIsComplete = true;
          bestMatchStepLength = effectiveStepLength;
          return;
        }

        if (isCompleteMatch === bestMatchIsComplete && effectiveStepLength < bestMatchStepLength) {
          bestMatch = opening;
          bestMatchBaseDepth = baseMatchedDepth;
          bestMatchIsComplete = isCompleteMatch;
          bestMatchStepLength = effectiveStepLength;
        }
      }
    });

    this.activeOpening = bestMatch;
    const historyKey = historySteps.join('|');
    const debugKey = `${historyKey}::${this.activeOpening ? this.activeOpening.name : 'none'}`;
    if (this.activeOpening && debugKey !== this.activeOpeningHistoryKey) {
      this.activeOpeningHistoryKey = debugKey;
      this.chessBoardStateService.boardHelper.debugText = this.formatOpeningDebugText(
        this.activeOpening,
        bestMatchBaseDepth,
        historySteps.length,
        historySteps
      );
    }
  }

  private formatOpeningDebugText(
    opening: IParsedOpening,
    matchedDepth: number,
    historyDepth: number,
    historySteps: string[]
  ): string {
    if (!opening || !opening.raw) {
      return '';
    }

    const openingLine = opening.raw.long_algebraic_notation || ChessBoardComponent.NA_PLACEHOLDER;
    const suggestedName = opening.raw.suggested_best_response_name || ChessBoardComponent.NA_PLACEHOLDER;
    const suggestedDisplayName =
      suggestedName !== ChessBoardComponent.NA_PLACEHOLDER && this.shouldPrefixSuggestedOpeningName(opening.name, suggestedName)
        ? `${opening.name}: ${suggestedName}`
        : suggestedName;
    const suggestedStep = opening.raw.suggested_best_response_notation_step || ChessBoardComponent.NA_PLACEHOLDER;
    const description = opening.raw.short_description || ChessBoardComponent.NA_PLACEHOLDER;
    const displayedOpeningName = this.getDisplayedOpeningName(opening, historySteps);
    const suggestedSequence = this.extractNotationSteps(suggestedStep);
    const suggestedResponseMove = suggestedSequence[0] || ChessBoardComponent.NA_PLACEHOLDER;
    const hasStartedSuggestedLine =
      suggestedSequence.length > 0 &&
      historySteps.length > opening.steps.length &&
      historySteps[opening.steps.length] === suggestedSequence[0];
    const shouldProjectSuggestedLine =
      matchedDepth === opening.steps.length &&
      hasStartedSuggestedLine;

    const fullProjectedLineSteps = shouldProjectSuggestedLine
      ? [...opening.steps, ...suggestedSequence]
      : [...opening.steps];

    let effectiveMatchedDepth = matchedDepth;
    if (shouldProjectSuggestedLine) {
      const extraHistoryCount = Math.max(historySteps.length - opening.steps.length, 0);
      const maxComparableSuggestedCount = Math.min(extraHistoryCount, suggestedSequence.length);
      for (let idx = 0; idx < maxComparableSuggestedCount; idx++) {
        if (historySteps[opening.steps.length + idx] !== suggestedSequence[idx]) {
          break;
        }
        effectiveMatchedDepth += 1;
      }
    }

    const effectiveLineDepth = fullProjectedLineSteps.length;
    const openingLineWithExtension =
      shouldProjectSuggestedLine && suggestedStep !== ChessBoardComponent.NA_PLACEHOLDER
        ? `${openingLine} ${suggestedStep}`
        : openingLine;

    const noMovePlaceholder = '—';
    const lineContinuation = effectiveMatchedDepth < effectiveLineDepth
      ? fullProjectedLineSteps[effectiveMatchedDepth]
      : noMovePlaceholder;
    const nextSide = historyDepth % 2 === 0 ? this.uiText.status.white : this.uiText.status.black;
    const responseSide = nextSide === this.uiText.status.white ? this.uiText.status.black : this.uiText.status.white;
    let bookRecommendationNow = noMovePlaceholder;
    if (lineContinuation !== noMovePlaceholder) {
      bookRecommendationNow = lineContinuation;
    } else if (!shouldProjectSuggestedLine && suggestedResponseMove !== ChessBoardComponent.NA_PLACEHOLDER) {
      bookRecommendationNow = suggestedResponseMove;
    }

    const debugLines = [
      `${this.uiText.message.openingPrefix}: ${displayedOpeningName}`,
      `${this.uiText.message.matchedStepsPrefix}: ${effectiveMatchedDepth}/${Math.max(effectiveLineDepth, historyDepth)}`,
      `${this.uiText.message.linePrefix}: ${openingLineWithExtension}`,
      `${this.uiText.message.bookRecommendationPrefix} (${nextSide} ${this.uiText.message.bookRecommendationNowSuffix}): ${bookRecommendationNow}`
    ];

    if (lineContinuation !== noMovePlaceholder && suggestedStep !== ChessBoardComponent.NA_PLACEHOLDER && !shouldProjectSuggestedLine) {
      debugLines.push(
        `${this.uiText.message.bookRecommendationPrefix} (${responseSide} ${this.uiText.message.bookRecommendationAfterSuffix}): ${suggestedDisplayName} (${suggestedStep})`
      );
    }

    debugLines.push(`${this.uiText.message.notesPrefix}: ${description}`);

    return debugLines.join('\n');
  }

  getMockEndgameRecognition(): string {
    const totalPieces = this.getCurrentPieceCount();
    if (totalPieces <= 12) {
      return this.uiText.recognition.likelyEndgame;
    }
    if (totalPieces <= 20) {
      return this.uiText.recognition.transitionPhase;
    }
    return this.uiText.recognition.notEndgameYet;
  }

  getMockSuggestedMoves(): string[] {
    const turn = this.chessBoardStateService.boardHelper.colorTurn;
    if (turn === ChessColorsEnum.White) {
      return ['Qh5+', 'Nxe5', 'd4'];
    }
    return ['...Qh4+', '...Nxe4', '...d5'];
  }

  getSuggestedMoveClass(move: string): string {
    if (!move) {
      return 'suggested-move--threat';
    }

    const normalized = move.replace(/^\.\.\./, '');
    if (normalized.includes('+')) {
      return 'suggested-move--check';
    }
    if (normalized.includes('x')) {
      return 'suggested-move--capture';
    }
    return 'suggested-move--threat';
  }

  previewSuggestedMoveArrows(move: string): void {
    if (!move || !this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !this.chessBoardStateService.field) {
      return;
    }

    this.clearSuggestedMoveArrows();
    this.suggestedMoveArrowSnapshot = { ...this.chessBoardStateService.boardHelper.arrows };

    const parsedMove = this.parseSuggestedMove(move);
    if (!parsedMove) {
      return;
    }

    const turnColor = this.chessBoardStateService.boardHelper.colorTurn;
    const targetCell = this.chessBoardStateService.field[parsedMove.targetRow][parsedMove.targetCol];
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = this.chessBoardStateService.field[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0])) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        if (sourcePiece.color !== turnColor || sourcePiece.piece !== parsedMove.piece) {
          continue;
        }

        const isValidMove = ChessRulesService.validateMove(
          parsedMove.targetRow,
          parsedMove.targetCol,
          targetCell,
          srcRow,
          srcCol
        ).isValid;
        if (!isValidMove) {
          continue;
        }

        const suggestionArrow = this.createVisualizationArrow(
          { row: 8 - srcRow, col: srcCol + 1 },
          { row: 8 - parsedMove.targetRow, col: parsedMove.targetCol + 1 },
          'yellow',
          0.45
        );
        ChessBoardStateService.createArrowFromVisualization(suggestionArrow);
      }
    }
  }

  clearSuggestedMoveArrows(): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || this.suggestedMoveArrowSnapshot === null) {
      return;
    }
    this.chessBoardStateService.boardHelper.arrows = { ...this.suggestedMoveArrowSnapshot };
    this.suggestedMoveArrowSnapshot = null;
  }

  getCctRecommendations(category: CctCategoryEnum): ICctRecommendation[] {
    this.ensureCctRecommendations();
    return this.cctRecommendationsCache[category];
  }

  exportPgnMock(): void {
    this.mockExportMessage = `${this.uiText.message.mockExportPgnReady} (${new Date().toLocaleTimeString()})`;
  }

  exportBoardImageMock(): void {
    this.mockExportMessage = `${this.uiText.message.mockExportImageReady} (${new Date().toLocaleTimeString()})`;
  }

  showForkIdeasMock(): void {
    this.clearOverlay();
    this.chessBoardStateService.boardHelper.debugText = this.uiText.message.mockForkIdeas;
  }

  showPinIdeasMock(): void {
    this.clearOverlay();
    this.chessBoardStateService.boardHelper.debugText = this.uiText.message.mockPinIdeas;
  }

  exportFenMock(): void {
    this.mockExportMessage = `${this.uiText.message.mockExportFenCopied} (${new Date().toLocaleTimeString()})`;
  }

  private ensureCctRecommendations(): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !this.chessBoardStateService.field) {
      this.cctRecommendationsCache = {
        [CctCategoryEnum.Captures]: [],
        [CctCategoryEnum.Checks]: [],
        [CctCategoryEnum.Threats]: []
      };
      this.cctRecommendationsCacheKey = '';
      return;
    }

    const board = this.cloneBoard(this.chessBoardStateService.field);
    const forColor = this.chessBoardStateService.boardHelper.colorTurn as ChessColorsEnum;
    const positionKey = this.getPositionKey(board, forColor);
    if (positionKey === this.cctRecommendationsCacheKey) {
      return;
    }

    const enemyColor = this.getOpponentColor(forColor);
    const captures: ICctRecommendationScored[] = [];
    const checks: ICctRecommendationScored[] = [];
    const threats: ICctRecommendationScored[] = [];

    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === forColor)) {
          continue;
        }

        const sourcePiece = sourceCell[0];
        for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
          for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }

            const targetCell = board[targetRow][targetCol];
            const canMove = this.withBoardContext(board, forColor, () =>
              ChessRulesService.canStepThere(
                targetRow,
                targetCol,
                targetCell,
                srcRow,
                srcCol,
                new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
              )
            );
            if (!canMove) {
              continue;
            }

            const afterMove = this.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
            if (this.isKingInCheck(afterMove, forColor)) {
              continue;
            }

            const isCapture = !!(targetCell && targetCell[0] && targetCell[0].color === enemyColor);
            const isCheck = this.isKingInCheck(afterMove, enemyColor);
            const threatenedPieces = this.getThreatenedEnemyPiecesByMovedPiece(
              afterMove,
              targetRow,
              targetCol,
              forColor,
              enemyColor
            );

            const move = this.formatCctMove(sourcePiece.piece, srcRow, srcCol, targetRow, targetCol, isCapture, isCheck);
            const from = this.toAlgebraicSquare(srcRow, srcCol);
            const to = this.toAlgebraicSquare(targetRow, targetCol);

            if (isCapture && targetCell && targetCell[0]) {
              const capturedPieceValue = ChessRulesService.valueOfPiece(targetCell[0].piece);
              const attackerValue = ChessRulesService.valueOfPiece(sourcePiece.piece);
              captures.push({
                move,
                tooltip: `${from} → ${to}: captures ${this.pieceName(targetCell[0].piece)}`,
                score: (capturedPieceValue * 10) - attackerValue
              });
            }

            if (isCheck) {
              checks.push({
                move,
                tooltip: `${from} → ${to}: check${isCapture ? ' with capture' : ''}`,
                score: (isCapture ? 50 : 0) + threatenedPieces.length
              });
            }

            if (!isCapture && !isCheck && threatenedPieces.length > 0) {
              const threatTargets = threatenedPieces.map(piece => this.pieceName(piece));
              const threatScore = threatenedPieces
                .map(piece => ChessRulesService.valueOfPiece(piece))
                .reduce((acc, value) => acc + value, 0);
              threats.push({
                move,
                tooltip: `${from} → ${to}: threatens ${threatTargets.join(', ')}`,
                score: threatScore
              });
            }
          }
        }
      }
    }

    this.cctRecommendationsCache = {
      [CctCategoryEnum.Captures]: this.pickTopCctRecommendations(captures),
      [CctCategoryEnum.Checks]: this.pickTopCctRecommendations(checks),
      [CctCategoryEnum.Threats]: this.pickTopCctRecommendations(threats)
    };
    this.cctRecommendationsCacheKey = positionKey;
  }

  private parseSuggestedMove(move: string): { piece: ChessPiecesEnum, targetRow: number, targetCol: number } | null {
    const normalized = move.replace(/^\.\.\./, '').replace(/[+#?!]/g, '');
    const targetMatch = normalized.match(/([a-h][1-8])$/);
    if (!targetMatch) {
      return null;
    }

    const targetSquare = targetMatch[1];
    const fileChar = targetSquare.charAt(0);
    const rankChar = targetSquare.charAt(1);
    const targetCol = fileChar.charCodeAt(0) - 'a'.charCodeAt(0);
    const targetRow = ChessConstants.BOARD_SIZE - Number(rankChar);
    if (targetCol < ChessConstants.MIN_INDEX || targetCol > ChessConstants.MAX_INDEX ||
      targetRow < ChessConstants.MIN_INDEX || targetRow > ChessConstants.MAX_INDEX) {
      return null;
    }

    const pieceChar = normalized.charAt(0);
    let piece = ChessPiecesEnum.Pawn;
    if (pieceChar === 'K') {
      piece = ChessPiecesEnum.King;
    } else if (pieceChar === 'Q') {
      piece = ChessPiecesEnum.Queen;
    } else if (pieceChar === 'R') {
      piece = ChessPiecesEnum.Rook;
    } else if (pieceChar === 'B') {
      piece = ChessPiecesEnum.Bishop;
    } else if (pieceChar === 'N') {
      piece = ChessPiecesEnum.Knight;
    }

    return { piece, targetRow, targetCol };
  }

  private pickTopCctRecommendations(items: ICctRecommendationScored[]): ICctRecommendation[] {
    const bestByMove: {[move: string]: ICctRecommendationScored} = {};
    items.forEach(item => {
      const existing = bestByMove[item.move];
      if (!existing || item.score > existing.score) {
        bestByMove[item.move] = item;
      }
    });

    return Object.values(bestByMove)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => ({ move: item.move, tooltip: item.tooltip }));
  }

  private getThreatenedEnemyPiecesByMovedPiece(
    board: ChessPieceDto[][][],
    sourceRow: number,
    sourceCol: number,
    attackerColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): ChessPiecesEnum[] {
    const sourceCell = board[sourceRow][sourceCol];
    if (!(sourceCell && sourceCell[0])) {
      return [];
    }

    const sourcePiece = sourceCell[0];
    const threatenedPieces: ChessPiecesEnum[] = [];
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        const targetCell = board[targetRow][targetCol];
        if (!(targetCell && targetCell[0] && targetCell[0].color === enemyColor)) {
          continue;
        }

        const canAttack = this.withBoardContext(board, attackerColor, () =>
          ChessRulesService.canStepThere(
            targetRow,
            targetCol,
            targetCell,
            sourceRow,
            sourceCol,
            new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
          )
        );
        if (canAttack) {
          threatenedPieces.push(targetCell[0].piece);
        }
      }
    }

    return threatenedPieces;
  }

  private formatCctMove(
    piece: ChessPiecesEnum,
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number,
    isCapture: boolean,
    isCheck: boolean
  ): string {
    const to = this.toAlgebraicSquare(targetRow, targetCol);
    const pieceNotation = this.pieceNotation(piece);
    let notation = '';

    if (piece === ChessPiecesEnum.Pawn) {
      const from = this.toAlgebraicSquare(srcRow, srcCol);
      notation = isCapture ? `${from.charAt(0)}x${to}` : to;
    } else {
      notation = `${pieceNotation}${isCapture ? 'x' : ''}${to}`;
    }

    if (isCheck) {
      notation += '+';
    }

    return notation;
  }

  private toAlgebraicSquare(row: number, col: number): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + col);
    const rank = ChessConstants.BOARD_SIZE - row;
    return `${file}${rank}`;
  }

  private pieceNotation(piece: ChessPiecesEnum): string {
    if (piece === ChessPiecesEnum.King) {
      return 'K';
    }
    if (piece === ChessPiecesEnum.Queen) {
      return 'Q';
    }
    if (piece === ChessPiecesEnum.Rook) {
      return 'R';
    }
    if (piece === ChessPiecesEnum.Bishop) {
      return 'B';
    }
    if (piece === ChessPiecesEnum.Knight) {
      return 'N';
    }
    return '';
  }

  private pieceName(piece: ChessPiecesEnum): string {
    if (piece === ChessPiecesEnum.King) {
      return 'king';
    }
    if (piece === ChessPiecesEnum.Queen) {
      return 'queen';
    }
    if (piece === ChessPiecesEnum.Rook) {
      return 'rook';
    }
    if (piece === ChessPiecesEnum.Bishop) {
      return 'bishop';
    }
    if (piece === ChessPiecesEnum.Knight) {
      return 'knight';
    }
    return 'pawn';
  }

  resign(color: ChessColorsEnum): void {
    if (!this.canResign(color)) {
      return;
    }

    this.resignConfirmColor = null;
    this.stopClock();
    this.pendingDrawOfferBy = null;
    this.chessBoardStateService.boardHelper.gameOver = true;
    this.chessBoardStateService.boardHelper.checkmateColor = null;

    const loserName = color === ChessColorsEnum.White ? this.uiText.status.white : this.uiText.status.black;
    const winnerResult = color === ChessColorsEnum.White ? '0-1' : '1-0';
    this.chessBoardStateService.boardHelper.debugText = `${loserName} ${this.uiText.message.resigns}`;
    this.appendGameResultToLastMove(winnerResult, `${loserName} ${this.uiText.message.resignsNoPeriod}`);
  }

  private collectMateInOneTargets(
    board: ChessPieceDto[][][],
    attackerColor: ChessColorsEnum,
    defenderColor: ChessColorsEnum
  ): {[key: string]: boolean} {
    const targets: {[key: string]: boolean} = {};
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === attackerColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
          for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }
            const canMove = this.withBoardContext(board, attackerColor, () =>
              ChessRulesService.canStepThere(
                targetRow,
                targetCol,
                board[targetRow][targetCol],
                srcRow,
                srcCol,
                new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
              )
            );
            if (!canMove) {
              continue;
            }

            const afterMove = this.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
            if (this.isKingInCheck(afterMove, attackerColor)) {
              continue;
            }

            const defenderInCheck = this.isKingInCheck(afterMove, defenderColor);
            if (!defenderInCheck) {
              continue;
            }

            const defenderHasResponse = this.hasAnyLegalMove(afterMove, defenderColor);
            if (!defenderHasResponse) {
              targets[`${targetRow}${targetCol}`] = true;
            }
          }
        }
      }
    }
    return targets;
  }

  private previewHoverMateInOne(
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number,
    isValidMove: boolean
  ): void {
    if (!isValidMove) {
      return;
    }

    const historyLength = this.chessBoardStateService.history.length;
    const previewKey = `${srcRow}${srcCol}-${targetRow}${targetCol}-${historyLength}`;
    if (this.lastMatePreviewKey === previewKey) {
      return;
    }
    this.lastMatePreviewKey = previewKey;
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};

    const board = this.cloneBoard(this.chessBoardStateService.field);
    const sourceCell = board[srcRow][srcCol];
    const forColor = sourceCell && sourceCell[0]
      ? sourceCell[0].color
      : this.chessBoardStateService.boardHelper.colorTurn as ChessColorsEnum;
    const enemyColor = forColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const afterMove = this.simulateMove(board, srcRow, srcCol, targetRow, targetCol);

    if (this.isKingInCheck(afterMove, forColor)) {
      return;
    }

    const enemyInCheck = this.isKingInCheck(afterMove, enemyColor);
    const enemyHasResponse = this.hasAnyLegalMove(afterMove, enemyColor);
    if (enemyInCheck && !enemyHasResponse) {
      this.mateInOneTargets[`${targetRow}${targetCol}`] = true;
    }

    const enemyMateInOneTargets = this.collectMateInOneTargets(afterMove, enemyColor, forColor);
    if (Object.keys(enemyMateInOneTargets).length > 0) {
      this.mateInOneBlunderTargets[`${targetRow}${targetCol}`] = true;
    }
  }

  private clearDragPreviewHighlights(): void {
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};
    this.lastMatePreviewKey = '';
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return;
    }
    this.chessBoardStateService.boardHelper.possibles = {};
    this.chessBoardStateService.boardHelper.hits = {};
    this.chessBoardStateService.boardHelper.checks = {};
  }

  /**
   * Remove any active visualization arrows and reset the active tool flag.
   * This is used internally by the various "show*" helpers and also when the
   * flip button is pressed so that only one overlay is visible at a time.
   */
  clearOverlay(): void {
    this.chessBoardStateService.boardHelper.arrows = {};
    this.activeTool = null;
  }

  showThreats(ofEnemy = false): void {
    const key = ofEnemy ? 'threats-enemy' : 'threats-mine';
    if (this.activeTool === key) {
      // toggle off
      this.clearOverlay();
      return;
    }

    // clicking a new tool should clear whatever was there previously
    this.clearOverlay();

    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    if (ofColor) {
      this.chessBoardStateService.field.forEach((row, rowIdx) => {
        row.forEach((cell, cellIdx) => {
          // All pieces of the color
          if (cell && cell[0] && cell[0].color === ofColor) {
            const threats = this.getThreatsBy(cell, rowIdx, cellIdx, ofColor, enemyColor);
            threats.forEach(threat => {
              let scaryThreat = 0.25;
              const attacker = ChessRulesService.valueOfPiece(threat.piece);
              const defender = ChessRulesService.valueOfPiece(cell[0].piece);
              if (attacker / defender > 1) {
                scaryThreat += 0.15;
              }
              if (attacker / defender < 1) {
                scaryThreat -= 0.15;
              }
              const posFrom = new ChessPositionDto(8 - rowIdx, cellIdx + 1);
              const posTo = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
              const threatenedCell = this.chessBoardStateService.field[threat.pos.row][threat.pos.col];
              if (threatenedCell && threatenedCell[0]) {
                const protectors = this.getProtectors(
                  threatenedCell,
                  threat.pos.row,
                  threat.pos.col,
                  enemyColor,
                  ofColor
                );
                let threatColor: IVisualizationArrow['color'] = protectors.length > 0 ? 'blue' : 'cyan';
                if (threatenedCell[0].piece === ChessPiecesEnum.King) {
                  threatColor = 'red';
                }
                ChessBoardStateService.createArrowFromVisualization(
                  this.createVisualizationArrow(posFrom, posTo, threatColor, scaryThreat)
                );
                protectors.forEach(protector => {
                  const protectionFrom = new ChessPositionDto(8 - protector.row, protector.col + 1);
                  const protectionTo = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
                  ChessBoardStateService.createArrowFromVisualization(
                    this.createVisualizationArrow(protectionFrom, protectionTo, 'gold', 0.25)
                  );
                });
              } else {
                ChessBoardStateService.createArrowFromVisualization(
                  this.createVisualizationArrow(posFrom, posTo, 'cyan', scaryThreat)
                );
              }
            });
          }
        });
      });
    }
    this.activeTool = key;
  }

  getThreatsBy(
    cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    ofColor: ChessColorsEnum,
    _enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const targetCell = this.chessBoardStateService.field[targetRow][targetCol];
          const currentPiece = { color: ofColor, piece: cell[0].piece } as ChessPieceDto;
          const canStepThere = ChessRulesService.canStepThere(
            targetRow,
            targetCol,
            targetCell,
            rowIdx,
            cellIdx,
            currentPiece
          );
          if (canStepThere && targetCell && targetCell[0]) {
            threats.push({pos: new ChessPositionDto(targetRow, targetCol), piece: targetCell[0].piece});
          }
        }
      }
    }
    return threats;
  }

  getThreatsOn(
    cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    ofColor: ChessColorsEnum,
    _enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const targetCell = this.chessBoardStateService.field[targetRow][targetCol];
          const currentPiece = { color: ofColor, piece: cell[0].piece } as ChessPieceDto;
          const canStepThere = ChessRulesService.canStepThere(
            rowIdx, cellIdx,
            [ currentPiece ],
            targetRow, targetCol,
            targetCell[0]);
          if (canStepThere && targetCell && targetCell[0]) {
            threats.push({pos: new ChessPositionDto(targetRow, targetCol), piece: targetCell[0].piece});
          }
        }
      }
    }
    return threats;
  }

  showProtected(ofEnemy = false): void {
    const key = ofEnemy ? 'protected-enemy' : 'protected-mine';
    if (this.activeTool === key) {
      this.clearOverlay();
      return;
    }

    this.clearOverlay();
    this.chessBoardStateService.boardHelper.arrows = {};
    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    if (ofColor) {
      this.chessBoardStateService.field.forEach((row, rowAIdx) => {
        row.forEach((cellA, cellAIdx) => {
          // All pieces of the color
          if (cellA && cellA[0] && cellA[0].color === ofColor) {
            const protectors = this.getProtectors(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
            protectors.forEach(cellB => {
              const posFrom = new ChessPositionDto(8 - cellB.row, cellB.col + 1);
              const posTo = new ChessPositionDto(8 - rowAIdx, cellAIdx + 1);
              ChessBoardStateService.createArrowFromVisualization(
                this.createVisualizationArrow(posFrom, posTo, 'gold', 0.25)
              );
            });
          }
        });
      });
    }
    this.activeTool = key;
  }

  getProtectors(
    cellA: ChessPieceDto[],
    rowAIdx: number,
    cellAIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): ChessPositionDto[] {
    const protectors = [] as ChessPositionDto[];
    this.chessBoardStateService.field.forEach((rowB, rowBIdx) => {
      rowB.forEach((cellB, cellBIdx) => {
        // All pieces of the color
        if (cellB && cellB[0] && cellB[0].color === ofColor) {
          if (cellAIdx !== cellBIdx || rowAIdx !== rowBIdx) {
            if (ChessRulesService.canStepThere(
              rowAIdx,
              cellAIdx,
              [{ color: enemyColor, piece: cellA[0].piece }],
              rowBIdx,
              cellBIdx,
              { color: ofColor, piece: cellB[0].piece })) {
              protectors.push(new ChessPositionDto(rowBIdx, cellBIdx));
            }
          }
        }
      });
    });
    return protectors;
  }

  showHangingPieces(ofEnemy = false): void {
    const key = ofEnemy ? 'hanging-enemy' : 'hanging-mine';
    if (this.activeTool === key) {
      this.clearOverlay();
      return;
    }

    this.clearOverlay();
    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    this.chessBoardStateService.boardHelper.arrows = {};
    if (ofColor) {
      this.chessBoardStateService.field.forEach((row, rowAIdx) => {
        row.forEach((cellA, cellAIdx) => {
          // All pieces of the color
          if (cellA && cellA[0] && cellA[0].color === ofColor) {
            const protectedBy = this.getProtectors(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
            const isProtected = protectedBy.length > 0;
            if (!isProtected) {
              const threatsOnCell = this.getThreatsOn(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
              threatsOnCell.forEach(threat => {
                let scaryThreat = 0.25;
                const attacker = ChessRulesService.valueOfPiece(cellA[0].piece);
                const defender = ChessRulesService.valueOfPiece(threat.piece);
                if (attacker / defender > 1) {
                  scaryThreat += 0.15;
                }
                if (attacker / defender < 1) {
                  scaryThreat -= 0.15;
                }
                const posFrom = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
                const posTo = new ChessPositionDto(8 - rowAIdx, cellAIdx + 1);
                ChessBoardStateService.createArrowFromVisualization(
                  this.createVisualizationArrow(posFrom, posTo, 'blue', scaryThreat)
                );
              });
            }
          }
        });
      });
    }
    this.activeTool = key;
  }

  private initColors(ofEnemy: boolean): { ofColor: ChessColorsEnum, enemyColor: ChessColorsEnum} {
    let ofColor: ChessColorsEnum;
    let enemyColor: ChessColorsEnum;
    if (!ofEnemy) {
      ofColor = this.chessBoardStateService.boardHelper.colorTurn as ChessColorsEnum;
      enemyColor = ofColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    } else {
      enemyColor = this.chessBoardStateService.boardHelper.colorTurn as ChessColorsEnum;
      ofColor = enemyColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    }
    return {ofColor, enemyColor};
  }

  private hasBoardHighlight(targetRow: number, targetCol: number, type: IBoardHighlight['type']): boolean {
    return this.chessBoardStateService.boardHighlights
      .some(highlight => highlight.type === type && highlight.row === targetRow && highlight.col === targetCol);
  }

  private createVisualizationArrow(
    from: ChessPositionDto,
    to: ChessPositionDto,
    color: IVisualizationArrow['color'],
    intensity: number
  ): IVisualizationArrow {
    return {
      fromRow: from.row,
      fromCol: from.col,
      toRow: to.row,
      toCol: to.col,
      color,
      intensity: Math.max(0, Math.min(1, intensity))
    };
  }

  private withBoardContext<T>(board: ChessPieceDto[][][], turn: ChessColorsEnum, callback: () => T): T {
    const previousField = ChessBoardStateService.CHESS_FIELD;
    const previousTurn = this.chessBoardStateService.boardHelper.colorTurn;
    const previousCastle = this.chessBoardStateService.boardHelper.justDidCastle;
    try {
      ChessBoardStateService.CHESS_FIELD = board;
      this.chessBoardStateService.boardHelper.colorTurn = turn;
      this.chessBoardStateService.boardHelper.justDidCastle = null;
      return callback();
    } finally {
      ChessBoardStateService.CHESS_FIELD = previousField;
      this.chessBoardStateService.boardHelper.colorTurn = previousTurn;
      this.chessBoardStateService.boardHelper.justDidCastle = previousCastle;
    }
  }

  private cloneBoard(board: ChessPieceDto[][][]): ChessPieceDto[][][] {
    return board.map(row => row.map(cell => {
      if (!cell || cell.length < 1) {
        return [];
      }
      return [new ChessPieceDto(cell[0].color, cell[0].piece)];
    }));
  }

  private simulateMove(
    board: ChessPieceDto[][][],
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number
  ): ChessPieceDto[][][] {
    const nextBoard = this.cloneBoard(board);
    const movingPiece = nextBoard[srcRow][srcCol] && nextBoard[srcRow][srcCol][0]
      ? new ChessPieceDto(nextBoard[srcRow][srcCol][0].color, nextBoard[srcRow][srcCol][0].piece)
      : null;
    if (!movingPiece) {
      return nextBoard;
    }

    if (movingPiece.piece === ChessPiecesEnum.Pawn && srcCol !== targetCol && nextBoard[targetRow][targetCol].length < 1) {
      nextBoard[srcRow][targetCol] = [];
    }

    nextBoard[srcRow][srcCol] = [];
    nextBoard[targetRow][targetCol] = [movingPiece];

    if (movingPiece.piece === ChessPiecesEnum.King && srcRow === targetRow && Math.abs(targetCol - srcCol) === 2) {
      const isKingSideCastle = targetCol > srcCol;
      const rookSourceCol = isKingSideCastle ? 7 : 0;
      const rookTargetCol = isKingSideCastle ? 5 : 3;
      const rookCell = nextBoard[targetRow][rookSourceCol];
      if (rookCell && rookCell[0] && rookCell[0].piece === ChessPiecesEnum.Rook) {
        const rook = new ChessPieceDto(rookCell[0].color, rookCell[0].piece);
        nextBoard[targetRow][rookSourceCol] = [];
        nextBoard[targetRow][rookTargetCol] = [rook];
      }
    }

    const promotionRow = movingPiece.color === ChessColorsEnum.White ? ChessConstants.MIN_INDEX : ChessConstants.MAX_INDEX;
    if (movingPiece.piece === ChessPiecesEnum.Pawn && targetRow === promotionRow) {
      nextBoard[targetRow][targetCol][0].piece = ChessPiecesEnum.Queen;
    }

    return nextBoard;
  }

  private findKing(board: ChessPieceDto[][][], color: ChessColorsEnum): ChessPositionDto | null {
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (cell && cell[0] && cell[0].color === color && cell[0].piece === ChessPiecesEnum.King) {
          return new ChessPositionDto(row, col);
        }
      }
    }
    return null;
  }

  private isKingInCheck(board: ChessPieceDto[][][], kingColor: ChessColorsEnum): boolean {
    const king = this.findKing(board, kingColor);
    if (!king) {
      return false;
    }
    const attackerColor = kingColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const attackerCell = board[row][col];
        if (!(attackerCell && attackerCell[0] && attackerCell[0].color === attackerColor)) {
          continue;
        }
        const attacker = attackerCell[0];
        const canHitKing = this.withBoardContext(board, attackerColor, () =>
          ChessRulesService.canStepThere(
            king.row,
            king.col,
            [new ChessPieceDto(kingColor, ChessPiecesEnum.King)],
            row,
            col,
            new ChessPieceDto(attacker.color, attacker.piece)
          )
        );
        if (canHitKing) {
          return true;
        }
      }
    }
    return false;
  }

  private hasAnyLegalMove(board: ChessPieceDto[][][], forColor: ChessColorsEnum): boolean {
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === forColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
          for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }
            const canMove = this.withBoardContext(board, forColor, () =>
              ChessRulesService.canStepThere(
                targetRow,
                targetCol,
                board[targetRow][targetCol],
                srcRow,
                srcCol,
                new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
              )
            );
            if (!canMove) {
              continue;
            }
            const afterMove = this.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
            if (!this.isKingInCheck(afterMove, forColor)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private applyDrawRules(hasLegalMovesForCurrentTurn: boolean, isCurrentTurnInCheck: boolean): void {
    if (this.chessBoardStateService.boardHelper.gameOver) {
      return;
    }

    // Draw precedence mirrors practical game flow:
    // 1) immediate board-state draw (stalemate / insufficient material)
    // 2) history-dependent automatic draws (fivefold / seventy-five-move)
    const isStalemate = !isCurrentTurnInCheck && !hasLegalMovesForCurrentTurn;
    if (isStalemate) {
      this.setDrawState(ChessBoardMessageConstants.DRAW_BY_STALEMATE_TEXT, ChessBoardMessageConstants.DRAW_BY_STALEMATE_TITLE);
      return;
    }

    if (this.isInsufficientMaterial(this.chessBoardStateService.field)) {
      this.setDrawState(ChessBoardMessageConstants.DRAW_BY_INSUFFICIENT_TEXT, ChessBoardMessageConstants.DRAW_BY_INSUFFICIENT_TITLE);
      return;
    }

    this.recordCurrentPosition();
    if (this.isFivefoldRepetition()) {
      this.setDrawState(ChessBoardMessageConstants.DRAW_BY_FIVEFOLD_TEXT, ChessBoardMessageConstants.DRAW_BY_FIVEFOLD_TITLE);
      return;
    }

    if (this.isSeventyFiveMoveRule()) {
      this.setDrawState(ChessBoardMessageConstants.DRAW_BY_SEVENTYFIVE_TEXT, ChessBoardMessageConstants.DRAW_BY_SEVENTYFIVE_TITLE);
      return;
    }
  }

  private setDrawState(message: string, historyReason: string): void {
    this.chessBoardStateService.boardHelper.gameOver = true;
    this.chessBoardStateService.boardHelper.checkmateColor = null;
    this.chessBoardStateService.boardHelper.debugText = message;
    this.pendingDrawOfferBy = null;
    this.appendGameResultToLastMove('1/2-1/2', historyReason);
  }

  private getOpponentColor(color: ChessColorsEnum): ChessColorsEnum {
    return color === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
  }

  private resetBoardState(): void {
    this.chessBoardStateService.field = this.createInitialField();
    ChessBoardStateService.CHESS_FIELD = this.chessBoardStateService.field;

    this.chessBoardStateService.boardHelper.debugText = '';
    this.chessBoardStateService.boardHelper.possibles = {};
    this.chessBoardStateService.boardHelper.hits = {};
    this.chessBoardStateService.boardHelper.checks = {};
    this.chessBoardStateService.boardHelper.arrows = {};
    this.chessBoardStateService.boardHelper.history = {};
    this.chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    this.chessBoardStateService.boardHelper.canPromote = null;
    this.chessBoardStateService.boardHelper.justDidEnPassant = null;
    this.chessBoardStateService.boardHelper.justDidCastle = null;
    this.chessBoardStateService.boardHelper.gameOver = false;
    this.chessBoardStateService.boardHelper.checkmateColor = null;
    ChessBoardStateService.BOARD_HELPER = this.chessBoardStateService.boardHelper;
    this.initializeSnapshotTimeline();
  }

  private resetTransientUiState(): void {
    this.pendingDrawOfferBy = null;
    this.resignConfirmColor = null;
    this.mockHistoryCursor = null;
    this.mockExportMessage = '';
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};
    this.lastMatePreviewKey = '';
    this.suggestedMoveArrowSnapshot = null;
    this.cctRecommendationsCacheKey = '';
    this.cctRecommendationsCache = {
      captures: [],
      checks: [],
      threats: []
    };
    this.repetitionCounts = {};
    this.trackedHistoryLength = -1;
  }

  private createInitialField(): ChessPieceDto[][][] {
    return [
      [
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Queen)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)]
      ],
      [
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)]
      ],
      [[], [], [], [], [], [], [], []],
      [[], [], [], [], [], [], [], []],
      [[], [], [], [], [], [], [], []],
      [[], [], [], [], [], [], [], []],
      [
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)]
      ],
      [
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)]
      ]
    ];
  }

  private randomizeAmbientStyle(): void {
    this.ambientStyle = {
      '--blob1-x': `${this.randomBetween(28, 42)}%`,
      '--blob1-y': `${this.randomBetween(24, 40)}%`,
      '--blob1-r': `${this.randomBetween(7, 11)}%`,
      '--blob2-x': `${this.randomBetween(58, 72)}%`,
      '--blob2-y': `${this.randomBetween(24, 40)}%`,
      '--blob2-r': `${this.randomBetween(7, 12)}%`,
      '--blob3-x': `${this.randomBetween(40, 60)}%`,
      '--blob3-y': `${this.randomBetween(52, 68)}%`,
      '--blob3-r': `${this.randomBetween(6, 10)}%`,
      '--blob4-x': `${this.randomBetween(30, 46)}%`,
      '--blob4-y': `${this.randomBetween(58, 78)}%`,
      '--blob4-r': `${this.randomBetween(7, 11)}%`,
      '--blob5-x': `${this.randomBetween(54, 70)}%`,
      '--blob5-y': `${this.randomBetween(58, 78)}%`,
      '--blob5-r': `${this.randomBetween(6, 10)}%`,
      '--wobble-a': `${this.randomBetween(5.8, 8.4)}s`,
      '--wobble-b': `${this.randomBetween(7.6, 11.2)}s`
    };
  }

  private randomBetween(min: number, max: number): number {
    return Number((Math.random() * (max - min) + min).toFixed(2));
  }

  private appendGameResultToLastMove(result: '1-0' | '0-1' | '1/2-1/2', reason: string): void {
    const historyEntries = this.chessBoardStateService.boardHelper.history;
    const historyLength = Object.keys(historyEntries).length;
    const resultSuffix = `${result} {${reason}}`;
    let changed = false;

    if (historyLength < 1) {
      ChessBoardStateService.addHistory(resultSuffix);
      changed = true;
    } else {
      const lastMove = historyEntries[`${historyLength}`];
      if (!lastMove) {
        historyEntries[`${historyLength}`] = resultSuffix;
        changed = true;
      } else if (!/(?:1-0|0-1|1\/2-1\/2)\s*\{/.test(lastMove)) {
        historyEntries[`${historyLength}`] = `${lastMove} ${resultSuffix}`;
        changed = true;
      }
    }

    if (changed) {
      if (this.isFinalizingDropState) {
        return;
      }
      this.pushSnapshotForCurrentState();
    }
  }

  private startClock(): void {
    if (this.clockIntervalId !== null) {
      return;
    }
    this.lastClockTickAt = Date.now();
    this.clockRunning = true;
    const tick = () => this.tickClock();
    if (this.ngZone) {
      this.clockIntervalId = window.setInterval(() => this.ngZone.run(tick), this.clockTickIntervalMs);
    } else {
      this.clockIntervalId = window.setInterval(tick, this.clockTickIntervalMs);
    }
    this.requestClockRender();
  }

  private stopClock(): void {
    if (this.clockIntervalId !== null) {
      window.clearInterval(this.clockIntervalId);
      this.clockIntervalId = null;
    }
    this.clockRunning = false;
    this.requestClockRender();
  }

  private tickClock(): void {
    if (!this.clockRunning || !this.clockStarted || this.chessBoardStateService.boardHelper.gameOver) {
      this.stopClock();
      return;
    }

    const now = Date.now();
    const elapsedMs = now - this.lastClockTickAt;
    this.lastClockTickAt = now;
    if (elapsedMs <= 0) {
      return;
    }

    const activeColor = this.chessBoardStateService.boardHelper.colorTurn;
    if (activeColor === ChessColorsEnum.White) {
      this.whiteClockMs = Math.max(0, this.whiteClockMs - elapsedMs);
      if (this.whiteClockMs === 0) {
        this.handleTimeForfeit(ChessColorsEnum.White);
      }
      this.requestClockRender();
      return;
    }

    this.blackClockMs = Math.max(0, this.blackClockMs - elapsedMs);
    if (this.blackClockMs === 0) {
      this.handleTimeForfeit(ChessColorsEnum.Black);
    }
    this.requestClockRender();
  }

  private requestClockRender(): void {
    if (!this.cdr || this.isDestroyed) {
      return;
    }
    this.cdr.markForCheck();
  }

  private addIncrementToColor(color: ChessColorsEnum): void {
    if (!this.clockStarted || this.incrementMs <= 0 || this.chessBoardStateService.boardHelper.gameOver) {
      return;
    }
    if (color === ChessColorsEnum.White) {
      this.whiteClockMs += this.incrementMs;
      return;
    }
    this.blackClockMs += this.incrementMs;
  }

  private handleTimeForfeit(loserColor: ChessColorsEnum): void {
    if (this.chessBoardStateService.boardHelper.gameOver) {
      return;
    }

    this.stopClock();
    this.pendingDrawOfferBy = null;
    this.chessBoardStateService.boardHelper.gameOver = true;
    this.chessBoardStateService.boardHelper.checkmateColor = null;

    const winnerColor = loserColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const winnerResult = winnerColor === ChessColorsEnum.White ? '1-0' : '0-1';
    const loserName = loserColor === ChessColorsEnum.White ? this.uiText.status.white : this.uiText.status.black;
    this.chessBoardStateService.boardHelper.debugText = `${loserName} ${this.uiText.message.forfeitsOnTime}`;
    this.appendGameResultToLastMove(winnerResult, `${loserName} ${this.uiText.message.forfeitsOnTimeNoPeriod}`);
  }

  private padToTwo(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private getMaxMoveIndex(): number {
    const historyMaxIndex = (this.chessBoardStateService.history || []).length - 1;
    const snapshotMaxIndex = this.moveSnapshots.length - 2;
    return Math.max(historyMaxIndex, snapshotMaxIndex);
  }

  private getCurrentVisibleMoveIndex(): number {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0) {
      return -1;
    }
    if (this.mockHistoryCursor === null) {
      return maxIndex;
    }
    return Math.max(-1, Math.min(this.mockHistoryCursor, maxIndex));
  }

  private initializeSnapshotTimeline(): void {
    this.moveSnapshots = [];
    this.moveSnapshots.push(this.captureCurrentSnapshot());
    this.mockHistoryCursor = null;
  }

  private pushSnapshotForCurrentState(): void {
    const activeSnapshotIndex = this.getActiveSnapshotIndex();
    if (activeSnapshotIndex >= 0 && activeSnapshotIndex < this.moveSnapshots.length - 1) {
      this.moveSnapshots = this.moveSnapshots.slice(0, activeSnapshotIndex + 1);
    }
    this.moveSnapshots.push(this.captureCurrentSnapshot());
    this.mockHistoryCursor = null;
  }

  private replaceActiveSnapshot(): void {
    const activeSnapshotIndex = this.getActiveSnapshotIndex();
    if (activeSnapshotIndex < 0 || activeSnapshotIndex >= this.moveSnapshots.length) {
      this.initializeSnapshotTimeline();
      return;
    }
    this.moveSnapshots[activeSnapshotIndex] = this.captureCurrentSnapshot();
  }

  private restoreSnapshotForVisibleHistory(): void {
    const targetSnapshotIndex = this.getCurrentVisibleMoveIndex() + 1;
    if (targetSnapshotIndex < 0 || targetSnapshotIndex >= this.moveSnapshots.length) {
      return;
    }
    this.restoreSnapshot(this.moveSnapshots[targetSnapshotIndex]);
  }

  private getActiveSnapshotIndex(): number {
    if (this.moveSnapshots.length < 1) {
      return -1;
    }
    if (this.mockHistoryCursor === null) {
      return this.moveSnapshots.length - 1;
    }
    const maxHistoryIndex = this.getMaxMoveIndex();
    const clampedHistoryIndex = Math.max(-1, Math.min(this.mockHistoryCursor, maxHistoryIndex));
    return Math.max(0, Math.min(clampedHistoryIndex + 1, this.moveSnapshots.length - 1));
  }

  private captureCurrentSnapshot(): IGameplaySnapshot {
    const boardHelper = this.chessBoardStateService.boardHelper;
    return {
      field: this.cloneField(this.chessBoardStateService.field),
      boardHelper: {
        debugText: boardHelper ? boardHelper.debugText : '',
        history: boardHelper && boardHelper.history ? { ...boardHelper.history } : {},
        colorTurn: boardHelper ? boardHelper.colorTurn : ChessColorsEnum.White,
        canPromote: boardHelper && boardHelper.canPromote !== undefined ? boardHelper.canPromote : null,
        justDidEnPassant: this.clonePosition(boardHelper ? boardHelper.justDidEnPassant : null),
        justDidCastle: this.clonePosition(boardHelper ? boardHelper.justDidCastle : null),
        gameOver: !!(boardHelper && boardHelper.gameOver),
        checkmateColor: boardHelper ? boardHelper.checkmateColor : null
      },
      repetitionCounts: { ...this.repetitionCounts },
      trackedHistoryLength: this.trackedHistoryLength,
      pendingDrawOfferBy: this.pendingDrawOfferBy,
      clockStarted: this.clockStarted,
      clockRunning: this.clockRunning,
      whiteClockMs: this.whiteClockMs,
      blackClockMs: this.blackClockMs
    };
  }

  private restoreSnapshot(snapshot: IGameplaySnapshot): void {
    if (!snapshot || !this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return;
    }

    this.chessBoardStateService.field = this.cloneField(snapshot.field);
    ChessBoardStateService.CHESS_FIELD = this.chessBoardStateService.field;

    const boardHelper = this.chessBoardStateService.boardHelper;
    boardHelper.debugText = snapshot.boardHelper.debugText;
    boardHelper.possibles = {};
    boardHelper.hits = {};
    boardHelper.checks = {};
    boardHelper.arrows = {};
    boardHelper.history = { ...snapshot.boardHelper.history };
    boardHelper.colorTurn = snapshot.boardHelper.colorTurn;
    boardHelper.canPromote = snapshot.boardHelper.canPromote;
    boardHelper.justDidEnPassant = this.clonePosition(snapshot.boardHelper.justDidEnPassant);
    boardHelper.justDidCastle = this.clonePosition(snapshot.boardHelper.justDidCastle);
    boardHelper.gameOver = snapshot.boardHelper.gameOver;
    boardHelper.checkmateColor = snapshot.boardHelper.checkmateColor;
    ChessBoardStateService.BOARD_HELPER = boardHelper;

    this.pendingDrawOfferBy = snapshot.pendingDrawOfferBy;
    this.resignConfirmColor = null;
    this.repetitionCounts = { ...snapshot.repetitionCounts };
    this.trackedHistoryLength = snapshot.trackedHistoryLength;
    this.clockStarted = snapshot.clockStarted;
    this.whiteClockMs = snapshot.whiteClockMs;
    this.blackClockMs = snapshot.blackClockMs;
    if (snapshot.clockRunning) {
      this.startClock();
    } else {
      this.stopClock();
    }
  }

  private cloneField(field: ChessPieceDto[][][]): ChessPieceDto[][][] {
    if (!field) {
      return [];
    }
    return field.map(row => row.map(cell => {
      if (!(cell && cell[0])) {
        return [];
      }
      return [new ChessPieceDto(cell[0].color, cell[0].piece)];
    }));
  }

  private clonePosition(position: ChessPositionDto | null): ChessPositionDto | null {
    if (!position) {
      return null;
    }
    return { row: position.row, col: position.col };
  }

  private getCurrentPieceCount(): number {
    let totalPieces = 0;
    this.chessBoardStateService.field.forEach(row => {
      row.forEach(cell => {
        if (cell && cell[0]) {
          totalPieces += 1;
        }
      });
    });
    return totalPieces;
  }

  private ensureRepetitionTrackingState(): void {
    const historyLength = this.chessBoardStateService.history.length;
    if (this.trackedHistoryLength === historyLength && Object.keys(this.repetitionCounts).length > 0) {
      return;
    }

    this.repetitionCounts = {};
    this.recordPositionKey(this.getPositionKey(this.chessBoardStateService.field, this.chessBoardStateService.boardHelper.colorTurn));
    this.trackedHistoryLength = historyLength;
  }

  private recordCurrentPosition(): void {
    const positionKey = this.getPositionKey(
      this.chessBoardStateService.field,
      this.chessBoardStateService.boardHelper.colorTurn
    );
    this.recordPositionKey(positionKey);
    this.trackedHistoryLength = this.chessBoardStateService.history.length;
  }

  private recordPositionKey(positionKey: string): void {
    const currentCount = this.repetitionCounts[positionKey] || 0;
    this.repetitionCounts[positionKey] = currentCount + 1;
  }

  private isThreefoldRepetition(): boolean {
    return this.hasNfoldRepetition(3);
  }

  private isFivefoldRepetition(): boolean {
    return this.hasNfoldRepetition(5);
  }

  private hasNfoldRepetition(requiredCount: number): boolean {
    return Object.values(this.repetitionCounts).some(count => count >= requiredCount);
  }

  getDebugPositionKey(): string {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !this.chessBoardStateService.field) {
      return '';
    }
    return this.getPositionKey(
      this.chessBoardStateService.field,
      this.chessBoardStateService.boardHelper.colorTurn
    );
  }

  getDebugCastlingRights(): string {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !this.chessBoardStateService.field) {
      return '-';
    }
    return ChessRulesService.getCastlingRightsNotation(
      this.chessBoardStateService.field,
      this.chessBoardStateService.boardHelper.history
    );
  }

  private getPositionKey(board: ChessPieceDto[][][], turn: ChessColorsEnum): string {
    const squares: string[] = [];
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (!(cell && cell[0])) {
          continue;
        }
        const piece = cell[0];
        squares.push(`${row}${col}:${piece.color}${piece.piece}`);
      }
    }
    const castlingRights = ChessRulesService.getCastlingRightsNotation(
      board,
      this.chessBoardStateService.boardHelper ? this.chessBoardStateService.boardHelper.history : {}
    );
    const enPassantRights = ChessRulesService.getEnPassantRightsNotation(
      board,
      this.chessBoardStateService.boardHelper ? this.chessBoardStateService.boardHelper.history : {},
      turn
    );
    return `${turn}|${castlingRights}|${enPassantRights}|${squares.join('|')}`;
  }

  private isFiftyMoveRule(): boolean {
    return this.isNMoveRule(100);
  }

  private isSeventyFiveMoveRule(): boolean {
    return this.isNMoveRule(150);
  }

  private isNMoveRule(halfMoveCount: number): boolean {
    const history = this.chessBoardStateService.history;
    if (history.length < halfMoveCount) {
      return false;
    }

    const recentHalfMoves = history.slice(-halfMoveCount);
    return recentHalfMoves.every(move => this.isNonPawnNonCaptureMove(move));
  }

  private isNonPawnNonCaptureMove(notation: string): boolean {
    if (!notation || !ChessMoveNotation.isValidLongNotation(notation) || notation.includes('x')) {
      return false;
    }

    if (notation === 'O-O' || notation === 'O-O-O') {
      return true;
    }

    const pieceMovePrefix = notation.charAt(0);
    return pieceMovePrefix === 'K' || pieceMovePrefix === 'Q' || pieceMovePrefix === 'R' ||
      pieceMovePrefix === 'B' || pieceMovePrefix === 'N';
  }

  private isInsufficientMaterial(board: ChessPieceDto[][][]): boolean {
    const whiteMinorPieces: {piece: ChessPiecesEnum, row: number, col: number}[] = [];
    const blackMinorPieces: {piece: ChessPiecesEnum, row: number, col: number}[] = [];
    let whiteHasMajorOrPawn = false;
    let blackHasMajorOrPawn = false;

    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (!(cell && cell[0])) {
          continue;
        }
        const piece = cell[0];
        if (piece.piece === ChessPiecesEnum.King) {
          continue;
        }
        const isMinorPiece = piece.piece === ChessPiecesEnum.Bishop || piece.piece === ChessPiecesEnum.Knight;
        if (!isMinorPiece) {
          if (piece.color === ChessColorsEnum.White) {
            whiteHasMajorOrPawn = true;
          } else {
            blackHasMajorOrPawn = true;
          }
          continue;
        }
        if (piece.color === ChessColorsEnum.White) {
          whiteMinorPieces.push({ piece: piece.piece, row, col });
        } else {
          blackMinorPieces.push({ piece: piece.piece, row, col });
        }
      }
    }

    if (whiteHasMajorOrPawn || blackHasMajorOrPawn) {
      return false;
    }

    const totalMinorCount = whiteMinorPieces.length + blackMinorPieces.length;
    if (totalMinorCount === 0) {
      return true;
    }

    if (totalMinorCount === 1) {
      return true;
    }

    if (totalMinorCount === 2) {
      if (whiteMinorPieces.length === 1 && blackMinorPieces.length === 1) {
        return true;
      }

      if (whiteMinorPieces.length === 2 && blackMinorPieces.length === 0) {
        return whiteMinorPieces.every(minorPiece => minorPiece.piece === ChessPiecesEnum.Knight);
      }

      if (blackMinorPieces.length === 2 && whiteMinorPieces.length === 0) {
        return blackMinorPieces.every(minorPiece => minorPiece.piece === ChessPiecesEnum.Knight);
      }
    }

    return false;
  }
}
