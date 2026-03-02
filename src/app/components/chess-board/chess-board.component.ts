import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnDestroy, Optional, QueryList, ViewChild, ViewChildren, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragEnter, CdkDragStart, CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import html2canvas from 'html2canvas';
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
import { ChessFenUtils } from '../../utils/chess-fen.utils';
import { ChessBoardMessageConstants, ChessBoardUiConstants, ChessConstants } from '../../constants/chess.constants';
import { UiText } from '../../constants/ui-text.constants';
import { ChessPieceComponent } from '../chess-piece/chess-piece.component';
import { UiTextLoaderService } from '../../services/ui-text-loader.service';
import { StockfishService } from '../../services/stockfish.service';
import { ChessBoardLanguageToolsComponent } from '../chess-board-language-tools/chess-board-language-tools.component';
import { ChessBoardPositionKeyComponent } from '../chess-board-position-key/chess-board-position-key.component';
import { ChessBoardClockCardComponent } from '../chess-board-clock-card/chess-board-clock-card.component';
import { ChessBoardStatusCardComponent } from '../chess-board-status-card/chess-board-status-card.component';
import { ChessBoardToolsCardComponent } from '../chess-board-tools-card/chess-board-tools-card.component';
import { ChessBoardHistoryCardComponent } from '../chess-board-history-card/chess-board-history-card.component';
import { ChessBoardCctCardComponent } from '../chess-board-cct-card/chess-board-cct-card.component';
import { IGameplaySnapshot } from '../../model/interfaces/chess-board-gameplay-snapshot.interface';
import { ChessBoardLogicUtils } from '../../utils/chess-board-logic.utils';
import { ChessBoardSnapshotService } from '../../services/chess-board-snapshot.service';
import { ChessBoardCctUtils } from '../../utils/chess-board-cct.utils';
import { ChessBoardDisplayUtils } from '../../utils/chess-board-display.utils';
import { ChessBoardHistoryService } from '../../services/chess-board-history.service';
import { ChessBoardOpeningUtils } from '../../utils/chess-board-opening.utils';
import { ChessBoardInitializationUtils } from '../../utils/chess-board-initialization.utils';
import { ChessBoardExportUtils } from '../../utils/chess-board-export.utils';
import { ChessBoardComponentUtils } from '../../utils/chess-board-component.utils';
import { ChessBoardStorageService } from '../../services/chess-board-storage.service';
import { ChessBoardClockUtils } from '../../utils/chess-board-clock.utils';
import { ChessBoardEvaluationUtils } from '../../utils/chess-board-evaluation.utils';
import { ChessBoardCctService } from '../../services/chess-board-cct.service';

@Component({
  selector: 'app-chess-board',
  templateUrl: './chess-board.component.html',
  styleUrls: ['./chess-board.component.less'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    DragDropModule,
    ChessPieceComponent,
    ChessBoardLanguageToolsComponent,
    ChessBoardPositionKeyComponent,
    ChessBoardClockCardComponent,
    ChessBoardStatusCardComponent,
    ChessBoardToolsCardComponent,
    ChessBoardHistoryCardComponent,
    ChessBoardCctCardComponent
  ]
})
export class ChessBoardComponent implements AfterViewInit, OnDestroy {
  @Input() lightSquareColor = '#f1d9b5';
  @Input() darkSquareColor = '#b58863';
  @Input() whitePieceColor = '#f7f0de';
  @Input() blackPieceColor = '#252a3a';
  @Input() pieceStyle: 'font-awesome' | 'sprite-1' | 'ascii' = 'font-awesome';
  @Input() squareGapPx = 1;
  @Input() borderWidthPx = 1;
  @Input() previewMode = false;
  @Input() previewBoardSize = ChessConstants.BOARD_SIZE;
  @Input() previewRowAnchor: 'top' | 'bottom' = 'bottom';
  @Input() previewPreset: 'default' | 'piece-colors' = 'default';
  private static readonly NA_PLACEHOLDER = 'n/a';
  readonly uiText = UiText;
  readonly boardIndices: number[] = Array.from({ length: ChessConstants.BOARD_SIZE }, (_, idx) => idx);
  @ViewChild('chessField') chessField: ElementRef;
  @ViewChild('historyLog') historyLog: ChessBoardHistoryCardComponent | ElementRef<HTMLDivElement>;
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
  private readonly evalByHistoryIndex = new Map<number, string>();
  private readonly evalCacheByFen = new Map<string, string>();
  private readonly pendingEvalByHistoryIndex = new Set<number>();
  private readonly evalErrorByHistoryIndex = new Set<number>();
  private evaluationRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private evaluationRunToken = 0;
  private readonly evaluationDebounceMs = 140;
  private readonly pendingEvaluationPlaceholder = '...';
  private readonly evaluationErrorPlaceholder = 'err';
  private readonly analysisClampPawns = 10;
  openingsLoaded = false;
  private openings: IParsedOpening[] = [];
  private activeOpening: IParsedOpening | null = null;
  private activeOpeningHistoryKey = '';
  private openingsLoadId = 0;
  private suggestedMoveArrowSnapshot: Record<string, ChessArrowDto> | null = null;
  ambientStyle: {[key: string]: string} = {};
  canDropPredicate = (drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean =>
    this.canDrop(drag, drop);

  private get previewRenderSize(): number {
    return Math.max(1, Math.min(ChessConstants.BOARD_SIZE, this.previewBoardSize));
  }

  private get activeUiTextLoaderService(): UiTextLoaderService | undefined {
    if (this.uiTextLoaderService && typeof this.uiTextLoaderService.getCurrentLocale === 'function') {
      return this.uiTextLoaderService;
    }
    const legacyInjected = this.cdr as unknown as UiTextLoaderService | undefined;
    if (legacyInjected && typeof legacyInjected.getCurrentLocale === 'function') {
      return legacyInjected;
    }
    return undefined;
  }

  private get activeStockfishService(): StockfishService | undefined {
    if (this.stockfishService && typeof this.stockfishService.evaluateFen === 'function') {
      return this.stockfishService;
    }
    const legacyFromUiLoader = this.uiTextLoaderService as unknown as StockfishService | undefined;
    if (legacyFromUiLoader && typeof legacyFromUiLoader.evaluateFen === 'function') {
      return legacyFromUiLoader;
    }
    const legacyFromCdr = this.cdr as unknown as StockfishService | undefined;
    if (legacyFromCdr && typeof legacyFromCdr.evaluateFen === 'function') {
      return legacyFromCdr;
    }
    return undefined;
  }

  get renderedBoardRows(): number[] {
    if (!this.previewMode) {
      return this.boardIndices;
    }
    const startIndex = this.previewRowAnchor === 'top' ? 0 : ChessConstants.BOARD_SIZE - this.previewRenderSize;
    return this.boardIndices.slice(startIndex, startIndex + this.previewRenderSize);
  }

  get renderedBoardCols(): number[] {
    if (!this.previewMode) {
      return this.boardIndices;
    }
    return this.boardIndices.slice(0, this.previewRenderSize);
  }

  constructor(
    public chessBoardStateService: ChessBoardStateService,
    private readonly http: HttpClient,
    @Optional() private readonly chessBoardCctService?: ChessBoardCctService,
    private readonly ngZone?: NgZone,
    private readonly cdr?: ChangeDetectorRef,
    private readonly uiTextLoaderService?: UiTextLoaderService,
    private readonly stockfishService?: StockfishService
  ) {
    this.randomizeAmbientStyle();
    this.applyTimeControl(5, 0, ChessBoardUiConstants.DEFAULT_CLOCK_PRESET_LABEL);
    this.isDebugPanelOpen = ChessBoardStorageService.readDebugPanelOpenState(this.debugPanelStorageKey);
    if (this.activeUiTextLoaderService) {
      this.selectedLocale = this.activeUiTextLoaderService.getCurrentLocale();
    }
    this.initializeSnapshotTimeline();
    void this.loadOpeningsFromAssets(this.selectedLocale);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.evaluationRefreshTimer !== null) {
      clearTimeout(this.evaluationRefreshTimer);
      this.evaluationRefreshTimer = null;
    }
    this.evaluationRunToken += 1;
    this.stopClock();
    this.syncFlippedDragClass();
    this.activeStockfishService?.terminate();
  }

