/* istanbul ignore file */
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragStart, CdkDropList } from '@angular/cdk/drag-drop';
import { HttpClient } from '@angular/common/http';
import { ChessArrowDto } from 'src/app/model/chess-arrow.dto';
import { ChessPieceDto } from 'src/app/model/chess-piece.dto';
import { ChessBoardStateService } from '../../services/chess-board-state.service';
import { ChessRulesService } from '../../services/chess-rules.service';
import { ChessPositionDto } from '../../model/chess-position.dto';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../../model/enums/chess-pieces.enum';
import { IVisualizationArrow } from '../../model/interfaces/visualization-arrow.interface';
import { CctCategoryEnum } from '../../model/enums/cct-category.enum';
import { ICctRecommendation } from '../../model/interfaces/cct-recommendation.interface';
import { IParsedOpening } from '../../model/interfaces/parsed-opening.interface';
import { ChessBoardMessageConstants, ChessBoardUiConstants, ChessConstants } from '../../constants/chess.constants';
import { UiText } from '../../constants/ui-text.constants';
import { UiTextLoaderService } from '../../services/ui-text-loader.service';
import { StockfishService } from '../../services/stockfish.service';
import { ChessBoardLanguageToolsComponent } from '../chess-board-language-tools/chess-board-language-tools.component';
import { ChessBoardGridComponent, IChessBoardGridMovePreviewEvent } from '../chess-board-grid/chess-board-grid.component';
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
import { ChessBoardHistoryService } from '../../services/chess-board-history.service';
import { ChessBoardInitializationUtils } from '../../utils/chess-board-initialization.utils';
import { ChessBoardExportFacade } from '../../utils/chess-board-export.facade';
import { ChessBoardComponentUtils } from '../../utils/chess-board-component.utils';
import { ChessBoardStorageService } from '../../services/chess-board-storage.service';
import { ChessBoardEvaluationUtils } from '../../utils/chess-board-evaluation.utils';
import { ChessBoardCctService } from '../../services/chess-board-cct.service';
import {
  ChessBoardSuggestionFacade,
  IChessBoardSuggestionEngineService,
  ISuggestionEvaluationResult
} from '../../utils/chess-board-suggestion.facade';
import { ChessBoardOpeningFacade, IChessBoardOpeningStateAccessors } from '../../utils/chess-board-opening.facade';
import { ChessBoardMoveFacade, IDropMoveContext } from '../../utils/chess-board-move.facade';
import { ChessBoardVisualizationFacade } from '../../utils/chess-board-visualization.facade';
import { ChessBoardTimelineFacade } from '../../utils/chess-board-timeline.facade';
import { ChessBoardClockGameStateFacade } from '../../utils/chess-board-clock-game-state.facade';
import { ChessBoardEvaluationFacade } from '../../utils/chess-board-evaluation.facade';
import { ChessBoardOverlayFacade } from '../../utils/chess-board-overlay.facade';
import { ChessBoardUiStateFacade } from '../../utils/chess-board-ui-state.facade';

