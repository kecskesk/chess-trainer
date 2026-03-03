import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessBoardComponentUtils } from './chess-board-component.utils';
import { ChessBoardMessageConstants } from '../constants/chess.constants';
import { ChessRulesService } from '../services/chess-rules.service';
import { ChessBoardStateService } from '../services/chess-board-state.service';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';

export interface IDropMoveContext {
  targetRow: number;
  targetCell: number;
  srcRow: number;
  srcCell: number;
  srcPiece: ChessPiecesEnum;
  srcColor: ChessColorsEnum;
}

export interface ICanProcessDropEventParams {
  event: CdkDragDrop<ChessPieceDto[]>;
  hasBoardState: boolean;
  gameOver: boolean;
  onGameOver: () => void;
}

export interface IValidateDropMoveParams {
  moveContext: IDropMoveContext;
  event: CdkDragDrop<ChessPieceDto[]>;
  board: ChessPieceDto[][][];
  getDragFailureReason: (srcRow: number, srcCell: number, sourcePiece: ChessPieceDto) => string | null;
  setSubtleDebugReason: (reason: string) => void;
}

export interface IPrepareUiForDropParams {
  clockStarted: boolean;
  pendingDrawOfferBy: ChessColorsEnum | null;
  srcColor: ChessColorsEnum;
  startClock: () => void;
  randomizeAmbientStyle: () => void;
  boardHelper: {
    debugText: string;
    possibles: Record<string, unknown>;
    hits: Record<string, unknown>;
    checks: Record<string, unknown>;
    arrows: Record<string, unknown>;
  };
}

export interface IApplyPreTransferBoardStateParams {
  event: CdkDragDrop<ChessPieceDto[]>;
  moveContext: IDropMoveContext;
  field: ChessPieceDto[][][];
  history: string[];
  boardHelper: {
    justDidEnPassant: unknown;
    justDidCastle: { row: number; col: number } | null;
  };
}

export interface IApplyDrawRulesParams {
  gameOver: boolean;
  hasLegalMovesForCurrentTurn: boolean;
  isCurrentTurnInCheck: boolean;
  field: ChessPieceDto[][][];
  recordCurrentPosition: () => void;
  isFivefoldRepetition: () => boolean;
  isSeventyFiveMoveRule: () => boolean;
  setDrawState: (message: string, historyReason: string) => void;
}

export interface IFinalizeDropStateParams {
  moveContext: IDropMoveContext;
  moveFlags: { isHit: boolean; isEP: boolean; castleData: string | null };
  field: ChessPieceDto[][][];
  boardHelper: {
    gameOver: boolean;
    checkmateColor: ChessColorsEnum | null;
    debugText: string;
    colorTurn: ChessColorsEnum;
  };
  isKingInCheck: (board: ChessPieceDto[][][], color: ChessColorsEnum) => boolean;
  hasAnyLegalMove: (board: ChessPieceDto[][][], color: ChessColorsEnum) => boolean;
  checkmateDebugText: string;
  addIncrementToColor: (color: ChessColorsEnum) => void;
  applyDrawRules: (hasLegalMovesForCurrentTurn: boolean, isCurrentTurnInCheck: boolean) => void;
}

export class ChessBoardMoveFacade {
  static canProcessDropEvent(params: ICanProcessDropEventParams): boolean {
    const { event, hasBoardState, gameOver, onGameOver } = params;
    if (!hasBoardState) {
      return false;
    }
    if (gameOver) {
      onGameOver();
      return false;
    }
    if (!event || !event.previousContainer || !event.container || !event.previousContainer.data || !event.container.data) {
      return false;
    }
    return !!event.previousContainer.data[0];
  }