  ngAfterViewInit(): void {
    if (this.dropListElements) {
      setTimeout(() => {
        this.dropLists = this.dropListElements.toArray();
      }, 0);
    }
    this.scheduleHistoryAutoScroll();
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

    const targetPosition = ChessBoardComponentUtils.parseFieldId(drop.id);
    const sourcePosition = ChessBoardComponentUtils.parseFieldId(drag.dropContainer.id);
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
    const sourcePosition = ChessBoardComponentUtils.parseFieldId(sourceId);
    const targetPosition = ChessBoardComponentUtils.parseFieldId(targetId);
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

    const sourcePosition = ChessBoardComponentUtils.parseFieldId(event.source.dropContainer.id);
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
    ChessBoardComponentUtils.movePieceBetweenCells(event.previousContainer.data, event.container.data);
    this.finalizeDropState(moveContext, moveFlags);
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
    const targetPosition = ChessBoardComponentUtils.parseFieldId(event.container.id);
    const sourcePosition = ChessBoardComponentUtils.parseFieldId(event.previousContainer.id);
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
      const activeColor = this.chessBoardStateService.boardHelper.colorTurn;
      const isActiveKingInCheck = this.isKingInCheck(this.chessBoardStateService.field, activeColor);
      if (isActiveKingInCheck) {
        return ChessBoardMessageConstants.noLegalTargetsWhileInCheckMessage(sourcePiece.piece);
      }
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
    return this.chessBoardStateService.field[boardRow][boardCol];
  }

  getDisplayPiece(displayRow: number, displayCol: number): ChessPieceDto | null {
    const cell = this.getDisplayCell(displayRow, displayCol);
    return (cell && cell[0]) ? cell[0] : null;
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
    return this.isWhiteSquare(boardRow, boardCol);
  }