@Component({
  selector: 'app-chess-board',
  templateUrl: './chess-board.component.html',
  styleUrls: ['./chess-board.component.less'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    ChessBoardGridComponent,
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
  public static readonly NA_PLACEHOLDER = 'n/a';
  readonly uiText = UiText;
  readonly boardIndices: number[] = Array.from({ length: ChessConstants.BOARD_SIZE }, (_, idx) => idx);
  @ViewChild('chessField') chessField: ElementRef;
  @ViewChild('historyLog') historyLog: ChessBoardHistoryCardComponent | ElementRef<HTMLDivElement>;
  mateInOneTargets: {[key: string]: boolean} = {};
  mateInOneBlunderTargets: {[key: string]: boolean} = {};
  isDragPreviewActive = false;
  private lastMatePreviewKey = '';
  
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
  private readonly evalByHistoryIndex = new Map<number, string>();
  private readonly evalCacheByFen = new Map<string, string>();
  private readonly suggestedMovesCacheByFen = new Map<string, string[]>();
  private readonly suggestionQualityByFen = new Map<string, Record<string, string>>();
  private readonly suggestionEvalTextByFen = new Map<string, Record<string, string>>();
  private readonly pendingEvalByHistoryIndex = new Set<number>();
  private readonly evalErrorByHistoryIndex = new Set<number>();
  private evaluationRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private evaluationRunToken = 0;
  private readonly evaluationDebounceMs = 140;
  private readonly pendingEvaluationPlaceholder = '...';
  private readonly evaluationErrorPlaceholder = 'err';
  private readonly analysisClampPawns = 10;
  private readonly suggestedMovesDepth = 12;
  private readonly suggestedMovesCount = 3;
  readonly suggestedMovesLoadingPlaceholder = [this.pendingEvaluationPlaceholder];
  suggestedMoves: string[] = [...this.suggestedMovesLoadingPlaceholder];
  private suggestionQualityByMove: Record<string, string> = {};
  private suggestionEvalTextByMove: Record<string, string> = {};
  openingsLoaded = false;
  private openings: IParsedOpening[] = [];
  private activeOpening: IParsedOpening | null = null;
  private activeOpeningHistoryKey = '';
  private readonly openingStateAccessors: IChessBoardOpeningStateAccessors = {
    getOpeningsLoaded: () => this.openingsLoaded,
    setOpeningsLoaded: (value) => { this.openingsLoaded = value; },
    getOpenings: () => this.openings,
    setOpenings: (value) => { this.openings = value; },
    getActiveOpening: () => this.activeOpening,
    setActiveOpening: (value) => { this.activeOpening = value; },
    getActiveOpeningHistoryKey: () => this.activeOpeningHistoryKey,
    setActiveOpeningHistoryKey: (value) => { this.activeOpeningHistoryKey = value; }
  };
  private openingsLoadId = 0;
  private suggestedMoveArrowSnapshot: Record<string, ChessArrowDto> | null = null;
  ambientStyle: {[key: string]: string} = {};
  canDropPredicate = (drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean =>
    this.canDrop(drag, drop);

  get suggestionQualityByMoveMap(): Record<string, string> {
    return this.suggestionQualityByMove;
  }

  get suggestionEvalTextByMoveMap(): Record<string, string> {
    return this.suggestionEvalTextByMove;
  }

  get allHistoryEvaluations(): string[] {
    const fullHistory = this.chessBoardStateService.history || [];
    return fullHistory.map((_, idx) => this.getEvaluationForMove(idx));
  }

  get visibleHistoryEvaluations(): string[] {
    const visibleHistory = this.getVisibleHistory();
    return visibleHistory.map((_, idx) => this.getEvaluationForMove(idx));
  }

  get pendingEvaluationPlaceholderText(): string {
    return this.pendingEvaluationPlaceholder;
  }

  get evaluationErrorPlaceholderText(): string {
    return this.evaluationErrorPlaceholder;
  }

  get naPlaceholderText(): string {
    return ChessBoardComponent.NA_PLACEHOLDER;
  }

  get analysisClampPawnsLimit(): number {
    return this.analysisClampPawns;
  }

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
    private readonly chessBoardCctService: ChessBoardCctService,
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
    this.scheduleHistoryAutoScroll();
  }

  resetTransientUiState(): void {
    this.pendingDrawOfferBy = null;
    this.resignConfirmColor = null;
    this.mockHistoryCursor = null;
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};
    this.lastMatePreviewKey = '';
  }

  resetBoardState(): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return;
    }
    this.chessBoardStateService.boardHelper.history = {} as {[name: string]: string};
    this.chessBoardStateService.boardHelper.gameOver = false;
    this.chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    this.chessBoardStateService.field = ChessBoardInitializationUtils.createInitialField();
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

  onDropListEntered(event: IChessBoardGridMovePreviewEvent | null): void {
    if (!event) {
      return;
    }
    this.previewHoverMateInOne(
      event.sourceRow,
      event.sourceCol,
      event.targetRow,
      event.targetCol,
      event.isValidMove
    );
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

  onSquarePointerDown(piece: ChessPieceDto | null): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return;
    }

    if (this.chessBoardStateService.boardHelper.gameOver) {
      this.setSubtleDebugReason(ChessBoardMessageConstants.GAME_OVER_START_NEW);
      return;
    }

    if (!piece) {
      this.setSubtleDebugReason(ChessBoardMessageConstants.NO_PIECE_ON_SQUARE);
      return;
    }
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

    this.chessBoardStateService.ensureRepetitionTrackingState();
    const moveContext = ChessBoardMoveFacade.buildDropMoveContext(event);
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
    return ChessBoardMoveFacade.canProcessDropEvent({
      event,
      hasBoardState: !!(this.chessBoardStateService && this.chessBoardStateService.boardHelper),
      gameOver: !!(this.chessBoardStateService && this.chessBoardStateService.boardHelper && this.chessBoardStateService.boardHelper.gameOver),
      onGameOver: () => this.setSubtleDebugReason(ChessBoardMoveFacade.gameOverNoMovesMessage())
    });
  }

  private validateDropMove(moveContext: IDropMoveContext, event: CdkDragDrop<ChessPieceDto[]>): boolean {
    return ChessBoardMoveFacade.validateDropMove({
      moveContext,
      event,
      board: this.chessBoardStateService.field,
      getDragFailureReason: (srcRow, srcCell, sourcePiece) => this.getDragFailureReason(srcRow, srcCell, sourcePiece),
      setSubtleDebugReason: (reason) => this.setSubtleDebugReason(reason)
    });
  }

  private prepareUiForDrop(moveContext: { srcColor: ChessColorsEnum }): void {
    const wasClockStarted = this.clockStarted;
    this.pendingDrawOfferBy = ChessBoardMoveFacade.prepareUiForDrop({
      clockStarted: this.clockStarted,
      pendingDrawOfferBy: this.pendingDrawOfferBy,
      srcColor: moveContext.srcColor,
      startClock: () => this.startClock(),
      randomizeAmbientStyle: () => this.randomizeAmbientStyle(),
      boardHelper: this.chessBoardStateService.boardHelper
    });
    if (!wasClockStarted) {
      this.clockStarted = true;
    }
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};
  }

  private applyPromotionAvailability(moveContext: IDropMoveContext): void {
    ChessBoardMoveFacade.applyPromotionAvailability(moveContext, this.chessBoardStateService.boardHelper);
  }

  private applyPreTransferBoardState(event: CdkDragDrop<ChessPieceDto[]>, moveContext: IDropMoveContext): {
    isHit: boolean;
    isEP: boolean;
    castleData: string | null;
  } {
    return ChessBoardMoveFacade.applyPreTransferBoardState({
      event,
      moveContext,
      field: this.chessBoardStateService.field,
      history: this.chessBoardStateService.history,
      boardHelper: this.chessBoardStateService.boardHelper
    });
  }

  private finalizeDropState(
    moveContext: IDropMoveContext,
    moveFlags: { isHit: boolean; isEP: boolean; castleData: string | null }
  ): void {
    this.isFinalizingDropState = true;
    ChessBoardMoveFacade.finalizeDropState({
      moveContext,
      moveFlags,
      field: this.chessBoardStateService.field,
      boardHelper: this.chessBoardStateService.boardHelper,
      isKingInCheck: (board, color) => this.isKingInCheck(board, color),
      hasAnyLegalMove: (board, color) => this.hasAnyLegalMove(board, color),
      checkmateDebugText:
        `${this.uiText.message.checkmateCallout} ${moveContext.srcColor === ChessColorsEnum.White ? this.uiText.status.white : this.uiText.status.black} ${this.uiText.message.checkmateWinner}`,
      addIncrementToColor: (color) => this.addIncrementToColor(color),
      applyDrawRules: (hasLegalMoves, isCheck) => this.applyDrawRules(hasLegalMoves, isCheck)
    });
    this.appendCheckmateResultIfNeeded();
    this.isFinalizingDropState = false;
    this.pushSnapshotForCurrentState();
  }

  private appendCheckmateResultIfNeeded(): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return;
    }
    const matedColor = this.chessBoardStateService.boardHelper.checkmateColor;
    if (matedColor === null) {
      return;
    }
    const winnerResult: '1-0' | '0-1' = matedColor === ChessColorsEnum.White ? '0-1' : '1-0';
    const checkmateReason = (this.uiText.status.checkmatePrefix || 'Checkmate').trim() || 'Checkmate';
    this.appendGameResultToLastMove(winnerResult, checkmateReason);
  }

  private setSubtleDebugReason(reason: string): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || !reason) {
      return;
    }
    const subtleReason = ChessBoardUiStateFacade.getSubtleDebugText(
      reason,
      this.chessBoardStateService.boardHelper.debugText
    );
    if (!subtleReason) {
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

  isMateInOneTarget(targetRow: number, targetCol: number): boolean {
    return !!this.mateInOneTargets[`${targetRow}${targetCol}`];
  }

  isMateInOneBlunderTarget(targetRow: number, targetCol: number): boolean {
    return !!this.mateInOneBlunderTargets[`${targetRow}${targetCol}`];
  }

  onDebugPanelToggle(isOpen: boolean): void {
    this.isDebugPanelOpen = !!isOpen;
    ChessBoardStorageService.persistDebugPanelOpenState(this.debugPanelStorageKey, this.isDebugPanelOpen);
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

    // clearOverlay already clears arrows and show-moves highlights
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
            const afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
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
    const offerResult = ChessBoardUiStateFacade.tryOfferDraw(
      this.chessBoardStateService.boardHelper.gameOver,
      this.pendingDrawOfferBy,
      this.chessBoardStateService.boardHelper.colorTurn
    );
    if (!offerResult.offered) {
      return;
    }
    this.pendingDrawOfferBy = offerResult.pendingDrawOfferBy;
    this.randomizeAmbientStyle();
  }

  canOfferDraw(): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    return ChessBoardClockGameStateFacade.canOfferDraw(
      this.chessBoardStateService.boardHelper.gameOver,
      this.pendingDrawOfferBy
    );
  }

  canRespondToDrawOffer(): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    return ChessBoardClockGameStateFacade.canRespondToDrawOffer(
      this.chessBoardStateService.boardHelper.gameOver,
      this.pendingDrawOfferBy,
      this.chessBoardStateService.boardHelper.colorTurn
    );
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
    const nextTimeControl = ChessBoardClockGameStateFacade.getAppliedTimeControl(baseMinutes, incrementSeconds, label);
    this.selectedClockPresetLabel = nextTimeControl.selectedClockPresetLabel;
    this.incrementMs = nextTimeControl.incrementMs;
    this.whiteClockMs = nextTimeControl.whiteClockMs;
    this.blackClockMs = nextTimeControl.blackClockMs;
    this.clockStarted = nextTimeControl.clockStarted;
    this.clockRunning = nextTimeControl.clockRunning;
    this.lastClockTickAt = nextTimeControl.lastClockTickAt;
  }

  startOrPauseClock(): void {
    if (!ChessBoardClockGameStateFacade.canToggleClock(this.chessBoardStateService.boardHelper.gameOver)) {
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

  getResignConfirmTitle(): string {
    const colorName = this.resignConfirmColor === ChessColorsEnum.White
      ? this.uiText.status.white
      : this.uiText.status.black;
    return this.uiText.resignConfirm.titleTemplate.replace('{color}', colorName);
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
    this.chessBoardStateService.ensureRepetitionTrackingState();
    return ChessBoardClockGameStateFacade.getClaimDrawReason(
      this.chessBoardStateService.isThreefoldRepetition(),
      this.chessBoardStateService.isFiftyMoveRule()
    ) !== null;
  }

  claimDraw(): void {
    if (!this.canClaimDraw()) {
      return;
    }
    const claimReason = ChessBoardClockGameStateFacade.getClaimDrawReason(
      this.chessBoardStateService.isThreefoldRepetition(),
      this.chessBoardStateService.isFiftyMoveRule()
    );
    if (claimReason === 'threefold') {
      this.setDrawState(ChessBoardMessageConstants.DRAW_BY_THREEFOLD_TEXT, ChessBoardMessageConstants.DRAW_BY_THREEFOLD_TITLE);
      return;
    }
    if (claimReason === 'fifty-move') {
      this.setDrawState(ChessBoardMessageConstants.DRAW_BY_FIFTY_MOVE_TEXT, ChessBoardMessageConstants.DRAW_BY_FIFTY_MOVE_TITLE);
    }
  }

  canResign(color: ChessColorsEnum): boolean {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper) {
      return false;
    }
    return ChessBoardClockGameStateFacade.canResign(this.chessBoardStateService.boardHelper.gameOver, color);
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
    return ChessBoardTimelineFacade.getVisibleHistory(this.chessBoardStateService.history || [], this.mockHistoryCursor);
  }

  getHistoryMaxMoveIndex(): number {
    return this.getMaxMoveIndex();
  }

  canUndoMove(): boolean {
    return ChessBoardTimelineFacade.canUndoMove(this.getMaxMoveIndex(), this.mockHistoryCursor);
  }

  canRedoMove(): boolean {
    return ChessBoardTimelineFacade.canRedoMove(this.getMaxMoveIndex(), this.mockHistoryCursor);
  }

  undoMove(): void {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0) {
      return;
    }
    const nextCursor = ChessBoardTimelineFacade.getUndoCursor(maxIndex, this.mockHistoryCursor);
    if (nextCursor === null) {
      return;
    }
    this.mockHistoryCursor = nextCursor;
    this.restoreSnapshotForVisibleHistory();
  }

  redoMove(): void {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0 || this.mockHistoryCursor === null) {
      return;
    }
    this.mockHistoryCursor = ChessBoardTimelineFacade.getRedoCursor(maxIndex, this.mockHistoryCursor);
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
    const historySteps = ChessBoardOpeningFacade.normalizeHistorySteps(this.getVisibleHistory());
    this.updateRecognizedOpeningForCurrentHistory(historySteps);
    return ChessBoardOpeningFacade.getRecognitionLabel(
      this.getOpeningStateAccessors(),
      historySteps,
      this.uiText
    );
  }

  private loadOpeningsFromAssets(locale: string): void {
    const loadId = ++this.openingsLoadId;
    ChessBoardOpeningFacade.loadOpeningsFromAssets({
      http: this.http,
      locale,
      defaultLocale: UiTextLoaderService.DEFAULT_LOCALE,
      loadId,
      getCurrentLoadId: () => this.openingsLoadId,
      state: this.getOpeningStateAccessors(),
      onReady: () => {
        this.updateRecognizedOpeningForCurrentHistory();
        this.requestClockRender();
      }
    });
  }

  private updateRecognizedOpeningForCurrentHistory(
    historySteps: string[] = ChessBoardOpeningFacade.normalizeHistorySteps(this.getVisibleHistory())
  ): void {
    ChessBoardOpeningFacade.updateRecognizedOpeningForHistory(
      this.getOpeningStateAccessors(),
      historySteps,
      this.uiText,
      ChessBoardComponent.NA_PLACEHOLDER,
      (debugText) => {
        this.chessBoardStateService.boardHelper.debugText = debugText;
      }
    );
  }

  private getOpeningStateAccessors(): IChessBoardOpeningStateAccessors {
    return this.openingStateAccessors;
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
    const arrows = ChessBoardSuggestionFacade.buildSuggestedMovePreviewArrows(
      this.chessBoardStateService.field,
      turnColor,
      parsedMove
    );
    const kingContextArrows = this.buildKingContextPreviewArrows(parsedMove, turnColor);
    kingContextArrows.forEach(arrow => arrows.push(arrow));
    arrows.forEach(arrow => ChessBoardStateService.createArrowFromVisualization(arrow));
  }

  clearSuggestedMoveArrows(): void {
    if (!this.chessBoardStateService || !this.chessBoardStateService.boardHelper || this.suggestedMoveArrowSnapshot === null) {
      return;
    }
    this.chessBoardStateService.boardHelper.arrows = { ...this.suggestedMoveArrowSnapshot };
    this.suggestedMoveArrowSnapshot = null;
  }

  getCctRecommendations(category: CctCategoryEnum): ICctRecommendation[] {
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
    const now = new Date();
    this.chessBoardStateService.boardHelper.debugText = ChessBoardExportFacade.getImageDebugText(
      this.uiText.message.mockExportImageReady,
      now
    );
    const imageDataUrl = await this.createBoardImageDataUrlFromDom();
    if (imageDataUrl) {
      this.downloadDataUrl(
        imageDataUrl,
        ChessBoardExportFacade.getImageFileName(now)
      );
    }
  }

  showForkIdeas(): void {
    ChessBoardOverlayFacade.applyOverlayTool({
      activeTool: this.activeTool,
      key: 'fork-ideas',
      clearOverlay: () => this.clearOverlay(),
      buildArrows: () => this.collectForkVisualizationArrows(),
      addArrow: (arrow) => ChessBoardStateService.createArrowFromVisualization(arrow),
      setActiveTool: (tool) => {
        this.activeTool = tool;
      },
      setActiveWhenEmpty: false
    });
    this.chessBoardStateService.boardHelper.debugText = this.uiText.message.forkIdeas;
  }

  showPinIdeas(): void {
    ChessBoardOverlayFacade.applyOverlayTool({
      activeTool: this.activeTool,
      key: 'pin-ideas',
      clearOverlay: () => this.clearOverlay(),
      buildArrows: () => this.collectPinVisualizationArrows(),
      addArrow: (arrow) => ChessBoardStateService.createArrowFromVisualization(arrow),
      setActiveTool: (tool) => {
        this.activeTool = tool;
      },
      setActiveWhenEmpty: false
    });
    this.chessBoardStateService.boardHelper.debugText = this.uiText.message.pinIdeas;
  }

  exportFen(): void {
    const fen = this.getCurrentFen();
    this.chessBoardStateService.boardHelper.debugText = `${fen}`;
    void this.copyToClipboard(fen);
  }

  private getCurrentPgn(): string {
    return ChessBoardExportFacade.getCurrentPgn(
      !!(this.chessBoardStateService && this.chessBoardStateService.boardHelper),
      this.chessBoardStateService ? (this.chessBoardStateService.history || []) : []
    );
  }

  private getCurrentFen(): string {
    return ChessBoardExportFacade.getCurrentFen({
      hasBoardState: !!(this.chessBoardStateService && this.chessBoardStateService.boardHelper && this.chessBoardStateService.field),
      board: this.chessBoardStateService ? this.chessBoardStateService.field : null,
      turn: this.chessBoardStateService && this.chessBoardStateService.boardHelper
        ? this.chessBoardStateService.boardHelper.colorTurn
        : null,
      moveHistory: this.chessBoardStateService ? (this.chessBoardStateService.history || []) : [],
      helperHistory: this.chessBoardStateService && this.chessBoardStateService.boardHelper
        ? (this.chessBoardStateService.boardHelper.history || {})
        : {}
    });
  }

  private async createBoardImageDataUrlFromDom(): Promise<string | null> {
    return ChessBoardExportFacade.createBoardImageDataUrlFromDom({
      getDocumentRef: () => this.getDocumentRef(),
      getWindowRef: () => this.getWindowRef(),
      chessFieldNativeElement: this.chessField?.nativeElement || null
    });
  }

  private downloadDataUrl(dataUrl: string, fileName: string): void {
    ChessBoardExportFacade.downloadDataUrl(dataUrl, fileName, () => this.getDocumentRef());
  }

  private getDocumentRef(): Document {
    return document;
  }

  private getWindowRef(): Window {
    return window;
  }

  private copyToClipboard(text: string): Promise<boolean> {
    return ChessBoardExportFacade.copyToClipboard(text);
  }

  private parseSuggestedMove(move: string): { piece: ChessPiecesEnum, targetRow: number, targetCol: number } | null {
    return ChessBoardCctUtils.parseSuggestedMove(move);
  }

  private buildKingContextPreviewArrows(
    parsedMove: { piece: ChessPiecesEnum, targetRow: number, targetCol: number },
    turnColor: ChessColorsEnum
  ): IVisualizationArrow[] {
    if (!this.chessBoardStateService || !this.chessBoardStateService.field) {
      return [];
    }
    const board = this.chessBoardStateService.field;
    const enemyColor = this.getOpponentColor(turnColor);
    const arrows: IVisualizationArrow[] = [];
    const seen = new Set<string>();

    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0])) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        if (sourcePiece.color !== turnColor || sourcePiece.piece !== parsedMove.piece) {
          continue;
        }
        const canMove = this.canPlayLegalMove(
          board,
          srcRow,
          srcCol,
          parsedMove.targetRow,
          parsedMove.targetCol,
          turnColor,
          sourcePiece
        );
        if (!canMove) {
          continue;
        }

        const afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, parsedMove.targetRow, parsedMove.targetCol);
        this.collectKingAttackPreviewArrows(afterMove, turnColor, enemyColor, arrows, seen);
        this.collectKingDefensePreviewArrows(afterMove, turnColor, enemyColor, arrows, seen);
      }
    }

    return arrows;
  }

  private collectKingAttackPreviewArrows(
    board: ChessPieceDto[][][],
    attackerColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum,
    arrows: IVisualizationArrow[],
    seen: Set<string>
  ): void {
    const enemyKing = this.findKing(board, enemyColor);
    if (!enemyKing) {
      return;
    }
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const sourceCell = board[row][col];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === attackerColor)) {
          continue;
        }
        const canAttackKing = this.canPlayLegalMove(
          board,
          row,
          col,
          enemyKing.row,
          enemyKing.col,
          attackerColor,
          sourceCell[0]
        );
        if (!canAttackKing) {
          continue;
        }
        this.pushUniquePreviewArrow(
          arrows,
          seen,
          this.createVisualizationArrow(
            new ChessPositionDto(8 - row, col + 1),
            new ChessPositionDto(8 - enemyKing.row, enemyKing.col + 1),
            'red',
            0.5
          )
        );
      }
    }
  }

  private collectKingDefensePreviewArrows(
    board: ChessPieceDto[][][],
    defenderColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum,
    arrows: IVisualizationArrow[],
    seen: Set<string>
  ): void {
    const ownKing = this.findKing(board, defenderColor);
    if (!ownKing) {
      return;
    }
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        if (row === ownKing.row && col === ownKing.col) {
          continue;
        }
        const sourceCell = board[row][col];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === defenderColor)) {
          continue;
        }
        const canDefendKing = this.withBoardContext(board, defenderColor, () =>
          ChessRulesService.canStepThere(
            ownKing.row,
            ownKing.col,
            [new ChessPieceDto(enemyColor, ChessPiecesEnum.King)],
            row,
            col,
            new ChessPieceDto(sourceCell[0].color, sourceCell[0].piece)
          )
        );
        if (!canDefendKing) {
          continue;
        }
        this.pushUniquePreviewArrow(
          arrows,
          seen,
          this.createVisualizationArrow(
            new ChessPositionDto(8 - row, col + 1),
            new ChessPositionDto(8 - ownKing.row, ownKing.col + 1),
            'gold',
            0.3
          )
        );
      }
    }
  }

  private pushUniquePreviewArrow(arrows: IVisualizationArrow[], seen: Set<string>, arrow: IVisualizationArrow): void {
    const key = `${arrow.fromRow}:${arrow.fromCol}:${arrow.toRow}:${arrow.toCol}:${arrow.color}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    arrows.push(arrow);
  }

  resign(color: ChessColorsEnum): void {
    if (!this.canResign(color)) {
      return;
    }

    const resignState = ChessBoardUiStateFacade.buildResignStateTransition(
      color,
      this.uiText.status.white,
      this.uiText.status.black,
      this.uiText.message.resigns,
      this.uiText.message.resignsNoPeriod
    );

    this.resignConfirmColor = resignState.resignConfirmColor;
    this.stopClock();
    this.pendingDrawOfferBy = resignState.pendingDrawOfferBy;
    this.chessBoardStateService.boardHelper.gameOver = resignState.gameOver;
    this.chessBoardStateService.boardHelper.checkmateColor = resignState.checkmateColor;
    this.chessBoardStateService.boardHelper.debugText = resignState.debugText;
    this.appendGameResultToLastMove(resignState.result, resignState.historyReason);
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

            const afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
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

    const board = ChessBoardLogicUtils.cloneField(this.chessBoardStateService.field);
    const sourceCell = board[srcRow][srcCol];
    const forColor = sourceCell && sourceCell[0]
      ? sourceCell[0].color
      : this.chessBoardStateService.boardHelper.colorTurn as ChessColorsEnum;
    const enemyColor = forColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);

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
    this.chessBoardStateService.clearMoveHighlights();
  }

  /**
   * Remove any active visualization arrows and reset the active tool flag.
   * This is used internally by the various "show*" helpers and also when the
   * flip button is pressed so that only one overlay is visible at a time.
   */
  clearOverlay(): void {
    this.chessBoardStateService.boardHelper.arrows = {};
    this.chessBoardStateService.clearMoveHighlights();
    this.suggestedMoveArrowSnapshot = null;
    this.activeTool = null;
  }

  showThreats(ofEnemy = false): void {
    const key = ofEnemy ? 'threats-enemy' : 'threats-mine';
    ChessBoardOverlayFacade.applyOverlayTool({
      activeTool: this.activeTool,
      key,
      clearOverlay: () => this.clearOverlay(),
      buildArrows: () => {
        const { ofColor, enemyColor } = this.initColors(ofEnemy);
        return ChessBoardVisualizationFacade.buildThreatArrows(
          this.chessBoardStateService.field,
          ofColor,
          enemyColor,
          (cell, rowIdx, cellIdx, srcColor, dstColor) => this.getThreatsBy(cell, rowIdx, cellIdx, srcColor, dstColor),
          (cellA, rowAIdx, cellAIdx, color, enemy) => this.getProtectors(cellA, rowAIdx, cellAIdx, color, enemy)
        );
      },
      addArrow: (arrow) => ChessBoardStateService.createArrowFromVisualization(arrow),
      setActiveTool: (tool) => {
        this.activeTool = tool;
      }
    });
  }

  getThreatsBy(
    _cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const board = this.chessBoardStateService.field;
    return ChessBoardVisualizationFacade.getThreatsBy(
      board,
      rowIdx,
      cellIdx,
      ofColor,
      enemyColor,
      (boardArg, srcRow, srcCol, targetRow, targetCol, forColor, sourcePiece) =>
        this.canPlayLegalMove(boardArg, srcRow, srcCol, targetRow, targetCol, forColor, sourcePiece)
    );
  }

  getThreatsOn(
    _cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    _defendedColor: ChessColorsEnum,
    attackerColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const board = this.chessBoardStateService.field;
    return ChessBoardVisualizationFacade.getThreatsOn(
      board,
      rowIdx,
      cellIdx,
      attackerColor,
      (boardArg, srcRow, srcCol, targetRow, targetCol, forColor, sourcePiece) =>
        this.canPlayLegalMove(boardArg, srcRow, srcCol, targetRow, targetCol, forColor, sourcePiece)
    );
  }

  showProtected(ofEnemy = false): void {
    const key = ofEnemy ? 'protected-enemy' : 'protected-mine';
    ChessBoardOverlayFacade.applyOverlayTool({
      activeTool: this.activeTool,
      key,
      clearOverlay: () => this.clearOverlay(),
      buildArrows: () => {
        const { ofColor, enemyColor } = this.initColors(ofEnemy);
        return ChessBoardVisualizationFacade.buildProtectedArrows(
          this.chessBoardStateService.field,
          ofColor,
          enemyColor,
          (cellA, rowAIdx, cellAIdx, color, enemy) => this.getProtectors(cellA, rowAIdx, cellAIdx, color, enemy),
          (cell, rowIdx, cellIdx, defendedColor, attackerColor) =>
            this.getThreatsOn(cell, rowIdx, cellIdx, defendedColor, attackerColor)
        );
      },
      addArrow: (arrow) => ChessBoardStateService.createArrowFromVisualization(arrow),
      setActiveTool: (tool) => {
        this.activeTool = tool;
      }
    });
  }

  getProtectors(
    cellA: ChessPieceDto[],
    rowAIdx: number,
    cellAIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): ChessPositionDto[] {
    return ChessBoardVisualizationFacade.getProtectors(
      this.chessBoardStateService.field,
      cellA,
      rowAIdx,
      cellAIdx,
      ofColor,
      enemyColor
    );
  }

  showHangingPieces(ofEnemy = false): void {
    const key = ofEnemy ? 'hanging-enemy' : 'hanging-mine';
    ChessBoardOverlayFacade.applyOverlayTool({
      activeTool: this.activeTool,
      key,
      clearOverlay: () => this.clearOverlay(),
      buildArrows: () => {
        const { ofColor, enemyColor } = this.initColors(ofEnemy);
        return ChessBoardVisualizationFacade.buildHangingArrows(
          this.chessBoardStateService.field,
          ofColor,
          enemyColor,
          (cellA, rowAIdx, cellAIdx, color, enemy) => this.getProtectors(cellA, rowAIdx, cellAIdx, color, enemy),
          (cell, rowIdx, cellIdx, defendedColor, attackerColor) =>
            this.getThreatsOn(cell, rowIdx, cellIdx, defendedColor, attackerColor)
        );
      },
      addArrow: (arrow) => ChessBoardStateService.createArrowFromVisualization(arrow),
      setActiveTool: (tool) => {
        this.activeTool = tool;
      }
    });
  }

  private initColors(ofEnemy: boolean): { ofColor: ChessColorsEnum, enemyColor: ChessColorsEnum} {
    return ChessBoardVisualizationFacade.initColors(
      this.chessBoardStateService.boardHelper.colorTurn as ChessColorsEnum,
      ofEnemy
    );
  }

  private createVisualizationArrow(
    from: ChessPositionDto,
    to: ChessPositionDto,
    color: IVisualizationArrow['color'],
    intensity: number
  ): IVisualizationArrow {
    return ChessBoardVisualizationFacade.createVisualizationArrow(from, to, color, intensity);
  }

  private collectForkVisualizationArrows(): IVisualizationArrow[] {
    return ChessBoardVisualizationFacade.buildForkArrows(
      this.chessBoardStateService.field,
      (cell, rowIdx, cellIdx, srcColor, dstColor) => this.getThreatsBy(cell, rowIdx, cellIdx, srcColor, dstColor)
    );
  }

  private collectPinVisualizationArrows(): IVisualizationArrow[] {
    return ChessBoardVisualizationFacade.buildPinArrows(
      this.chessBoardStateService.field,
      (piece) => this.getPinDirections(piece),
      (row, col) => this.isWithinBoard(row, col),
      (pinned, protectedPiece) => this.isPinnedToValuablePiece(pinned, protectedPiece),
      (frontPiece, rearPiece) => this.isSkewerPair(frontPiece, rearPiece)
    );
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

    const afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
    return !this.isKingInCheck(afterMove, forColor);
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
            const afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
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
    ChessBoardMoveFacade.applyDrawRules({
      gameOver: this.chessBoardStateService.boardHelper.gameOver,
      hasLegalMovesForCurrentTurn,
      isCurrentTurnInCheck,
      field: this.chessBoardStateService.field,
      recordCurrentPosition: () => this.chessBoardStateService.recordCurrentPosition(),
      isFivefoldRepetition: () => this.chessBoardStateService.isFivefoldRepetition(),
      isSeventyFiveMoveRule: () => this.chessBoardStateService.isSeventyFiveMoveRule(),
      setDrawState: (message, reason) => this.setDrawState(message, reason)
    });
  }

  private setDrawState(message: string, historyReason: string): void {
    const drawState = ChessBoardUiStateFacade.buildDrawStateTransition(message, historyReason);
    this.chessBoardStateService.boardHelper.gameOver = drawState.gameOver;
    this.chessBoardStateService.boardHelper.checkmateColor = drawState.checkmateColor;
    this.chessBoardStateService.boardHelper.debugText = drawState.debugText;
    this.pendingDrawOfferBy = drawState.pendingDrawOfferBy;
    this.appendGameResultToLastMove(drawState.result, drawState.historyReason);
  }

  private getOpponentColor(color: ChessColorsEnum): ChessColorsEnum {
    return color === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
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
    const startResult = ChessBoardClockGameStateFacade.startClock(
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
    const stopResult = ChessBoardClockGameStateFacade.stopClock(this.clockIntervalId);
    this.clockIntervalId = stopResult.clockIntervalId;
    this.clockRunning = stopResult.clockRunning;
    this.requestClockRender();
  }

  private tickClock(): void {
    const tickResult = ChessBoardClockGameStateFacade.tickClock(
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
    const nextClocks = ChessBoardClockGameStateFacade.addIncrementToColor(
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
    const forfeitResult = ChessBoardClockGameStateFacade.handleTimeForfeit(
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
    this.moveSnapshots = ChessBoardTimelineFacade.getInitializedSnapshots(() => this.captureCurrentSnapshot());
    this.mockHistoryCursor = null;
    this.resetEvaluationState();
    this.scheduleEvaluationRefresh();
    this.scheduleHistoryAutoScroll();
  }

  private pushSnapshotForCurrentState(): void {
    this.moveSnapshots = ChessBoardTimelineFacade.appendSnapshotForCurrentState(
      this.moveSnapshots,
      this.getActiveSnapshotIndex(),
      () => this.captureCurrentSnapshot()
    );
    this.mockHistoryCursor = null;
    this.scheduleEvaluationRefresh();
    this.scheduleHistoryAutoScroll();
  }

  private scheduleHistoryAutoScroll(): void {
    if (!ChessBoardTimelineFacade.shouldAutoScrollHistory(this.previewMode, this.mockHistoryCursor)) {
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
    this.moveSnapshots = ChessBoardTimelineFacade.replaceActiveSnapshot(
      this.moveSnapshots,
      activeSnapshotIndex,
      () => this.captureCurrentSnapshot()
    );
    this.scheduleEvaluationRefresh();
  }

  private restoreSnapshotForVisibleHistory(): void {
    const targetSnapshotIndex = ChessBoardTimelineFacade.getTargetSnapshotIndex(
      this.getMaxMoveIndex(),
      this.mockHistoryCursor,
      this.moveSnapshots.length
    );
    if (targetSnapshotIndex < 0) {
      return;
    }
    this.restoreSnapshot(this.moveSnapshots[targetSnapshotIndex]);
    this.scheduleEvaluationRefresh();
  }

  private resetEvaluationState(): void {
    const resetResult = ChessBoardEvaluationFacade.resetEvaluationState({
      evalByHistoryIndex: this.evalByHistoryIndex,
      pendingEvalByHistoryIndex: this.pendingEvalByHistoryIndex,
      evalErrorByHistoryIndex: this.evalErrorByHistoryIndex,
      evalCacheByFen: this.evalCacheByFen,
      suggestedMovesCacheByFen: this.suggestedMovesCacheByFen,
      suggestionQualityByFen: this.suggestionQualityByFen,
      suggestionEvalTextByFen: this.suggestionEvalTextByFen,
      suggestedMovesLoadingPlaceholder: this.suggestedMovesLoadingPlaceholder,
      evaluationRefreshTimer: this.evaluationRefreshTimer,
      evaluationRunToken: this.evaluationRunToken
    });
    this.evaluationRefreshTimer = resetResult.evaluationRefreshTimer;
    this.evaluationRunToken = resetResult.evaluationRunToken;
    this.suggestedMoves = resetResult.suggestedMoves;
    this.suggestionQualityByMove = resetResult.suggestionQualityByMove;
    this.suggestionEvalTextByMove = resetResult.suggestionEvalTextByMove;
  }

  private scheduleEvaluationRefresh(): void {
    const scheduleResult = ChessBoardEvaluationFacade.scheduleEvaluationRefresh({
      hasEngine: !!this.activeStockfishService,
      previewMode: this.previewMode,
      evaluationRefreshTimer: this.evaluationRefreshTimer,
      evaluationRunToken: this.evaluationRunToken,
      evaluationDebounceMs: this.evaluationDebounceMs,
      runRefresh: (runToken) => {
        this.evaluationRefreshTimer = null;
        void this.refreshVisibleHistoryEvaluations(runToken);
      }
    });
    this.evaluationRunToken = scheduleResult.evaluationRunToken;
    this.evaluationRefreshTimer = scheduleResult.evaluationRefreshTimer;
  }

  private async refreshVisibleHistoryEvaluations(runToken: number): Promise<void> {
    if (!this.activeStockfishService) {
      return;
    }
    await ChessBoardEvaluationFacade.refreshVisibleHistoryEvaluations({
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
      requestRender: () => this.requestClockRender(),
      onRefreshSuggestedMoves: () => this.refreshSuggestedMoves(runToken)
    });
  }

  private async refreshSuggestedMoves(runToken: number): Promise<void> {
    if (!this.activeStockfishService || runToken !== this.evaluationRunToken) {
      return;
    }
    const result = await ChessBoardEvaluationFacade.refreshSuggestedMoves({
      runToken,
      getCurrentRunToken: () => this.evaluationRunToken,
      fen: this.getCurrentFen(),
      getTopMoves: (fen, options) => this.activeStockfishService!.getTopMoves(fen, options),
      suggestedMovesDepth: this.suggestedMovesDepth,
      suggestedMovesCount: this.suggestedMovesCount,
      suggestedMovesCacheByFen: this.suggestedMovesCacheByFen,
      suggestionQualityByFen: this.suggestionQualityByFen,
      suggestionEvalTextByFen: this.suggestionEvalTextByFen,
      suggestedMovesLoadingPlaceholder: this.suggestedMovesLoadingPlaceholder,
      naPlaceholder: ChessBoardComponent.NA_PLACEHOLDER,
      requestRender: () => this.requestClockRender(),
      formatEngineSuggestions: (uciMoves) => this.formatEngineSuggestions(uciMoves),
      refreshSuggestionQualities: (token, fen, topMoves, formatted) =>
        topMoves === undefined && formatted === undefined
          ? this.refreshSuggestionQualities(token, fen)
          : this.refreshSuggestionQualities(token, fen, topMoves || [], formatted || [])
    });
    this.suggestedMoves = result.suggestedMoves;
    this.suggestionQualityByMove = result.suggestionQualityByMove;
    this.suggestionEvalTextByMove = result.suggestionEvalTextByMove;
  }

  private async refreshSuggestionQualities(
    runToken: number,
    fen: string,
    engineTopMoves: string[] = [],
    formattedEngineSuggestions: string[] = []
  ): Promise<void> {
    if (!this.activeStockfishService || runToken !== this.evaluationRunToken) {
      return;
    }
    const result = await ChessBoardEvaluationFacade.refreshSuggestionQualities({
      runToken,
      getCurrentRunToken: () => this.evaluationRunToken,
      fen,
      engineTopMoves,
      formattedEngineSuggestions,
      getTopMoves: (fenArg, options) => this.activeStockfishService!.getTopMoves(fenArg, options),
      suggestedMovesDepth: this.suggestedMovesDepth,
      suggestedMovesCount: this.suggestedMovesCount,
      suggestionQualityByFen: this.suggestionQualityByFen,
      suggestionEvalTextByFen: this.suggestionEvalTextByFen,
      formatEngineSuggestions: (uciMoves) => this.formatEngineSuggestions(uciMoves),
      buildDisplayToUciMap: (topMovesUci, topMovesDisplay) => this.buildDisplayToUciMap(topMovesUci, topMovesDisplay),
      evaluateUciMovesForQuality: (token, fenArg, uniqueMoves) => this.evaluateUciMovesForQuality(token, fenArg, uniqueMoves),
      turnColor: this.chessBoardStateService.boardHelper.colorTurn,
      classifySuggestionLoss: (loss) => ChessBoardSuggestionFacade.classifySuggestionLoss(loss),
      requestRender: () => this.requestClockRender()
    });
    this.suggestionQualityByMove = result.suggestionQualityByMove;
    this.suggestionEvalTextByMove = result.suggestionEvalTextByMove;
  }

  private buildDisplayToUciMap(topMovesUci: string[], topMovesDisplay: string[]): Map<string, string> {
    const cctMoves = [
      ...this.getCctRecommendations(CctCategoryEnum.Captures).map(item => item.move),
      ...this.getCctRecommendations(CctCategoryEnum.Checks).map(item => item.move),
      ...this.getCctRecommendations(CctCategoryEnum.Threats).map(item => item.move)
    ];
    return ChessBoardSuggestionFacade.buildDisplayToUciMap({
      topMovesUci,
      topMovesDisplay,
      cctMoves,
      resolveMoveToUci: (move) => this.resolveMoveToUci(move)
    });
  }

  private async evaluateUciMovesForQuality(runToken: number, fen: string, uniqueUciMoves: string[]): Promise<ISuggestionEvaluationResult> {
    return ChessBoardSuggestionFacade.evaluateUciMovesForQuality({
      runToken,
      getCurrentRunToken: () => this.evaluationRunToken,
      fen,
      uniqueUciMoves,
      engineService: this.activeStockfishService as IChessBoardSuggestionEngineService | undefined,
      suggestedMovesDepth: this.suggestedMovesDepth,
      pendingEvaluationPlaceholder: this.pendingEvaluationPlaceholder,
      evaluationErrorPlaceholder: this.evaluationErrorPlaceholder,
      naPlaceholder: ChessBoardComponent.NA_PLACEHOLDER,
      analysisClampPawns: this.analysisClampPawns
    });
  }

  private formatEngineSuggestions(uciMoves: string[]): string[] {
    return ChessBoardSuggestionFacade.formatEngineSuggestions(
      uciMoves,
      this.chessBoardStateService.field,
      this.suggestedMovesCount
    );
  }

  private resolveMoveToUci(move: string): string | null {
    return ChessBoardSuggestionFacade.resolveMoveToUci({
      move,
      board: this.chessBoardStateService.field,
      turnColor: this.chessBoardStateService.boardHelper.colorTurn
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
      this.chessBoardStateService.trackedHistoryLength,
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
    this.chessBoardStateService.repetitionCounts = restoredState.repetitionCounts;
    this.chessBoardStateService.trackedHistoryLength = restoredState.trackedHistoryLength;
    this.clockStarted = restoredState.clockStarted;
    this.whiteClockMs = restoredState.whiteClockMs;
    this.blackClockMs = restoredState.blackClockMs;
    if (restoredState.shouldRunClock) {
      this.startClock();
    } else {
      this.stopClock();
    }
  }

  getDebugPositionKey(): string {
    return ChessBoardLogicUtils.getPositionKey(
      this.chessBoardStateService.field,
      this.chessBoardStateService.boardHelper.colorTurn,
      this.chessBoardStateService.boardHelper.history
    );
  }

}
