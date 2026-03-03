import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnDestroy, Optional, QueryList, ViewChild, ViewChildren, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragEnter, CdkDragStart, CdkDropList } from '@angular/cdk/drag-drop';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
import { ChessBoardMessageConstants, ChessBoardUiConstants, ChessConstants } from '../../constants/chess.constants';
import { UiText } from '../../constants/ui-text.constants';
import { UiTextLoaderService } from '../../services/ui-text-loader.service';
import { StockfishService } from '../../services/stockfish.service';
import { ChessBoardLanguageToolsComponent } from '../chess-board-language-tools/chess-board-language-tools.component';
import { ChessBoardGridComponent } from '../chess-board-grid/chess-board-grid.component';
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
import { ChessBoardExportFacade } from '../../utils/chess-board-export.facade';
import { ChessBoardComponentUtils } from '../../utils/chess-board-component.utils';
import { ChessBoardStorageService } from '../../services/chess-board-storage.service';
import { ChessBoardClockUtils } from '../../utils/chess-board-clock.utils';
import { ChessBoardEvaluationUtils } from '../../utils/chess-board-evaluation.utils';
import { ChessBoardCctService } from '../../services/chess-board-cct.service';
import {
  ChessBoardSuggestionFacade,
  IChessBoardSuggestionEngineService,
  ISuggestionEvaluationResult
} from '../../utils/chess-board-suggestion.facade';
import { ChessBoardOpeningFacade, IChessBoardOpeningState } from '../../utils/chess-board-opening.facade';
import { ChessBoardMoveFacade, IDropMoveContext } from '../../utils/chess-board-move.facade';
import { ChessBoardVisualizationFacade } from '../../utils/chess-board-visualization.facade';
import { ChessBoardTimelineFacade } from '../../utils/chess-board-timeline.facade';
import { ChessBoardClockGameStateFacade } from '../../utils/chess-board-clock-game-state.facade';
import { ChessBoardEvaluationFacade } from '../../utils/chess-board-evaluation.facade';
import { ChessBoardOverlayFacade } from '../../utils/chess-board-overlay.facade';
import { ChessMoveBadgeUtils } from '../../utils/chess-move-badge.utils';

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

  get toolsVm(): {
    activeTool: string | null;
    isBoardFlipped: boolean;
    canPromote: boolean;
    suggestedMoves: string[];
    suggestedMoveQualityByMove: Record<string, string>;
    suggestedMoveEvalByMove: Record<string, string>;
    openingRecognition: string;
    endgameRecognition: string;
  } {
    return {
      activeTool: this.activeTool,
      isBoardFlipped: this.isBoardFlipped,
      canPromote: this.chessBoardStateService.boardHelper.canPromote !== null,
      suggestedMoves: this.suggestedMoves,
      suggestedMoveQualityByMove: this.suggestionQualityByMoveMap,
      suggestedMoveEvalByMove: this.suggestionEvalTextByMoveMap,
      openingRecognition: this.getMockOpeningRecognition(),
      endgameRecognition: this.getMockEndgameRecognition()
    };
  }

  get cctVm(): {
    captures: ICctRecommendation[];
    checks: ICctRecommendation[];
    threats: ICctRecommendation[];
    moveQualityByMove: Record<string, string>;
    moveEvalByMove: Record<string, string>;
  } {
    return {
      captures: this.getCctRecommendations(this.cctCategory.Captures),
      checks: this.getCctRecommendations(this.cctCategory.Checks),
      threats: this.getCctRecommendations(this.cctCategory.Threats),
      moveQualityByMove: this.suggestionQualityByMoveMap,
      moveEvalByMove: this.suggestionEvalTextByMoveMap
    };
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
    return ChessBoardMoveFacade.canProcessDropEvent({
      event,
      hasBoardState: !!(this.chessBoardStateService && this.chessBoardStateService.boardHelper),
      gameOver: !!(this.chessBoardStateService && this.chessBoardStateService.boardHelper && this.chessBoardStateService.boardHelper.gameOver),
      onGameOver: () => this.setSubtleDebugReason(ChessBoardMoveFacade.gameOverNoMovesMessage())
    });
  }

  private buildDropMoveContext(event: CdkDragDrop<ChessPieceDto[]>): IDropMoveContext | null {
    return ChessBoardMoveFacade.buildDropMoveContext(event);
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

  onDebugPanelToggle(isOpen: boolean): void {
    this.isDebugPanelOpen = !!isOpen;
    ChessBoardStorageService.persistDebugPanelOpenState(this.debugPanelStorageKey, this.isDebugPanelOpen);
  }

  private getStatusTitle(): string {
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

  private getClockButtonLabel(): string {
    return this.clockRunning ? this.uiText.clock.pause : this.uiText.clock.start;
  }

  getResignConfirmTitle(): string {
    const colorName = this.resignConfirmColor === ChessColorsEnum.White
      ? this.uiText.status.white
      : this.uiText.status.black;
    return this.uiText.resignConfirm.titleTemplate.replace('{color}', colorName);
  }

  private formatClock(clockMs: number): string {
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
    return ChessBoardClockGameStateFacade.getClaimDrawReason(
      this.isThreefoldRepetition(),
      this.isFiftyMoveRule()
    ) !== null;
  }

  claimDraw(): void {
    if (!this.canClaimDraw()) {
      return;
    }
    const claimReason = ChessBoardClockGameStateFacade.getClaimDrawReason(
      this.isThreefoldRepetition(),
      this.isFiftyMoveRule()
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

  private getMoveQualityLabel(halfMoveIndex: number): string {
    const quality = this.getMoveQuality(halfMoveIndex);
    return quality ? quality.label : '';
  }

  private getMoveQualityClass(halfMoveIndex: number): string {
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
    const historySteps = ChessBoardOpeningFacade.normalizeHistorySteps(this.getVisibleHistory());
    this.updateRecognizedOpeningForCurrentHistory(historySteps);
    return ChessBoardOpeningFacade.getRecognitionLabel(
      this.getOpeningState(),
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
      state: this.getOpeningState(),
      onReady: () => {
        this.updateRecognizedOpeningForCurrentHistory();
        this.requestClockRender();
      }
    });
  }

  private getOpeningAsset$(fileName: string, locale: string): Observable<IOpeningAssetItem[]> {
    return ChessBoardOpeningUtils.getOpeningAsset$(
      this.http,
      fileName,
      locale,
      UiTextLoaderService.DEFAULT_LOCALE
    );
  }

  private updateRecognizedOpeningForCurrentHistory(
    historySteps: string[] = ChessBoardOpeningFacade.normalizeHistorySteps(this.getVisibleHistory())
  ): void {
    ChessBoardOpeningFacade.updateRecognizedOpeningForHistory(
      this.getOpeningState(),
      historySteps,
      this.uiText,
      ChessBoardComponent.NA_PLACEHOLDER,
      (debugText) => {
        this.chessBoardStateService.boardHelper.debugText = debugText;
      }
    );
  }

  private formatOpeningDebugText(
    opening: IParsedOpening | null,
    matchedDepth: number,
    historyDepthOrSteps: number | string[],
    historyStepsArg: string[] = []
  ): string {
    if (!opening) {
      return '';
    }
    const historySteps = Array.isArray(historyDepthOrSteps) ? historyDepthOrSteps : historyStepsArg;
    const historyDepth = Array.isArray(historyDepthOrSteps) ? historySteps.length : historyDepthOrSteps;
    return ChessBoardOpeningUtils.formatOpeningDebugText(
      opening,
      matchedDepth,
      historyDepth,
      historySteps,
      this.uiText,
      ChessBoardComponent.NA_PLACEHOLDER
    );
  }

  private getOpeningState(): IChessBoardOpeningState {
    return this as unknown as IChessBoardOpeningState;
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

  private getSuggestedMoveClass(move: string): string {
    return ChessMoveBadgeUtils.getMoveClass(move, {}, 'suggested-move--threat');
  }

  private getSuggestionQualityClass(move: string): string {
    if (!move) {
      return '';
    }
    return this.suggestionQualityByMove[move] || '';
  }

  private getSuggestionEvalText(move: string): string {
    return ChessMoveBadgeUtils.getMoveScore(move, this.suggestionEvalTextByMove);
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

        const afterMove = this.simulateMove(board, srcRow, srcCol, parsedMove.targetRow, parsedMove.targetCol);
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
    ChessBoardMoveFacade.applyDrawRules({
      gameOver: this.chessBoardStateService.boardHelper.gameOver,
      hasLegalMovesForCurrentTurn,
      isCurrentTurnInCheck,
      field: this.chessBoardStateService.field,
      recordCurrentPosition: () => this.recordCurrentPosition(),
      isFivefoldRepetition: () => this.isFivefoldRepetition(),
      isSeventyFiveMoveRule: () => this.isSeventyFiveMoveRule(),
      setDrawState: (message, reason) => this.setDrawState(message, reason)
    });
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
    this.chessBoardStateService.clearMoveHighlights();
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
      classifySuggestionLoss: (loss) => this.classifySuggestionLoss(loss),
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

  private classifySuggestionLoss(loss: number): string {
    return ChessBoardSuggestionFacade.classifySuggestionLoss(loss);
  }

  private formatEngineSuggestions(uciMoves: string[]): string[] {
    return ChessBoardSuggestionFacade.formatEngineSuggestions(
      uciMoves,
      this.chessBoardStateService.field,
      this.suggestedMovesCount,
      (square) => this.parseSquareToCoords(square)
    );
  }

  private formatUciMoveForDisplay(uciMove: string): string {
    return ChessBoardSuggestionFacade.formatUciMoveForDisplay(
      uciMove,
      this.chessBoardStateService.field,
      (square) => this.parseSquareToCoords(square)
    );
  }

  private parseSquareToCoords(square: string): { row: number; col: number } | null {
    return ChessBoardSuggestionFacade.parseSquareToCoords(square);
  }

  private resolveMoveToUci(move: string): string | null {
    return ChessBoardSuggestionFacade.resolveMoveToUci({
      move,
      board: this.chessBoardStateService.field,
      turnColor: this.chessBoardStateService.boardHelper.colorTurn,
      parseSquareToCoords: (square) => this.parseSquareToCoords(square)
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