  getDisplayNotation(displayRow: number, displayCol: number): string {
    const { row: boardRow, col: boardCol } = ChessBoardComponentUtils.getDisplayBoardPosition(
      displayRow,
      displayCol,
      this.isBoardFlipped
    );
    return this.translateFieldNames(boardRow, boardCol);
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

  onDebugPanelToggle(event: Event): void {
    const detailsElement = event && event.target ? event.target as HTMLDetailsElement : null;
    this.isDebugPanelOpen = !!(detailsElement && detailsElement.open);
    ChessBoardStorageService.persistDebugPanelOpenState(this.debugPanelStorageKey, this.isDebugPanelOpen);
  }

  getStatusTitle(): string {
    const boardHelper = this.chessBoardStateService.boardHelper;
    if (!boardHelper) {
      return '';
    }
    if (!boardHelper.gameOver) {
      const activeColorName = boardHelper.colorTurn === ChessColorsEnum.White
        ? this.uiText.status.white
        : this.uiText.status.black;
      return `${activeColorName} ${this.uiText.status.toMoveSuffix}`;
    }
    if (boardHelper.checkmateColor !== null) {
      return `${this.uiText.status.checkmatePrefix} - ${boardHelper.checkmateColor === ChessColorsEnum.White ? this.uiText.status.black : this.uiText.status.white} ${this.uiText.message.checkmateWinner}`;
    }
    return this.uiText.status.drawFallback;
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
    if (!ofColor) {
      return;
    }

    const board = this.chessBoardStateService.field;
    const enemyColor = this.getOpponentColor(ofColor);
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === ofColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
          for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }
            const legalMove = this.canPlayLegalMove(
              board,
              srcRow,
              srcCol,
              targetRow,
              targetCol,
              ofColor,
              sourcePiece
            );
            if (!legalMove) {
              continue;
            }

            ChessBoardStateService.addPossible({ row: targetRow, col: targetCol });
            const targetCell = board[targetRow][targetCol];
            const isCapture = !!(targetCell && targetCell[0] && targetCell[0].color === enemyColor);
            if (isCapture) {
              ChessBoardStateService.addHit({ row: targetRow, col: targetCol });
            }
            const afterMove = this.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
            if (this.isKingInCheck(afterMove, enemyColor)) {
              ChessBoardStateService.addCheck({ row: targetRow, col: targetCol });
              ChessBoardStateService.createArrowFromVisualization(
                this.createVisualizationArrow(
                  { row: 8 - srcRow, col: srcCol + 1 },
                  { row: 8 - targetRow, col: targetCol + 1 },
                  'red',
                  0.25
                )
              );
            }
          }
        }
      }
    }
  }

  startNewGame(): void {
    this.windowRef.location.reload();
  }

  async switchLocale(locale: string): Promise<void> {
    if (!this.activeUiTextLoaderService || locale === this.selectedLocale) {
      return;
    }

    this.isLanguageSwitching = true;
    try {
      await this.activeUiTextLoaderService.setActiveLocale(locale);
      this.selectedLocale = this.activeUiTextLoaderService.getCurrentLocale();
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
    return ChessBoardClockUtils.formatClock(clockMs);
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

  canUndoMove(): boolean {
    return ChessBoardHistoryService.getCurrentVisibleMoveIndex(this.getMaxMoveIndex(), this.mockHistoryCursor) >= 0;
  }

  canRedoMove(): boolean {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0 || this.mockHistoryCursor === null) {
      return false;
    }
    return this.mockHistoryCursor < maxIndex;
  }

  undoMove(): void {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0) {
      return;
    }
    const currentIndex = ChessBoardHistoryService.getCurrentVisibleMoveIndex(this.getMaxMoveIndex(), this.mockHistoryCursor);
    if (currentIndex < 0) {
      return;
    }
    this.mockHistoryCursor = currentIndex - 1;
    this.restoreSnapshotForVisibleHistory();
  }

  redoMove(): void {
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
    this.scheduleHistoryAutoScroll();
  }

  getEvaluationForMove(halfMoveIndex: number): string {
    return ChessBoardEvaluationUtils.getEvaluationForMove({
      halfMoveIndex,
      getFenForHistoryIndex: (idx) => this.getFenForHistoryIndex(idx),
      evalByHistoryIndex: this.evalByHistoryIndex,
      evalCacheByFen: this.evalCacheByFen,
      pendingEvalByHistoryIndex: this.pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex: this.evalErrorByHistoryIndex,
      naPlaceholder: ChessBoardComponent.NA_PLACEHOLDER,
      pendingEvaluationPlaceholder: this.pendingEvaluationPlaceholder,
      evaluationErrorPlaceholder: this.evaluationErrorPlaceholder
    });
  }

  getMoveQualityLabel(halfMoveIndex: number): string {
    const quality = this.getMoveQuality(halfMoveIndex);
    return quality ? quality.label : '';
  }

  getMoveQualityClass(halfMoveIndex: number): string {
    const quality = this.getMoveQuality(halfMoveIndex);
    return quality ? quality.className : '';
  }

  getCurrentAnalysisEvalText(): string {
    if (!this.activeStockfishService) {
      return ChessBoardComponent.NA_PLACEHOLDER;
    }
    const currentMoveIndex = ChessBoardHistoryService.getCurrentVisibleMoveIndex(this.getMaxMoveIndex(), this.mockHistoryCursor);
    if (currentMoveIndex < 0) {
      return this.pendingEvaluationPlaceholder;
    }
    return this.getEvaluationForMove(currentMoveIndex);
  }

  getAnalysisMeterOffsetPercent(): number {
    const evalText = this.getCurrentAnalysisEvalText();
    const pawns = ChessBoardComponentUtils.parseEvaluationPawns(
      evalText,
      this.pendingEvaluationPlaceholder,
      this.evaluationErrorPlaceholder,
      ChessBoardComponent.NA_PLACEHOLDER,
      this.analysisClampPawns
    );
    if (pawns === null) {
      return 50;
    }
    const clamped = Math.max(-this.analysisClampPawns, Math.min(this.analysisClampPawns, pawns));
    return ((clamped + this.analysisClampPawns) / (2 * this.analysisClampPawns)) * 100;
  }

  private getMoveQuality(halfMoveIndex: number): { label: string; className: string } | null {
    return ChessBoardEvaluationUtils.getMoveQuality(
      halfMoveIndex,
      (idx) => this.getEvaluationForMove(idx),
      this.pendingEvaluationPlaceholder,
      this.evaluationErrorPlaceholder,
      ChessBoardComponent.NA_PLACEHOLDER,
      this.analysisClampPawns
    );
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
      .map(step => ChessBoardOpeningUtils.normalizeNotationToken(step))
      .filter(step => step.length > 0);
    const moveCount = historySteps.length;
    if (moveCount < 1) {
      return this.uiText.recognition.waitingForOpening;
    }
    if (!this.openingsLoaded) {
      return this.uiText.recognition.loadingOpenings;
    }
    if (this.activeOpening) {
      return ChessBoardOpeningUtils.getDisplayedOpeningName(this.activeOpening, historySteps);
    }
    return this.uiText.recognition.noOpeningMatch;
  }

  private loadOpeningsFromAssets(locale: string): void {
    const loadId = ++this.openingsLoadId;
    const effectiveLocale = locale || UiTextLoaderService.DEFAULT_LOCALE;

    this.openingsLoaded = false;
    this.openings = [];
    this.activeOpening = null;
    this.activeOpeningHistoryKey = '';

    ChessBoardOpeningUtils.loadOpeningsFromAssets(
      this.http,
      effectiveLocale,
      UiTextLoaderService.DEFAULT_LOCALE,
      (parsedItems) => {
        if (loadId !== this.openingsLoadId || parsedItems.length < 1) {
          return;
        }
        this.openings = [...this.openings, ...parsedItems];
      },
      () => {
        if (loadId !== this.openingsLoadId) {
          return;
        }
        this.openingsLoaded = true;
        this.updateRecognizedOpeningForCurrentHistory();
        this.requestClockRender();
      }
    );
  }

  private getOpeningAsset$(fileName: string, locale: string): Observable<IOpeningAssetItem[]> {
    return ChessBoardOpeningUtils.getOpeningAsset$(
      this.http,
      fileName,
      locale,
      UiTextLoaderService.DEFAULT_LOCALE
    );
  }

  private updateRecognizedOpeningForCurrentHistory(): void {
    if (this.openings.length < 1) {
      this.activeOpening = null;
      return;
    }

    const historySteps = this.getVisibleHistory()
      .map(step => ChessBoardOpeningUtils.normalizeNotationToken(step))
      .filter(step => step.length > 0);

    const bestMatchResult = ChessBoardOpeningUtils.findBestOpeningMatch(this.openings, historySteps);
    this.activeOpening = bestMatchResult.opening;
    const historyKey = historySteps.join('|');
    const debugKey = `${historyKey}::${this.activeOpening ? this.activeOpening.name : 'none'}`;
    if (this.activeOpening && debugKey !== this.activeOpeningHistoryKey) {
      this.activeOpeningHistoryKey = debugKey;
      this.chessBoardStateService.boardHelper.debugText = this.formatOpeningDebugText(
        this.activeOpening,
        bestMatchResult.baseMatchedDepth,
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
    return ChessBoardOpeningUtils.formatOpeningDebugText(
      opening,
      matchedDepth,
      historyDepth,
      historySteps,
      this.uiText,
      ChessBoardComponent.NA_PLACEHOLDER
    );
  }

  getMockEndgameRecognition(): string {
    const totalPieces = ChessBoardLogicUtils.getCurrentPieceCount(this.chessBoardStateService.field);
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
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !this.chessBoardStateService.field) {
      return [];
    }
    if (!this.chessBoardCctService) {
      return [];
    }
    const forColor = this.chessBoardStateService.boardHelper.colorTurn;
    const historyLength = this.chessBoardStateService.history.length;
    const cache = this.chessBoardCctService.ensureCctRecommendations(
      this.chessBoardStateService.field,
      forColor,
      historyLength
    );
    return cache[category] || [];
  }

  exportPgn(): void {
    const pgn = this.getCurrentPgn();
    this.chessBoardStateService.boardHelper.debugText = pgn;
    void this.copyToClipboard(pgn);
  }

  async exportBoardImageMock(): Promise<void> {
    this.chessBoardStateService.boardHelper.debugText = `${this.uiText.message.mockExportImageReady} (${new Date().toLocaleTimeString()})`;
    const imageDataUrl = await this.createBoardImageDataUrlFromDom();
    if (imageDataUrl) {
      this.downloadDataUrl(
        imageDataUrl,
        `chess-board-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      );
    }
  }

  showForkIdeas(): void {
    const key = 'fork-ideas';
    if (this.activeTool === key) {
      this.clearOverlay();
      return;
    }
    this.clearOverlay();
    const forkArrows = this.collectForkVisualizationArrows();
    forkArrows.forEach(arrow => ChessBoardStateService.createArrowFromVisualization(arrow));
    if (forkArrows.length > 0) {
      this.activeTool = key;
    }
    this.chessBoardStateService.boardHelper.debugText = this.uiText.message.forkIdeas;
  }

  showPinIdeas(): void {
    const key = 'pin-ideas';
    if (this.activeTool === key) {
      this.clearOverlay();
      return;
    }
    this.clearOverlay();
    const pinArrows = this.collectPinVisualizationArrows();
    pinArrows.forEach(arrow => ChessBoardStateService.createArrowFromVisualization(arrow));
    if (pinArrows.length > 0) {
      this.activeTool = key;
    }
    this.chessBoardStateService.boardHelper.debugText = this.uiText.message.pinIdeas;
  }

  exportFen(): void {
    const fen = this.getCurrentFen();
    this.chessBoardStateService.boardHelper.debugText = `${fen}`;
    void this.copyToClipboard(fen);
  }

  private getCurrentPgn(): string {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return '';
    }
    return ChessBoardExportUtils.getCurrentPgn(this.chessBoardStateService.history || []);
  }

  private getCurrentFen(): string {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !this.chessBoardStateService.field) {
      return '8/8/8/8/8/8/8/8 w - - 0 1';
    }

    const board = this.chessBoardStateService.field;
    const turn = this.chessBoardStateService.boardHelper.colorTurn;
    const moveHistory = this.chessBoardStateService.history || [];
    const castlingRights = ChessRulesService.getCastlingRightsNotation(
      board,
      this.chessBoardStateService.boardHelper.history || {}
    );
    const enPassantRights = ChessRulesService.getEnPassantRightsNotation(
      board,
      this.chessBoardStateService.boardHelper.history || {},
      turn
    );
    const plyCount = ChessFenUtils.getPlyCountFromHistory(moveHistory);
    const fullmoveNumber = ChessFenUtils.getFullmoveNumberFromPlyCount(plyCount);
    const halfmoveClock = ChessFenUtils.getHalfmoveClockFromHistory(moveHistory);
    return ChessFenUtils.generateFen(
      board,
      turn,
      castlingRights,
      enPassantRights,
      halfmoveClock,
      fullmoveNumber
    );
  }

  private async createBoardImageDataUrlFromDom(): Promise<string | null> {
    const win = this.getWindowRef();
    if (!this.getDocumentRef() || !win) {
      return null;
    }

    const boardElement = this.chessField?.nativeElement?.closest('.board-shell') as HTMLElement | null;
    if (!boardElement) {
      return null;
    }

    try {
      const deviceScale = Math.max(1, Math.ceil(win.devicePixelRatio || 1));
      const canvas = await html2canvas(boardElement, {
        backgroundColor: null,
        scale: deviceScale,
        useCORS: true,
        logging: false
      });
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  private downloadDataUrl(dataUrl: string, fileName: string): void {
    const doc = this.getDocumentRef();
    if (!doc) {
      return;
    }

    const link = doc.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.rel = 'noopener';
    doc.body.appendChild(link);
    link.click();
    doc.body.removeChild(link);
  }

  private getDocumentRef(): Document {
    return document;
  }

  private getWindowRef(): Window {
    return window;
  }

  private copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      return Promise.resolve(false);
    }
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
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
            const from = ChessBoardCctUtils.toAlgebraicSquare(srcRow, srcCol);
            const to = ChessBoardCctUtils.toAlgebraicSquare(targetRow, targetCol);

            if (isCapture && targetCell && targetCell[0]) {
              const capturedPieceValue = ChessRulesService.valueOfPiece(targetCell[0].piece);
              const attackerValue = ChessRulesService.valueOfPiece(sourcePiece.piece);
              captures.push({
                move,
                tooltip: `${from} → ${to}: captures ${ChessBoardCctUtils.pieceName(targetCell[0].piece)}`,
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
              const threatTargets = threatenedPieces.map(piece => ChessBoardCctUtils.pieceName(piece));
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
      [CctCategoryEnum.Captures]: ChessBoardCctUtils.pickTopRecommendations(captures),
      [CctCategoryEnum.Checks]: ChessBoardCctUtils.pickTopRecommendations(checks),
      [CctCategoryEnum.Threats]: ChessBoardCctUtils.pickTopRecommendations(threats)
    };
    this.cctRecommendationsCacheKey = positionKey;
  }

  private parseSuggestedMove(move: string): { piece: ChessPiecesEnum, targetRow: number, targetCol: number } | null {
    return ChessBoardCctUtils.parseSuggestedMove(move);
  }

  private getThreatenedEnemyPiecesByMovedPiece(
    board: ChessPieceDto[][][],
    sourceRow: number,
    sourceCol: number,
    attackerColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): ChessPiecesEnum[] {
    return ChessBoardCctUtils.getThreatenedEnemyPiecesByMovedPiece(
      board,
      sourceRow,
      sourceCol,
      attackerColor,
      enemyColor,
      (targetRow, targetCol, targetCell, sourceRowArg, sourceColArg, sourcePiece, attackerColorArg) =>
        this.withBoardContext(board, attackerColorArg, () =>
          ChessRulesService.canStepThere(
            targetRow,
            targetCol,
            targetCell,
            sourceRowArg,
            sourceColArg,
            new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
          )
        )
    );
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
    return ChessBoardCctUtils.formatCctMove(piece, srcRow, srcCol, targetRow, targetCol, isCapture, isCheck);
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
    enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    const board = this.chessBoardStateService.field;
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const targetCell = board[targetRow][targetCol];
          const isEnemyTarget = !!(targetCell && targetCell[0] && targetCell[0].color === enemyColor);
          if (!isEnemyTarget) {
            continue;
          }
          const legalMove = this.canPlayLegalMove(board, rowIdx, cellIdx, targetRow, targetCol, ofColor, cell[0]);
          if (legalMove) {
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
    _defendedColor: ChessColorsEnum,
    attackerColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    const board = this.chessBoardStateService.field;
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const attackerCell = board[targetRow][targetCol];
          if (!(attackerCell && attackerCell[0] && attackerCell[0].color === attackerColor)) {
            continue;
          }
          const legalMove = this.canPlayLegalMove(
            board,
            targetRow,
            targetCol,
            rowIdx,
            cellIdx,
            attackerColor,
            attackerCell[0]
          );
          if (legalMove) {
            threats.push({pos: new ChessPositionDto(targetRow, targetCol), piece: cell[0].piece});
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

  private collectForkVisualizationArrows(): IVisualizationArrow[] {
    const forkArrows: IVisualizationArrow[] = [];
    const board = this.chessBoardStateService.field;
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (!(cell && cell[0])) {
          continue;
        }
        const sourcePiece = cell[0];
        const enemyColor = sourcePiece.color === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
        const threats = this.getThreatsBy(cell, row, col, sourcePiece.color, enemyColor);
        if (threats.length < 2) {
          continue;
        }

        const sourcePosition = new ChessPositionDto(8 - row, col + 1);
        threats.forEach(threat => {
          const targetPosition = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
          forkArrows.push(this.createVisualizationArrow(sourcePosition, targetPosition, 'yellow', 0.25));
        });
      }
    }
    return forkArrows;
  }

  private collectPinVisualizationArrows(): IVisualizationArrow[] {
    const pinArrows: IVisualizationArrow[] = [];
    const board = this.chessBoardStateService.field;
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const attackerCell = board[row][col];
        if (!(attackerCell && attackerCell[0])) {
          continue;
        }

        const attackerPiece = attackerCell[0];
        const directions = this.getPinDirections(attackerPiece.piece);
        if (directions.length < 1) {
          continue;
        }

        directions.forEach(direction => {
          let scanRow = row + direction.dr;
          let scanCol = col + direction.dc;
          let maybePinned: ChessPieceDto | null = null;
          let maybePinnedPos: ChessPositionDto | null = null;

          while (this.isWithinBoard(scanRow, scanCol)) {
            const targetCell = board[scanRow][scanCol];
            if (!(targetCell && targetCell[0])) {
              scanRow += direction.dr;
              scanCol += direction.dc;
              continue;
            }

            const targetPiece = targetCell[0];
            if (!maybePinned) {
              if (targetPiece.color === attackerPiece.color) {
                break;
              }
              maybePinned = targetPiece;
              maybePinnedPos = new ChessPositionDto(scanRow, scanCol);
              scanRow += direction.dr;
              scanCol += direction.dc;
              continue;
            }

            if (targetPiece.color !== maybePinned.color) {
              break;
            }

            if (this.isPinnedToValuablePiece(maybePinned.piece, targetPiece.piece)) {
              const attackerFrom = new ChessPositionDto(8 - row, col + 1);
              const pinnedPos = maybePinnedPos as ChessPositionDto;
              const pinnedTo = new ChessPositionDto(8 - pinnedPos.row, pinnedPos.col + 1);
              const protectedFrom = new ChessPositionDto(8 - scanRow, scanCol + 1);
              pinArrows.push(this.createVisualizationArrow(attackerFrom, pinnedTo, 'green', 0.25));
              pinArrows.push(this.createVisualizationArrow(protectedFrom, pinnedTo, 'green', 0.25));
            }

            if (this.isSkewerPair(maybePinned.piece, targetPiece.piece)) {
              const attackerFrom = new ChessPositionDto(8 - row, col + 1);
              const pinnedPos = maybePinnedPos as ChessPositionDto;
              const frontTo = new ChessPositionDto(8 - pinnedPos.row, pinnedPos.col + 1);
              const rearTo = new ChessPositionDto(8 - scanRow, scanCol + 1);
              pinArrows.push(this.createVisualizationArrow(attackerFrom, frontTo, 'orange', 0.25));
              pinArrows.push(this.createVisualizationArrow(frontTo, rearTo, 'orange', 0.25));
            }
            break;
          }
        });
      }
    }

    return pinArrows;
  }

  private getPinDirections(piece: ChessPiecesEnum): Array<{dr: number, dc: number}> {
    if (piece === ChessPiecesEnum.Bishop) {
      return [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
    }
    if (piece === ChessPiecesEnum.Rook) {
      return [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
    }
    if (piece === ChessPiecesEnum.Queen) {
      return [
        { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
        { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
      ];
    }
    return [];
  }

  private isPinnedToValuablePiece(pinned: ChessPiecesEnum, protectedPiece: ChessPiecesEnum): boolean {
    if (pinned === ChessPiecesEnum.King) {
      return false;
    }
    if (protectedPiece === ChessPiecesEnum.King) {
      return true;
    }
    return ChessRulesService.valueOfPiece(protectedPiece) > ChessRulesService.valueOfPiece(pinned);
  }

  private isSkewerPair(frontPiece: ChessPiecesEnum, rearPiece: ChessPiecesEnum): boolean {
    if (rearPiece === ChessPiecesEnum.King) {
      return false;
    }
    if (frontPiece === ChessPiecesEnum.King) {
      return true;
    }
    return ChessRulesService.valueOfPiece(frontPiece) > ChessRulesService.valueOfPiece(rearPiece);
  }

  private isWithinBoard(row: number, col: number): boolean {
    return row >= ChessConstants.MIN_INDEX
      && row <= ChessConstants.MAX_INDEX
      && col >= ChessConstants.MIN_INDEX
      && col <= ChessConstants.MAX_INDEX;
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
    return ChessBoardLogicUtils.cloneField(board);
  }

  private canPlayLegalMove(
    board: ChessPieceDto[][][],
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number,
    forColor: ChessColorsEnum,
    sourcePiece: ChessPieceDto
  ): boolean {
    const targetCell = board[targetRow][targetCol];
    const canStepThere = this.withBoardContext(board, forColor, () =>
      ChessRulesService.canStepThere(
        targetRow,
        targetCol,
        targetCell,
        srcRow,
        srcCol,
        new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
      )
    );
    if (!canStepThere) {
      return false;
    }

    const afterMove = this.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
    return !this.isKingInCheck(afterMove, forColor);
  }

  private simulateMove(
    board: ChessPieceDto[][][],
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number
  ): ChessPieceDto[][][] {
    return ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
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
    return ChessBoardLogicUtils.isKingInCheck(board, kingColor, (
      targetRow,
      targetCol,
      targetCell,
      sourceRow,
      sourceCol,
      sourcePiece
    ) =>
      this.withBoardContext(board, sourcePiece.color, () =>
        ChessRulesService.canStepThere(targetRow, targetCol, targetCell, sourceRow, sourceCol, sourcePiece)
      )
    );
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

    if (ChessBoardLogicUtils.isInsufficientMaterial(this.chessBoardStateService.field)) {
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
    this.chessBoardStateService.field = ChessBoardInitializationUtils.createInitialField();
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

  private randomizeAmbientStyle(): void {
    this.ambientStyle = ChessBoardInitializationUtils.randomizeAmbientStyle((min, max) =>
      ChessBoardInitializationUtils.randomBetween(min, max)
    );
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
    const startResult = ChessBoardClockUtils.startClock(
      this.clockIntervalId,
      this.lastClockTickAt,
      this.clockTickIntervalMs,
      () => this.tickClock(),
      this.ngZone
    );
    if (!startResult.started) {
      return;
    }
    this.clockIntervalId = startResult.clockIntervalId;
    this.lastClockTickAt = startResult.lastClockTickAt;
    this.clockRunning = startResult.clockRunning;
    this.requestClockRender();
  }

  private stopClock(): void {
    const stopResult = ChessBoardClockUtils.stopClock(this.clockIntervalId);
    this.clockIntervalId = stopResult.clockIntervalId;
    this.clockRunning = stopResult.clockRunning;
    this.requestClockRender();
  }

  private tickClock(): void {
    const tickResult = ChessBoardClockUtils.tickClock(
      this.clockRunning,
      this.clockStarted,
      this.chessBoardStateService.boardHelper.gameOver,
      this.lastClockTickAt,
      this.chessBoardStateService.boardHelper.colorTurn,
      this.whiteClockMs,
      this.blackClockMs
    );
    if (tickResult.shouldStop) {
      this.stopClock();
      return;
    }
    this.lastClockTickAt = tickResult.lastClockTickAt;
    this.whiteClockMs = tickResult.whiteClockMs;
    this.blackClockMs = tickResult.blackClockMs;
    if (tickResult.forfeitColor !== null) {
      this.handleTimeForfeit(tickResult.forfeitColor);
    }
    if (tickResult.shouldRender) {
      this.requestClockRender();
    }
  }

  private requestClockRender(): void {
    if (!this.cdr || this.isDestroyed || typeof this.cdr.markForCheck !== 'function') {
      return;
    }
    this.cdr.markForCheck();
  }

  private addIncrementToColor(color: ChessColorsEnum): void {
    const nextClocks = ChessBoardClockUtils.addIncrementToColor(
      color,
      this.clockStarted,
      this.incrementMs,
      this.chessBoardStateService.boardHelper.gameOver,
      this.whiteClockMs,
      this.blackClockMs
    );
    this.whiteClockMs = nextClocks.whiteClockMs;
    this.blackClockMs = nextClocks.blackClockMs;
  }

  private handleTimeForfeit(loserColor: ChessColorsEnum): void {
    const forfeitResult = ChessBoardClockUtils.handleTimeForfeit(
      loserColor,
      this.chessBoardStateService.boardHelper.gameOver,
      this.uiText.status.white,
      this.uiText.status.black,
      this.uiText.message.forfeitsOnTime,
      this.uiText.message.forfeitsOnTimeNoPeriod
    );
    if (!forfeitResult) {
      return;
    }

    this.stopClock();
    this.pendingDrawOfferBy = null;
    this.chessBoardStateService.boardHelper.gameOver = true;
    this.chessBoardStateService.boardHelper.checkmateColor = null;
    this.chessBoardStateService.boardHelper.debugText = forfeitResult.debugText;
    this.appendGameResultToLastMove(forfeitResult.winnerResult, forfeitResult.appendReason);
  }

  private getMaxMoveIndex(): number {
    return ChessBoardHistoryService.getMaxMoveIndex(
      (this.chessBoardStateService.history || []).length,
      this.moveSnapshots.length
    );
  }

  private initializeSnapshotTimeline(): void {
    this.moveSnapshots = [];
    this.moveSnapshots.push(this.captureCurrentSnapshot());
    this.mockHistoryCursor = null;
    this.resetEvaluationState();
    this.scheduleEvaluationRefresh();
    this.scheduleHistoryAutoScroll();
  }

  private pushSnapshotForCurrentState(): void {
    const activeSnapshotIndex = this.getActiveSnapshotIndex();
    if (activeSnapshotIndex >= 0 && activeSnapshotIndex < this.moveSnapshots.length - 1) {
      this.moveSnapshots = this.moveSnapshots.slice(0, activeSnapshotIndex + 1);
    }
    this.moveSnapshots.push(this.captureCurrentSnapshot());
    this.mockHistoryCursor = null;
    this.scheduleEvaluationRefresh();
    this.scheduleHistoryAutoScroll();
  }

  private scheduleHistoryAutoScroll(): void {
    if (this.previewMode || this.mockHistoryCursor !== null) {
      return;
    }
    setTimeout(() => {
      const historyElement = this.resolveHistoryElement();
      if (!historyElement) {
        return;
      }
      historyElement.scrollTop = historyElement.scrollHeight;
    }, 0);
  }

  private resolveHistoryElement(): HTMLDivElement | null {
    const historyRef = this.historyLog as ChessBoardHistoryCardComponent | ElementRef<HTMLDivElement> | null;
    if (!historyRef) {
      return null;
    }
    if (historyRef instanceof ElementRef) {
      return historyRef.nativeElement;
    }
    if ('getHistoryElement' in historyRef && typeof historyRef.getHistoryElement === 'function') {
      return historyRef.getHistoryElement();
    }
    return null;
  }

  private replaceActiveSnapshot(): void {
    const activeSnapshotIndex = this.getActiveSnapshotIndex();
    if (activeSnapshotIndex < 0 || activeSnapshotIndex >= this.moveSnapshots.length) {
      this.initializeSnapshotTimeline();
      return;
    }
    this.moveSnapshots[activeSnapshotIndex] = this.captureCurrentSnapshot();
    this.scheduleEvaluationRefresh();
  }

  private restoreSnapshotForVisibleHistory(): void {
    const targetSnapshotIndex = ChessBoardHistoryService.getCurrentVisibleMoveIndex(this.getMaxMoveIndex(), this.mockHistoryCursor) + 1;
    if (targetSnapshotIndex < 0 || targetSnapshotIndex >= this.moveSnapshots.length) {
      return;
    }
    this.restoreSnapshot(this.moveSnapshots[targetSnapshotIndex]);
    this.scheduleEvaluationRefresh();
  }

  private resetEvaluationState(): void {
    this.evalByHistoryIndex.clear();
    this.pendingEvalByHistoryIndex.clear();
    this.evalErrorByHistoryIndex.clear();
    this.evalCacheByFen.clear();
    if (this.evaluationRefreshTimer !== null) {
      clearTimeout(this.evaluationRefreshTimer);
      this.evaluationRefreshTimer = null;
    }
    this.evaluationRunToken += 1;
  }

  private scheduleEvaluationRefresh(): void {
    if (!this.activeStockfishService || this.previewMode) {
      return;
    }
    if (this.evaluationRefreshTimer !== null) {
      clearTimeout(this.evaluationRefreshTimer);
      this.evaluationRefreshTimer = null;
    }
    const runToken = ++this.evaluationRunToken;
    this.evaluationRefreshTimer = setTimeout(() => {
      this.evaluationRefreshTimer = null;
      void this.refreshVisibleHistoryEvaluations(runToken);
    }, this.evaluationDebounceMs);
  }

  private async refreshVisibleHistoryEvaluations(runToken: number): Promise<void> {
    if (!this.activeStockfishService) {
      return;
    }
    await ChessBoardEvaluationUtils.refreshVisibleHistoryEvaluations({
      runToken,
      getCurrentRunToken: () => this.evaluationRunToken,
      visibleHistoryLength: this.getVisibleHistory().length,
      getFenForHistoryIndex: (idx) => this.getFenForHistoryIndex(idx),
      evaluateFen: (fen) => this.activeStockfishService!.evaluateFen(fen),
      evalByHistoryIndex: this.evalByHistoryIndex,
      evalCacheByFen: this.evalCacheByFen,
      pendingEvalByHistoryIndex: this.pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex: this.evalErrorByHistoryIndex,
      naPlaceholder: ChessBoardComponent.NA_PLACEHOLDER,
      requestRender: () => this.requestClockRender()
    });
  }

  private getFenForHistoryIndex(halfMoveIndex: number): string {
    return ChessBoardEvaluationUtils.getFenForHistoryIndex(halfMoveIndex, this.moveSnapshots);
  }

  private getActiveSnapshotIndex(): number {
    return ChessBoardHistoryService.getActiveSnapshotIndex(
      this.moveSnapshots.length,
      this.mockHistoryCursor,
      this.getMaxMoveIndex()
    );
  }

  private captureCurrentSnapshot(): IGameplaySnapshot {
    return ChessBoardSnapshotService.captureSnapshot(
      this.chessBoardStateService,
      this.repetitionCounts,
      this.trackedHistoryLength,
      this.pendingDrawOfferBy,
      this.clockStarted,
      this.clockRunning,
      this.whiteClockMs,
      this.blackClockMs
    );
  }

  private restoreSnapshot(snapshot: IGameplaySnapshot): void {
    const restoredState = ChessBoardSnapshotService.restoreSnapshot(snapshot, this.chessBoardStateService);
    if (!restoredState) {
      return;
    }
    this.pendingDrawOfferBy = restoredState.pendingDrawOfferBy;
    this.resignConfirmColor = null;
    this.repetitionCounts = restoredState.repetitionCounts;
    this.trackedHistoryLength = restoredState.trackedHistoryLength;
    this.clockStarted = restoredState.clockStarted;
    this.whiteClockMs = restoredState.whiteClockMs;
    this.blackClockMs = restoredState.blackClockMs;
    if (restoredState.shouldRunClock) {
      this.startClock();
    } else {
      this.stopClock();
    }
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
    return ChessBoardLogicUtils.getPositionKey(
      board,
      turn,
      this.chessBoardStateService.boardHelper ? this.chessBoardStateService.boardHelper.history : {}
    );
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
    return recentHalfMoves.every(move => ChessBoardLogicUtils.isNonPawnNonCaptureMove(move));
  }
}

