import { AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragEnter, CdkDropList, transferArrayItem } from '@angular/cdk/drag-drop';
import { ChessPieceDto } from 'src/app/model/chess-piece.dto';
import { GlobalVariablesService } from '../../services/global-variables.service';
import { ChessRulesService } from '../../services/chess-rules.service';
import { ChessPositionDto } from '../../model/chess-position.dto';
import { ChessColorsEnum } from '../../model/chess.colors';
import { ChessPiecesEnum } from '../../model/chess.pieces';
import { IBoardHighlight } from '../../model/board-highlight.interface';
import { IVisualizationArrow } from '../../model/visualization-arrow.interface';

@Component({
  selector: 'app-chess-board',
  templateUrl: './chess-board.component.html',
  styleUrls: ['./chess-board.component.less']
})
export class ChessBoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chessField') chessField: ElementRef;
  @ViewChildren(CdkDropList) dropListElements: QueryList<CdkDropList>;

  dropLists: CdkDropList[] = [];
  mateInOneTargets: {[key: string]: boolean} = {};
  mateInOneBlunderTargets: {[key: string]: boolean} = {};
  isDragPreviewActive = false;
  private lastMatePreviewKey = '';
  private repetitionCounts: {[positionKey: string]: number} = {};
  private trackedHistoryLength = -1;
  chessColors = ChessColorsEnum;
  clockPresets: {label: string; baseMinutes: number; incrementSeconds: number}[] = [
    { label: '1+0', baseMinutes: 1, incrementSeconds: 0 },
    { label: '3+2', baseMinutes: 3, incrementSeconds: 2 },
    { label: '5+0', baseMinutes: 5, incrementSeconds: 0 },
    { label: '10+0', baseMinutes: 10, incrementSeconds: 0 }
  ];
  selectedClockPresetLabel = '5+0';
  whiteClockMs = 0;
  blackClockMs = 0;
  clockRunning = false;
  clockStarted = false;
  private clockIntervalId: number | null = null;
  private lastClockTickAt = 0;
  private incrementMs = 0;
  private readonly clockTickIntervalMs = 200;
  pendingDrawOfferBy: ChessColorsEnum | null = null;
  resignConfirmColor: ChessColorsEnum | null = null;
  mockHistoryCursor: number | null = null;
  isBoardFlipped = false;
  mockExportMessage = '';
  private readonly mockEvalCycle: string[] = [
    '+0.1', '+0.3', '+0.0', '-0.2', '+0.5', '+0.8', '-0.1', '+1.1'
  ];
  private readonly mockOpeningCycle: string[] = [
    'Ruy Lopez (mock)',
    'Queen\'s Gambit (mock)',
    'Italian Game (mock)',
    'Sicilian Defense (mock)'
  ];
  ambientStyle: {[key: string]: string} = {};
  canDropPredicate = (drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean =>
    this.canDrop(drag, drop);

  constructor(public globalVariablesService: GlobalVariablesService) {
    this.randomizeAmbientStyle();
    this.applyTimeControl(5, 0, '5+0');
  }

  ngOnDestroy(): void {
    this.stopClock();
  }

  ngAfterViewInit(): void {
    if (this.dropListElements) {
      setTimeout(() => {
        this.dropLists = this.dropListElements.toArray();
      }, 0);
    }
  }

  canDrop(drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return false;
    }
    if (this.globalVariablesService.boardHelper.gameOver) {
      return false;
    }
    if (!drag || !drop || !drag.dropContainer || !drop.data || !drag.dropContainer.data) {
      return false;
    }
    if (!drag.dropContainer.data[0]) {
      return false;
    }

    const targetLocSplit = drop.id.split('field');
    const targetRow = Number(targetLocSplit[1][0]);
    const targetCol = Number(targetLocSplit[1][1]);
    const sourceLocSplit = drag.dropContainer.id.split('field');
    const sourceRow = Number(sourceLocSplit[1][0]);
    const sourceCol = Number(sourceLocSplit[1][1]);

    return ChessRulesService.validateMove(targetRow, targetCol, drop.data , sourceRow, sourceCol).isValid;
  }

  onDropListEntered(event: CdkDragEnter<ChessPieceDto[]>): void {
    if (!event || !event.item || !event.container || !event.item.dropContainer) {
      return;
    }
    const sourceId = event.item.dropContainer.id;
    const targetId = event.container.id;
    if (!sourceId || !targetId || !sourceId.startsWith('field') || !targetId.startsWith('field')) {
      return;
    }
    const sourceLocSplit = sourceId.split('field');
    const targetLocSplit = targetId.split('field');
    const sourceRow = Number(sourceLocSplit[1][0]);
    const sourceCol = Number(sourceLocSplit[1][1]);
    const targetRow = Number(targetLocSplit[1][0]);
    const targetCol = Number(targetLocSplit[1][1]);

    const targetData = this.globalVariablesService.field[targetRow][targetCol];
    const isValidMove = ChessRulesService.validateMove(targetRow, targetCol, targetData, sourceRow, sourceCol).isValid;
    this.previewHoverMateInOne(sourceRow, sourceCol, targetRow, targetCol, isValidMove);
  }

  onDragStarted(): void {
    this.isDragPreviewActive = true;
  }

  onDragEnded(): void {
    this.isDragPreviewActive = false;
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};
    this.lastMatePreviewKey = '';
  }

  onDrop(event: CdkDragDrop<ChessPieceDto[]>): void {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return;
    }
    if (this.globalVariablesService.boardHelper.gameOver) {
      return;
    }
    if (!event || !event.previousContainer || !event.container || !event.previousContainer.data || !event.container.data) {
      return;
    }
    if (!event.previousContainer.data[0]) {
      return;
    }

    if (event.previousContainer === event.container) {
      return;
    } else {
      this.ensureRepetitionTrackingState();
      const targetId = event.container.id;
      const targetLocSplit = targetId.split('field');
      const targetRow = Number(targetLocSplit[1][0]);
      const targetCell = Number(targetLocSplit[1][1]);

      const srcId = event.previousContainer.id;
      const srcLocSplit = srcId.split('field');
      const srcRow = Number(srcLocSplit[1][0]);
      const srcCell = Number(srcLocSplit[1][1]);

      const isValidMove = ChessRulesService.validateMove(
        targetRow,
        targetCell,
        this.globalVariablesService.field[targetRow][targetCell],
        srcRow,
        srcCell
      ).isValid;
      if (!isValidMove) {
        return;
      }

      if (!this.clockStarted) {
        this.clockStarted = true;
        this.startClock();
      }

      this.randomizeAmbientStyle();

      const srcColor = event.previousContainer.data[0].color;
      if (this.pendingDrawOfferBy !== null && this.pendingDrawOfferBy !== srcColor) {
        this.pendingDrawOfferBy = null;
      }

      // Reset drops and hits
      this.globalVariablesService.boardHelper.debugText = '';
      this.globalVariablesService.boardHelper.possibles = {};
      this.globalVariablesService.boardHelper.hits = {};
      this.globalVariablesService.boardHelper.checks = {};
      this.globalVariablesService.boardHelper.arrows = {};
      this.mateInOneTargets = {};
      this.mateInOneBlunderTargets = {};

      const srcPiece = event.previousContainer.data[0].piece;
      const promotionTargetRow = srcColor === ChessColorsEnum.White ? 0 : 7;
      if (srcPiece === ChessPiecesEnum.Pawn && targetRow === promotionTargetRow) {
        this.globalVariablesService.boardHelper.canPromote = targetCell;
      }

      let isHit = false;
      let isCheck = false;
      let isMatch = false;
      let isEP = false;
      let castleData = null;
      // Remove target on hit before moving the item in the container
      if (event.container && event.container.data && event.container.data[0]) {
        this.globalVariablesService.field[targetRow][targetCell].splice(0, 1);
        isHit = true;
      }
      const isPawnDiagonalToEmpty = srcPiece === ChessPiecesEnum.Pawn
        && Math.abs(targetCell - srcCell) === 1
        && (!event.container.data || event.container.data.length < 1);
      const targetDirectionStep = srcColor === ChessColorsEnum.White ? -1 : 1;
      const enemyFirstStep = srcColor === ChessColorsEnum.Black ? 5 : 2;
      if (isPawnDiagonalToEmpty && (targetRow - srcRow) === targetDirectionStep && targetRow === enemyFirstStep) {
        const epTargetRow = srcColor === ChessColorsEnum.White ? 3 : 4;
        const epSourceRow = srcColor === ChessColorsEnum.White ? 1 : 6;
        const lastHistory = this.globalVariablesService.history[this.globalVariablesService.history.length - 1];
        const possibleEP = GlobalVariablesService.translateNotation(
          epTargetRow, targetCell, epSourceRow, targetCell, ChessPiecesEnum.Pawn, false, false, false, false, null);
        if (lastHistory === possibleEP && this.globalVariablesService.field[epTargetRow][targetCell].length > 0) {
          this.globalVariablesService.field[epTargetRow][targetCell].splice(0, 1);
          isHit = true;
          isEP = true;
        }
      }
      this.globalVariablesService.boardHelper.justDidEnPassant = null;
      const justDidCastle = this.globalVariablesService.boardHelper.justDidCastle;
      if (justDidCastle) {
        const rookCol = justDidCastle.col === 2 ? 0 : 7;
        const rookDestCol = justDidCastle.col === 2 ? 3 : 5;
        const castleRook = this.globalVariablesService.field[justDidCastle.row][rookCol];
        if (castleRook && castleRook[0]) {
          const sourceColor = castleRook[0].color as ChessColorsEnum;
          this.globalVariablesService.field[justDidCastle.row][rookCol].splice(0, 1);
          const newCastleRook = new ChessPieceDto(sourceColor, ChessPiecesEnum.Rook);
          this.globalVariablesService.field[justDidCastle.row][rookDestCol].push(newCastleRook);
          this.globalVariablesService.boardHelper.justDidCastle = null;
          castleData = justDidCastle.col === 2 ? 'O-O-O' : 'O-O';
        }
      }

      if (!event.previousContainer.data || !event.container.data) {
        return;
      }
      transferArrayItem(event.previousContainer.data,
        event.container.data,
        event.previousIndex, event.currentIndex);

      const enemyColor = srcColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
      isCheck = this.isKingInCheck(this.globalVariablesService.field, enemyColor);
      const hasLegalMoves = this.hasAnyLegalMove(this.globalVariablesService.field, enemyColor);
      if (isCheck) {
        isMatch = !hasLegalMoves;
        if (isMatch) {
          this.globalVariablesService.boardHelper.gameOver = true;
          this.globalVariablesService.boardHelper.checkmateColor = enemyColor;
          this.globalVariablesService.boardHelper.debugText =
            `Checkmate! ${srcColor === ChessColorsEnum.White ? 'White' : 'Black'} wins.`;
        }
      }

      const lastNotation = GlobalVariablesService.translateNotation(
        targetRow, targetCell, srcRow, srcCell, srcPiece, isHit, isCheck, isMatch, isEP, castleData);
      GlobalVariablesService.addHistory(lastNotation);
      this.addIncrementToColor(srcColor);
      this.globalVariablesService.boardHelper.colorTurn =
        this.globalVariablesService.boardHelper.colorTurn === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
      if (!isMatch) {
        this.applyDrawRules(hasLegalMoves, isCheck);
      }
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

  getStatusTitle(): string {
    const boardHelper = this.globalVariablesService.boardHelper;
    if (!boardHelper) {
      return '';
    }
    if (!boardHelper.gameOver) {
      return `${boardHelper.colorTurn} to move`;
    }
    if (boardHelper.checkmateColor !== null) {
      return `Checkmate - ${boardHelper.checkmateColor === ChessColorsEnum.White ? 'Black' : 'White'} wins`;
    }
    return boardHelper.debugText || 'Draw';
  }

  getAmbientThemeClass(): string {
    if (this.pendingDrawOfferBy !== null) {
      return 'ambient-math--draw-pending';
    }
    return this.globalVariablesService.boardHelper.colorTurn === ChessColorsEnum.White
      ? 'ambient-math--white-turn'
      : 'ambient-math--black-turn';
  }

  translateFieldNames(idxX: number, idxY: number): string {
    // A = 0 - H = 7
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + idxY);
    // Flip table count bottom-up
    const numberChar = (8 - idxX);
    return `${letterChar}${numberChar}`;
  }

  promotePiece(toPiece: ChessPiecesEnum): void {
    if (this.globalVariablesService.boardHelper.canPromote !== null) {
      const targetCol = Number(this.globalVariablesService.boardHelper.canPromote);
      const whitePromotionSquare = this.globalVariablesService.field[0][targetCol];
      const blackPromotionSquare = this.globalVariablesService.field[7][targetCol];
      let targetSquare = null;
      if (whitePromotionSquare && whitePromotionSquare[0] && whitePromotionSquare[0].piece === ChessPiecesEnum.Pawn) {
        targetSquare = whitePromotionSquare;
      } else if (blackPromotionSquare && blackPromotionSquare[0] && blackPromotionSquare[0].piece === ChessPiecesEnum.Pawn) {
        targetSquare = blackPromotionSquare;
      }
      if (targetSquare && targetSquare[0]) {
        targetSquare[0].piece = toPiece;
        const historyEntries = this.globalVariablesService.boardHelper.history;
        const historyLength = Object.keys(historyEntries).length;
        if (historyLength > 0 && historyEntries[`${historyLength}`]) {
          historyEntries[`${historyLength}`] =
            historyEntries[`${historyLength}`] + '=' + GlobalVariablesService.translatePieceNotation(toPiece);
        }
        this.globalVariablesService.boardHelper.canPromote = null;
      }
    }
  }

  showPossibleMoves(ofColor: ChessColorsEnum): void {
    // Clear
    this.globalVariablesService.boardHelper.possibles = {};
    this.globalVariablesService.boardHelper.hits = {};
    this.globalVariablesService.boardHelper.checks = {};
    this.globalVariablesService.boardHelper.arrows = {};
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowIdx) => {
        row.forEach((cell, cellIdx) => {
          // All pieces of the color
          if (cell && cell[0] && cell[0].color === ofColor) {
            for (let targetRow = 0; targetRow <= 7; targetRow++) {
              for (let targetCol = 0; targetCol <= 7; targetCol++) {
                const data = this.globalVariablesService.field[targetRow][targetCol];
                ChessRulesService.canStepThere(targetRow, targetCol, data, rowIdx, cellIdx);
              }
            }
          }
        });
      });
    }
  }

  offerDraw(): void {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return;
    }
    if (this.globalVariablesService.boardHelper.gameOver) {
      return;
    }
    if (!this.canOfferDraw()) {
      return;
    }
    this.pendingDrawOfferBy = this.getOpponentColor(this.globalVariablesService.boardHelper.colorTurn);
    this.randomizeAmbientStyle();
  }

  canOfferDraw(): boolean {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return false;
    }
    return !this.globalVariablesService.boardHelper.gameOver && this.pendingDrawOfferBy === null;
  }

  canRespondToDrawOffer(): boolean {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return false;
    }
    if (this.globalVariablesService.boardHelper.gameOver || this.pendingDrawOfferBy === null) {
      return false;
    }
    return this.pendingDrawOfferBy !== this.globalVariablesService.boardHelper.colorTurn;
  }

  acceptDrawOffer(): void {
    if (!this.canRespondToDrawOffer()) {
      return;
    }
    this.setDrawState('Draw by agreement.', 'Draw agreed');
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
    if (this.globalVariablesService.boardHelper.gameOver) {
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
    return this.clockRunning ? 'Pause Clock' : 'Start Clock';
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
    if (!this.clockRunning || !this.clockStarted || this.globalVariablesService.boardHelper.gameOver) {
      return false;
    }
    return this.globalVariablesService.boardHelper.colorTurn === color;
  }

  isClockLow(color: ChessColorsEnum): boolean {
    const remainingTime = color === ChessColorsEnum.White ? this.whiteClockMs : this.blackClockMs;
    return remainingTime <= 10000;
  }

  canClaimDraw(): boolean {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return false;
    }
    if (this.globalVariablesService.boardHelper.gameOver) {
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
      this.setDrawState('Draw by threefold repetition (claimed).', 'Draw by threefold repetition');
      return;
    }
    if (this.isFiftyMoveRule()) {
      this.setDrawState('Draw by fifty-move rule (claimed).', 'Draw by fifty-move rule');
    }
  }

  canResign(color: ChessColorsEnum): boolean {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper) {
      return false;
    }
    if (this.globalVariablesService.boardHelper.gameOver) {
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
    const history = this.globalVariablesService.history || [];
    if (this.mockHistoryCursor === null) {
      return history;
    }
    if (history.length < 1) {
      return [];
    }
    const maxIndex = history.length - 1;
    const clampedIndex = Math.max(0, Math.min(this.mockHistoryCursor, maxIndex));
    return history.slice(0, clampedIndex + 1);
  }

  canUndoMoveMock(): boolean {
    return this.getCurrentVisibleMoveIndex() > 0;
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
    if (currentIndex <= 0) {
      return;
    }
    this.mockHistoryCursor = currentIndex - 1;
  }

  redoMoveMock(): void {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0 || this.mockHistoryCursor === null) {
      return;
    }
    if (this.mockHistoryCursor >= maxIndex) {
      this.mockHistoryCursor = null;
      return;
    }
    this.mockHistoryCursor += 1;
    if (this.mockHistoryCursor >= maxIndex) {
      this.mockHistoryCursor = null;
    }
  }

  getMockEvaluationForMove(halfMoveIndex: number): string {
    if (halfMoveIndex < 0) {
      return '+0.0';
    }
    return this.mockEvalCycle[halfMoveIndex % this.mockEvalCycle.length];
  }

  toggleBoardFlip(): void {
    this.isBoardFlipped = !this.isBoardFlipped;
  }

  getMockOpeningRecognition(): string {
    const moveCount = this.getVisibleHistory().length;
    if (moveCount < 2) {
      return 'Waiting for opening line...';
    }
    const cycleIndex = Math.floor(moveCount / 2) % this.mockOpeningCycle.length;
    return this.mockOpeningCycle[cycleIndex];
  }

  getMockEndgameRecognition(): string {
    const totalPieces = this.getCurrentPieceCount();
    if (totalPieces <= 12) {
      return 'Likely endgame (mock)';
    }
    if (totalPieces <= 20) {
      return 'Transition phase (mock)';
    }
    return 'Not endgame yet (mock)';
  }

  exportPgnMock(): void {
    this.mockExportMessage = `Mock export: PGN ready (${new Date().toLocaleTimeString()})`;
  }

  exportBoardImageMock(): void {
    this.mockExportMessage = `Mock export: Board image ready (${new Date().toLocaleTimeString()})`;
  }

  resign(color: ChessColorsEnum): void {
    if (!this.canResign(color)) {
      return;
    }

    this.resignConfirmColor = null;
    this.stopClock();
    this.pendingDrawOfferBy = null;
    this.globalVariablesService.boardHelper.gameOver = true;
    this.globalVariablesService.boardHelper.checkmateColor = null;

    const loserName = color === ChessColorsEnum.White ? 'White' : 'Black';
    const winnerResult = color === ChessColorsEnum.White ? '0-1' : '1-0';
    this.globalVariablesService.boardHelper.debugText = `${loserName} resigns.`;
    this.appendGameResultToLastMove(winnerResult, `${loserName} resigns`);
  }

  private collectMateInOneTargets(
    board: ChessPieceDto[][][],
    attackerColor: ChessColorsEnum,
    defenderColor: ChessColorsEnum
  ): {[key: string]: boolean} {
    const targets: {[key: string]: boolean} = {};
    for (let srcRow = 0; srcRow <= 7; srcRow++) {
      for (let srcCol = 0; srcCol <= 7; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === attackerColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = 0; targetRow <= 7; targetRow++) {
          for (let targetCol = 0; targetCol <= 7; targetCol++) {
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

    const historyLength = this.globalVariablesService.history.length;
    const previewKey = `${srcRow}${srcCol}-${targetRow}${targetCol}-${historyLength}`;
    if (this.lastMatePreviewKey === previewKey) {
      return;
    }
    this.lastMatePreviewKey = previewKey;
    this.mateInOneTargets = {};
    this.mateInOneBlunderTargets = {};

    const board = this.cloneBoard(this.globalVariablesService.field);
    const sourceCell = board[srcRow][srcCol];
    const forColor = sourceCell && sourceCell[0]
      ? sourceCell[0].color
      : this.globalVariablesService.boardHelper.colorTurn as ChessColorsEnum;
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

  showThreats(ofEnemy = false): void {
    this.globalVariablesService.boardHelper.arrows = {};
    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowIdx) => {
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
              const threatenedCell = this.globalVariablesService.field[threat.pos.row][threat.pos.col];
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
                GlobalVariablesService.createArrowFromVisualization(
                  this.createVisualizationArrow(posFrom, posTo, threatColor, scaryThreat)
                );
                protectors.forEach(protector => {
                  const protectionFrom = new ChessPositionDto(8 - protector.row, protector.col + 1);
                  const protectionTo = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
                  GlobalVariablesService.createArrowFromVisualization(
                    this.createVisualizationArrow(protectionFrom, protectionTo, 'gold', 0.25)
                  );
                });
              } else {
                GlobalVariablesService.createArrowFromVisualization(
                  this.createVisualizationArrow(posFrom, posTo, 'cyan', scaryThreat)
                );
              }
            });
          }
        });
      });
    }
  }

  getThreatsBy(
    cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    for (let targetRow = 0; targetRow <= 7; targetRow++) {
      for (let targetCol = 0; targetCol <= 7; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const targetCell = this.globalVariablesService.field[targetRow][targetCol];
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
    enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    for (let targetRow = 0; targetRow <= 7; targetRow++) {
      for (let targetCol = 0; targetCol <= 7; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const targetCell = this.globalVariablesService.field[targetRow][targetCol];
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
    this.globalVariablesService.boardHelper.arrows = {};
    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowAIdx) => {
        row.forEach((cellA, cellAIdx) => {
          // All pieces of the color
          if (cellA && cellA[0] && cellA[0].color === ofColor) {
            const protectors = this.getProtectors(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
            protectors.forEach(cellB => {
              const posFrom = new ChessPositionDto(8 - cellB.row, cellB.col + 1);
              const posTo = new ChessPositionDto(8 - rowAIdx, cellAIdx + 1);
              GlobalVariablesService.createArrowFromVisualization(
                this.createVisualizationArrow(posFrom, posTo, 'gold', 0.25)
              );
            });
          }
        });
      });
    }
  }

  getProtectors(
    cellA: ChessPieceDto[],
    rowAIdx: number,
    cellAIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): ChessPositionDto[] {
    const protectors = [] as ChessPositionDto[];
    const currentPiece = { color: ofColor, piece: cellA[0].piece } as ChessPieceDto;
    this.globalVariablesService.field.forEach((rowB, rowBIdx) => {
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
    const { ofColor, enemyColor } = this.initColors(ofEnemy);
    this.globalVariablesService.boardHelper.arrows = {};
    if (ofColor) {
      this.globalVariablesService.field.forEach((row, rowAIdx) => {
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
                GlobalVariablesService.createArrowFromVisualization(
                  this.createVisualizationArrow(posFrom, posTo, 'blue', scaryThreat)
                );
              });
            }
          }
        });
      });
    }
  }

  private initColors(ofEnemy: boolean): { ofColor: ChessColorsEnum, enemyColor: ChessColorsEnum} {
    let ofColor: ChessColorsEnum;
    let enemyColor: ChessColorsEnum;
    if (!ofEnemy) {
      ofColor = this.globalVariablesService.boardHelper.colorTurn as ChessColorsEnum;
      enemyColor = ofColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    } else {
      enemyColor = this.globalVariablesService.boardHelper.colorTurn as ChessColorsEnum;
      ofColor = enemyColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    }
    return {ofColor, enemyColor};
  }

  private hasBoardHighlight(targetRow: number, targetCol: number, type: IBoardHighlight['type']): boolean {
    return this.globalVariablesService.boardHighlights
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
    const previousField = GlobalVariablesService.CHESS_FIELD;
    const previousTurn = this.globalVariablesService.boardHelper.colorTurn;
    const previousCastle = this.globalVariablesService.boardHelper.justDidCastle;
    try {
      GlobalVariablesService.CHESS_FIELD = board;
      this.globalVariablesService.boardHelper.colorTurn = turn;
      this.globalVariablesService.boardHelper.justDidCastle = null;
      return callback();
    } finally {
      GlobalVariablesService.CHESS_FIELD = previousField;
      this.globalVariablesService.boardHelper.colorTurn = previousTurn;
      this.globalVariablesService.boardHelper.justDidCastle = previousCastle;
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
    nextBoard[targetRow][targetCol] = movingPiece ? [movingPiece] : [];

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

    const promotionRow = movingPiece.color === ChessColorsEnum.White ? 0 : 7;
    if (movingPiece.piece === ChessPiecesEnum.Pawn && targetRow === promotionRow) {
      nextBoard[targetRow][targetCol][0].piece = ChessPiecesEnum.Queen;
    }

    return nextBoard;
  }

  private findKing(board: ChessPieceDto[][][], color: ChessColorsEnum): ChessPositionDto | null {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
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
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
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
    for (let srcRow = 0; srcRow <= 7; srcRow++) {
      for (let srcCol = 0; srcCol <= 7; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === forColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = 0; targetRow <= 7; targetRow++) {
          for (let targetCol = 0; targetCol <= 7; targetCol++) {
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
    if (this.globalVariablesService.boardHelper.gameOver) {
      return;
    }

    const isStalemate = !isCurrentTurnInCheck && !hasLegalMovesForCurrentTurn;
    if (isStalemate) {
      this.setDrawState('Draw by stalemate.', 'Draw by stalemate');
      return;
    }

    if (this.isInsufficientMaterial(this.globalVariablesService.field)) {
      this.setDrawState('Draw by insufficient material.', 'Draw by insufficient material');
      return;
    }

    this.recordCurrentPosition();
    if (this.isFivefoldRepetition()) {
      this.setDrawState('Draw by fivefold repetition.', 'Draw by fivefold repetition');
      return;
    }

    if (this.isSeventyFiveMoveRule()) {
      this.setDrawState('Draw by seventy-five-move rule.', 'Draw by seventy-five-move rule');
      return;
    }
  }

  private setDrawState(message: string, historyReason: string): void {
    this.globalVariablesService.boardHelper.gameOver = true;
    this.globalVariablesService.boardHelper.checkmateColor = null;
    this.globalVariablesService.boardHelper.debugText = message;
    this.pendingDrawOfferBy = null;
    this.appendGameResultToLastMove('1/2-1/2', historyReason);
  }

  private getOpponentColor(color: ChessColorsEnum): ChessColorsEnum {
    return color === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
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
    const historyEntries = this.globalVariablesService.boardHelper.history;
    const historyLength = Object.keys(historyEntries).length;
    const resultSuffix = `${result} {${reason}}`;

    if (historyLength < 1) {
      GlobalVariablesService.addHistory(resultSuffix);
      return;
    }

    const lastMove = historyEntries[`${historyLength}`];
    if (!lastMove) {
      historyEntries[`${historyLength}`] = resultSuffix;
      return;
    }

    if (/(?:1-0|0-1|1\/2-1\/2)\s*\{/.test(lastMove)) {
      return;
    }

    historyEntries[`${historyLength}`] = `${lastMove} ${resultSuffix}`;
  }

  private startClock(): void {
    if (this.clockIntervalId !== null) {
      return;
    }
    this.lastClockTickAt = Date.now();
    this.clockRunning = true;
    this.clockIntervalId = window.setInterval(() => this.tickClock(), this.clockTickIntervalMs);
  }

  private stopClock(): void {
    if (this.clockIntervalId !== null) {
      window.clearInterval(this.clockIntervalId);
      this.clockIntervalId = null;
    }
    this.clockRunning = false;
  }

  private tickClock(): void {
    if (!this.clockRunning || !this.clockStarted || this.globalVariablesService.boardHelper.gameOver) {
      this.stopClock();
      return;
    }

    const now = Date.now();
    const elapsedMs = now - this.lastClockTickAt;
    this.lastClockTickAt = now;
    if (elapsedMs <= 0) {
      return;
    }

    const activeColor = this.globalVariablesService.boardHelper.colorTurn;
    if (activeColor === ChessColorsEnum.White) {
      this.whiteClockMs = Math.max(0, this.whiteClockMs - elapsedMs);
      if (this.whiteClockMs === 0) {
        this.handleTimeForfeit(ChessColorsEnum.White);
      }
      return;
    }

    this.blackClockMs = Math.max(0, this.blackClockMs - elapsedMs);
    if (this.blackClockMs === 0) {
      this.handleTimeForfeit(ChessColorsEnum.Black);
    }
  }

  private addIncrementToColor(color: ChessColorsEnum): void {
    if (!this.clockStarted || this.incrementMs <= 0 || this.globalVariablesService.boardHelper.gameOver) {
      return;
    }
    if (color === ChessColorsEnum.White) {
      this.whiteClockMs += this.incrementMs;
      return;
    }
    this.blackClockMs += this.incrementMs;
  }

  private handleTimeForfeit(loserColor: ChessColorsEnum): void {
    if (this.globalVariablesService.boardHelper.gameOver) {
      return;
    }

    this.stopClock();
    this.pendingDrawOfferBy = null;
    this.globalVariablesService.boardHelper.gameOver = true;
    this.globalVariablesService.boardHelper.checkmateColor = null;

    const winnerColor = loserColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const winnerResult = winnerColor === ChessColorsEnum.White ? '1-0' : '0-1';
    const loserName = loserColor === ChessColorsEnum.White ? 'White' : 'Black';
    this.globalVariablesService.boardHelper.debugText = `${loserName} forfeits on time.`;
    this.appendGameResultToLastMove(winnerResult, `${loserName} forfeits on time`);
  }

  private padToTwo(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private getMaxMoveIndex(): number {
    return (this.globalVariablesService.history || []).length - 1;
  }

  private getCurrentVisibleMoveIndex(): number {
    const maxIndex = this.getMaxMoveIndex();
    if (maxIndex < 0) {
      return -1;
    }
    if (this.mockHistoryCursor === null) {
      return maxIndex;
    }
    return Math.max(0, Math.min(this.mockHistoryCursor, maxIndex));
  }

  private getCurrentPieceCount(): number {
    let totalPieces = 0;
    this.globalVariablesService.field.forEach(row => {
      row.forEach(cell => {
        if (cell && cell[0]) {
          totalPieces += 1;
        }
      });
    });
    return totalPieces;
  }

  private ensureRepetitionTrackingState(): void {
    const historyLength = this.globalVariablesService.history.length;
    if (this.trackedHistoryLength === historyLength && Object.keys(this.repetitionCounts).length > 0) {
      return;
    }

    this.repetitionCounts = {};
    this.recordPositionKey(this.getPositionKey(this.globalVariablesService.field, this.globalVariablesService.boardHelper.colorTurn));
    this.trackedHistoryLength = historyLength;
  }

  private recordCurrentPosition(): void {
    const positionKey = this.getPositionKey(
      this.globalVariablesService.field,
      this.globalVariablesService.boardHelper.colorTurn
    );
    this.recordPositionKey(positionKey);
    this.trackedHistoryLength = this.globalVariablesService.history.length;
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
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper || !this.globalVariablesService.field) {
      return '';
    }
    return this.getPositionKey(
      this.globalVariablesService.field,
      this.globalVariablesService.boardHelper.colorTurn
    );
  }

  getDebugCastlingRights(): string {
    if (!this.globalVariablesService || !this.globalVariablesService.boardHelper || !this.globalVariablesService.field) {
      return '-';
    }
    return ChessRulesService.getCastlingRightsNotation(
      this.globalVariablesService.field,
      this.globalVariablesService.boardHelper.history
    );
  }

  private getPositionKey(board: ChessPieceDto[][][], turn: ChessColorsEnum): string {
    const squares: string[] = [];
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
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
      this.globalVariablesService.boardHelper ? this.globalVariablesService.boardHelper.history : {}
    );
    const enPassantRights = ChessRulesService.getEnPassantRightsNotation(
      board,
      this.globalVariablesService.boardHelper ? this.globalVariablesService.boardHelper.history : {},
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
    const history = this.globalVariablesService.history;
    if (history.length < halfMoveCount) {
      return false;
    }

    const recentHalfMoves = history.slice(-halfMoveCount);
    return recentHalfMoves.every(move => this.isNonPawnNonCaptureMove(move));
  }

  private isNonPawnNonCaptureMove(notation: string): boolean {
    if (!notation || notation.includes('x')) {
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

    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
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