  static buildDropMoveContext(event: CdkDragDrop<ChessPieceDto[]>): IDropMoveContext | null {
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

  static validateDropMove(params: IValidateDropMoveParams): boolean {
    const { moveContext, event, board, getDragFailureReason, setSubtleDebugReason } = params;
    const isValidMove = ChessRulesService.validateMove(
      moveContext.targetRow,
      moveContext.targetCell,
      board[moveContext.targetRow][moveContext.targetCell],
      moveContext.srcRow,
      moveContext.srcCell
    ).isValid;
    if (isValidMove) {
      return true;
    }
    const sourcePiece = event.previousContainer.data[0];
    const dragFailureReason = getDragFailureReason(moveContext.srcRow, moveContext.srcCell, sourcePiece);
    if (dragFailureReason) {
      setSubtleDebugReason(dragFailureReason);
    }
    return false;
  }

  static prepareUiForDrop(params: IPrepareUiForDropParams): ChessColorsEnum | null {
    const { clockStarted, pendingDrawOfferBy, srcColor, startClock, randomizeAmbientStyle, boardHelper } = params;
    if (!clockStarted) {
      startClock();
    }
    randomizeAmbientStyle();
    boardHelper.debugText = '';
    boardHelper.possibles = {};
    boardHelper.hits = {};
    boardHelper.checks = {};
    boardHelper.arrows = {};
    if (pendingDrawOfferBy !== null && pendingDrawOfferBy !== srcColor) {
      return null;
    }
    return pendingDrawOfferBy;
  }

  static applyPromotionAvailability(moveContext: IDropMoveContext, canPromoteRef: { canPromote: number | null }): void {
    const promotionTargetRow = moveContext.srcColor === ChessColorsEnum.White ? 0 : 7;
    if (moveContext.srcPiece === ChessPiecesEnum.Pawn && moveContext.targetRow === promotionTargetRow) {
      canPromoteRef.canPromote = moveContext.targetCell;
    }
  }

  static applyPreTransferBoardState(params: IApplyPreTransferBoardStateParams): { isHit: boolean; isEP: boolean; castleData: string | null } {
    const { event, moveContext, field, history, boardHelper } = params;
    let isHit = false;
    let isEP = false;
    let castleData: string | null = null;

    if (event.container && event.container.data && event.container.data[0]) {
      field[moveContext.targetRow][moveContext.targetCell].splice(0, 1);
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
      const lastHistory = history[history.length - 1];
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
      if (lastHistory === possibleEP && field[epTargetRow][moveContext.targetCell].length > 0) {
        field[epTargetRow][moveContext.targetCell].splice(0, 1);
        isHit = true;
        isEP = true;
      }
    }

    boardHelper.justDidEnPassant = null;
    const justDidCastle = boardHelper.justDidCastle;
    if (justDidCastle) {
      const rookCol = justDidCastle.col === 2 ? 0 : 7;
      const rookDestCol = justDidCastle.col === 2 ? 3 : 5;
      const castleRook = field[justDidCastle.row][rookCol];
      if (castleRook && castleRook[0]) {
        const sourceColor = castleRook[0].color as ChessColorsEnum;
        field[justDidCastle.row][rookCol].splice(0, 1);
        const newCastleRook = new ChessPieceDto(sourceColor, ChessPiecesEnum.Rook);
        field[justDidCastle.row][rookDestCol].push(newCastleRook);
        boardHelper.justDidCastle = null;
        castleData = justDidCastle.col === 2 ? 'O-O-O' : 'O-O';
      }
    }

    return { isHit, isEP, castleData };
  }

  static applyDrawRules(params: IApplyDrawRulesParams): void {
    const {
      gameOver,
      hasLegalMovesForCurrentTurn,
      isCurrentTurnInCheck,
      field,
      recordCurrentPosition,
      isFivefoldRepetition,
      isSeventyFiveMoveRule,
      setDrawState
    } = params;
    if (gameOver) {
      return;
    }

    const isStalemate = !isCurrentTurnInCheck && !hasLegalMovesForCurrentTurn;
    if (isStalemate) {
      setDrawState(ChessBoardMessageConstants.DRAW_BY_STALEMATE_TEXT, ChessBoardMessageConstants.DRAW_BY_STALEMATE_TITLE);
      return;
    }

    if (ChessBoardLogicUtils.isInsufficientMaterial(field)) {
      setDrawState(ChessBoardMessageConstants.DRAW_BY_INSUFFICIENT_TEXT, ChessBoardMessageConstants.DRAW_BY_INSUFFICIENT_TITLE);
      return;
    }

    recordCurrentPosition();
    if (isFivefoldRepetition()) {
      setDrawState(ChessBoardMessageConstants.DRAW_BY_FIVEFOLD_TEXT, ChessBoardMessageConstants.DRAW_BY_FIVEFOLD_TITLE);
      return;
    }

    if (isSeventyFiveMoveRule()) {
      setDrawState(ChessBoardMessageConstants.DRAW_BY_SEVENTYFIVE_TEXT, ChessBoardMessageConstants.DRAW_BY_SEVENTYFIVE_TITLE);
    }
  }

  static finalizeDropState(params: IFinalizeDropStateParams): void {
    const {
      moveContext,
      moveFlags,
      field,
      boardHelper,
      isKingInCheck,
      hasAnyLegalMove,
      checkmateDebugText,
      addIncrementToColor,
      applyDrawRules
    } = params;
    const enemyColor = moveContext.srcColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const isCheck = isKingInCheck(field, enemyColor);
    const hasLegalMoves = hasAnyLegalMove(field, enemyColor);
    const isMatch = isCheck && !hasLegalMoves;
    if (isMatch) {
      boardHelper.gameOver = true;
      boardHelper.checkmateColor = enemyColor;
      boardHelper.debugText = checkmateDebugText;
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
    addIncrementToColor(moveContext.srcColor);
    boardHelper.colorTurn = boardHelper.colorTurn === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    if (!isMatch) {
      applyDrawRules(hasLegalMoves, isCheck);
    }
  }

  static gameOverNoMovesMessage(): string {
    return ChessBoardMessageConstants.GAME_OVER_NO_MOVES;
  }
}
