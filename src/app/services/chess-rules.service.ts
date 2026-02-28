import { Injectable } from '@angular/core';
import { ChessBoardStateService } from './chess-board-state.service';
import { ChessMoveResultDto } from '../model/chess-move-result.dto';
import { ChessMoveParamsDto } from '../model/chess-move-params.dto';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { IMoveValidationResult } from '../model/interfaces/move-validation-result.interface';
import { IBoardHighlight } from '../model/interfaces/board-highlight.interface';
import { IVisualizationArrow } from '../model/interfaces/visualization-arrow.interface';
import { ChessMoveNotation } from '../utils/chess-utils';
import { ChessConstants } from '../constants/chess.constants';

@Injectable()
export class ChessRulesService {

  constructor() {}

  public static canStepThere(
    targetRow: number,
    targetCol: number,
    targetCell: ChessPieceDto[],
    srcRow: number,
    srcCol: number,
    virtualSourcePiece: ChessPieceDto = null
  ): boolean {
      let sourceCell = null;
      if (!ChessBoardStateService.CHESS_FIELD || !ChessBoardStateService.BOARD_HELPER) {
        return false;
      }
      const moveHistory = ChessBoardStateService.BOARD_HELPER.history;
      sourceCell = ChessBoardStateService.CHESS_FIELD[srcRow][srcCol];
      if (virtualSourcePiece) {
        sourceCell = [virtualSourcePiece];
      }
      if (!(sourceCell && sourceCell[0])) {
        return false;
      }
      const sourcePiece = sourceCell[0];
      const sourceColor = sourcePiece.color;
      const sourcePieceType = sourcePiece.piece;
      const enemyColor = ChessRulesService.getEnemyColor(sourceColor);
      const moveValidationResult: IMoveValidationResult = {
        isValid: targetCell.length < 1,
        isEmptyTarget: targetCell.length < 1,
        isEnemyPiece: false
      };
      if (targetCell.length === 1 && targetCell[0].color !== sourceColor) {
        moveValidationResult.isValid = true;
        moveValidationResult.isEnemyPiece = true;
      }
      if (sourceColor !== ChessBoardStateService.BOARD_HELPER.colorTurn && !virtualSourcePiece) {
        moveValidationResult.isValid = false;
        moveValidationResult.errorMessage = 'Not this color\'s turn';
        return false;
      }
      const cmResult = new ChessMoveResultDto(
        moveValidationResult.isValid, moveValidationResult.isEnemyPiece, false, moveValidationResult.isEmptyTarget);
      const cmParams = new ChessMoveParamsDto(
        targetRow, targetCol, srcRow, srcCol, sourceColor, moveHistory, !!virtualSourcePiece);
      ChessRulesService.applyPieceRules(sourcePieceType, cmResult, cmParams);

      if (cmResult.canDrop && !virtualSourcePiece && ChessRulesService.isMoveLeavingOwnKingInCheck(
        srcRow,
        srcCol,
        targetRow,
        targetCol,
        sourceColor
      )) {
        cmResult.canDrop = false;
      }

      const enemyKingPos = ChessRulesService.findKingPosition(ChessBoardStateService.CHESS_FIELD, enemyColor);
      if (!virtualSourcePiece) {
        if (!enemyKingPos) {
          return cmResult.canDrop;
        }
        const isCheck = ChessRulesService.canStepThere(
          enemyKingPos.row, enemyKingPos.col, [new ChessPieceDto(enemyColor, ChessPiecesEnum.King)],
          targetRow, targetCol, { color: sourceColor, piece: sourcePieceType });
        ChessRulesService.addMoveHighlights(srcRow, srcCol, targetRow, targetCol, cmResult.canDrop, cmResult.canHit, isCheck);
      }

      return cmResult.canDrop;
  }

  private static getEnemyColor(sourceColor: ChessColorsEnum): ChessColorsEnum {
    return sourceColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
  }

  private static applyPieceRules(
    sourcePieceType: ChessPiecesEnum,
    cmResult: ChessMoveResultDto,
    cmParams: ChessMoveParamsDto
  ): void {
    switch (sourcePieceType) {
      case ChessPiecesEnum.Pawn:
        ChessRulesService.pawnRules(cmResult, cmParams);
        return;
      case ChessPiecesEnum.Knight:
        ChessRulesService.knightRules(cmResult, cmParams);
        return;
      case ChessPiecesEnum.King:
        ChessRulesService.kingRules(cmResult, cmParams);
        return;
      case ChessPiecesEnum.Queen:
        ChessRulesService.queenRules(cmResult, cmParams);
        return;
      case ChessPiecesEnum.Rook:
        ChessRulesService.rookRules(cmResult, cmParams);
        return;
      case ChessPiecesEnum.Bishop:
        ChessRulesService.bishopRules(cmResult, cmParams);
        return;
      default:
        return;
    }
  }

  private static ensureHighlightCollectionsInitialized(): void {
    if (!ChessBoardStateService.BOARD_HELPER) {
      return;
    }
    if (!ChessBoardStateService.BOARD_HELPER.possibles) {
      ChessBoardStateService.BOARD_HELPER.possibles = {};
    }
    if (!ChessBoardStateService.BOARD_HELPER.hits) {
      ChessBoardStateService.BOARD_HELPER.hits = {};
    }
    if (!ChessBoardStateService.BOARD_HELPER.checks) {
      ChessBoardStateService.BOARD_HELPER.checks = {};
    }
  }

  private static addMoveHighlights(
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number,
    canDrop: boolean,
    canHit: boolean,
    isCheck: boolean
  ): void {
    if (!ChessBoardStateService.BOARD_HELPER || !canDrop) {
      return;
    }

    ChessRulesService.ensureHighlightCollectionsInitialized();
    ChessBoardStateService.addHighlight({ row: targetRow, col: targetCol, type: 'possible' });

    if (canHit) {
      ChessBoardStateService.addHighlight({ row: targetRow, col: targetCol, type: 'capture' });
    }

    if (!isCheck) {
      return;
    }

    const checkHighlight: IBoardHighlight = { row: targetRow, col: targetCol, type: 'check' };
    ChessBoardStateService.addHighlight(checkHighlight);

    const checkArrow: IVisualizationArrow = {
      fromRow: 8 - srcRow,
      fromCol: srcCol + 1,
      toRow: 8 - targetRow,
      toCol: targetCol + 1,
      color: 'red',
      intensity: 0.25
    };
    ChessBoardStateService.createArrowFromVisualization(checkArrow);
  }

  public static validateMove(
    targetRow: number,
    targetCol: number,
    targetData: ChessPieceDto[],
    srcRow: number,
    srcCol: number,
    justLookingWithPiece: ChessPieceDto = null
  ): IMoveValidationResult {
    const sourceData = justLookingWithPiece ||
      (ChessBoardStateService.CHESS_FIELD && ChessBoardStateService.CHESS_FIELD[srcRow] && ChessBoardStateService.CHESS_FIELD[srcRow][srcCol]
        ? ChessBoardStateService.CHESS_FIELD[srcRow][srcCol][0]
        : null);
    const isEmptyTarget = !targetData || targetData.length < 1;
    const isEnemyPiece = !!(sourceData && targetData && targetData[0] && targetData[0].color !== sourceData.color);
    const isValid = ChessRulesService.canStepThere(targetRow, targetCol, targetData, srcRow, srcCol, justLookingWithPiece);
    return {
      isValid,
      isEmptyTarget,
      isEnemyPiece,
      errorMessage: isValid ? null : 'Move is not allowed'
    };
  }

  static knightRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    const stepX = Math.abs(cmParams.targetCol - cmParams.srcCol);
    const stepY = Math.abs(cmParams.targetRow - cmParams.srcRow);
    // Side 1 and up-down 2 or side 2 and up-down 1
    if (!(stepX === 2 && stepY === 1) && !(stepX === 1 && stepY === 2)) {
      cmResult.canDrop = false;
    }
  }

  static pawnRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    const rowDelta = cmParams.targetRow - cmParams.srcRow;
    const colDelta = Math.abs(cmParams.targetCol - cmParams.srcCol);
    // Can step 1 in direction
    const targetDirectionStep = cmParams.sourceColor === ChessColorsEnum.White ? -1 : 1;
    // Pawn on home row
    const homeRow = cmParams.sourceColor === ChessColorsEnum.White ? 6 : 1;
    const enemyFirstStep = cmParams.sourceColor === ChessColorsEnum.Black ? 5 : 2;
    // Can step 2 from home row
    const homeRowStep = cmParams.sourceColor === ChessColorsEnum.White ? -2 : 2;
    // Cannot step left/right
    const isForwardAdvanceLegal = ((rowDelta === targetDirectionStep) || (cmParams.srcRow === homeRow && rowDelta === homeRowStep)) && colDelta === 0;
    if (!isForwardAdvanceLegal) {
      cmResult.canDrop = false;
    }
    // Pawn magic 1 (cannot hit straight)
    if (isForwardAdvanceLegal && cmResult.canHit) {
      cmResult.canDrop = false;
      cmResult.canHit = false;
    }
    // Pawn magic 2 (can hit 1 across)
    const piecesInWay = ChessBoardStateService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if (cmResult.canHit && colDelta === 1 && rowDelta === targetDirectionStep && !piecesInWay) {
      cmResult.canDrop = true;
    }
    // Pawn magic 3 (en passant)
    const historyEntryCount = Object.keys(cmParams.moveHistory).length;
    const lastMoveNotation = cmParams.moveHistory[historyEntryCount];
    const epTargetRow = cmParams.sourceColor === ChessColorsEnum.White ? 3 : 4;
    const epSourceRow = cmParams.sourceColor === ChessColorsEnum.White ? 1 : 6;
    const expectedEnPassantTriggerNotation = ChessBoardStateService.translateNotation(
      epTargetRow, cmParams.targetCol, epSourceRow, cmParams.targetCol, ChessPiecesEnum.Pawn, false, false, false, false, null);
    if (colDelta === 1 && rowDelta === targetDirectionStep &&
      cmParams.targetRow === enemyFirstStep && lastMoveNotation === expectedEnPassantTriggerNotation) {
      cmResult.canDrop = true;
      cmResult.canHit = true;
    }
  }

  static kingRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    const colDelta = Math.abs(cmParams.targetCol - cmParams.srcCol);
    const rowDelta = Math.abs(cmParams.targetRow - cmParams.srcRow);
    // Side 1 and up-down 1
    if (colDelta > 1) {
      cmResult.canDrop = false;
    }
    if (rowDelta > 1) {
      cmResult.canDrop = false;
    }
    const isCastleAttempt = rowDelta === 0 && colDelta === 2;
    if (!isCastleAttempt || cmParams.justLooking) {
      return;
    }

    cmResult.canDrop = false;
    const castleSourceRow = cmParams.sourceColor === ChessColorsEnum.White ? 7 : 0;
    const castleSourceCell = 4;
    if (!cmResult.targetEmpty || cmParams.srcRow !== castleSourceRow || cmParams.srcCol !== castleSourceCell ||
      cmParams.targetRow !== castleSourceRow) {
      return;
    }

    const isKingSideCastle = cmParams.targetCol === 6;
    const isQueenSideCastle = cmParams.targetCol === 2;
    if (!isKingSideCastle && !isQueenSideCastle) {
      return;
    }

    const rookSourceCol = isKingSideCastle ? 7 : 0;
    const rookCell = ChessBoardStateService.CHESS_FIELD[castleSourceRow][rookSourceCol];
    const rookInPlace = rookCell.length === 1 &&
      rookCell[0] && rookCell[0].color === cmParams.sourceColor && rookCell[0].piece === ChessPiecesEnum.Rook;
    if (!rookInPlace) {
      return;
    }

    if (ChessRulesService.hasPieceMoved(
      cmParams.sourceColor,
      ChessPiecesEnum.King,
      castleSourceRow,
      castleSourceCell,
      cmParams.moveHistory
    )) {
      return;
    }

    if (ChessRulesService.hasPieceMoved(
      cmParams.sourceColor,
      ChessPiecesEnum.Rook,
      castleSourceRow,
      rookSourceCol,
      cmParams.moveHistory
    )) {
      return;
    }

    const kingPathCols = isKingSideCastle ? [5, 6] : [3, 2];
    const rookPathCols = isKingSideCastle ? [5, 6] : [1, 2, 3];
    const hasPieceInWay = rookPathCols.some(col => ChessBoardStateService.CHESS_FIELD[castleSourceRow][col].length > 0);
    if (hasPieceInWay) {
      return;
    }

    const enemyColor = cmParams.sourceColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const kingSafetyCols = [castleSourceCell, ...kingPathCols];
    const isAnySafetySquareUnderAttack = kingSafetyCols.some(col =>
      ChessRulesService.isSquareUnderAttack(castleSourceRow, col, enemyColor)
    );
    if (isAnySafetySquareUnderAttack) {
      return;
    }

    cmResult.canDrop = true;
    ChessBoardStateService.BOARD_HELPER.justDidCastle = { row: cmParams.targetRow, col: cmParams.targetCol };
  }

  static getCastlingRightsNotation(
    board: ChessPieceDto[][][],
    moveHistory: {[name: string]: string}
  ): string {
    if (!board) {
      return '-';
    }

    const rights: string[] = [];
    if (ChessRulesService.canCastleByState(board, moveHistory, ChessColorsEnum.White, true)) {
      rights.push('K');
    }
    if (ChessRulesService.canCastleByState(board, moveHistory, ChessColorsEnum.White, false)) {
      rights.push('Q');
    }
    if (ChessRulesService.canCastleByState(board, moveHistory, ChessColorsEnum.Black, true)) {
      rights.push('k');
    }
    if (ChessRulesService.canCastleByState(board, moveHistory, ChessColorsEnum.Black, false)) {
      rights.push('q');
    }

    return rights.length > 0 ? rights.join('') : '-';
  }

  static getEnPassantRightsNotation(
    board: ChessPieceDto[][][],
    moveHistory: {[name: string]: string},
    turn: ChessColorsEnum
  ): string {
    if (!board || !moveHistory || !turn) {
      return '-';
    }

    const historyEntries = ChessRulesService.getSortedHistoryEntries(moveHistory);
    if (historyEntries.length < 1) {
      return '-';
    }

    const lastMove = historyEntries[historyEntries.length - 1];
    const parsedMove = ChessRulesService.parseMoveNotation(lastMove.notation);
    if (!parsedMove || parsedMove.piece !== ChessPiecesEnum.Pawn || !parsedMove.targetSquare) {
      return '-';
    }

    const sourcePos = ChessRulesService.fromSquareNotation(parsedMove.sourceSquare);
    const targetPos = ChessRulesService.fromSquareNotation(parsedMove.targetSquare);
    if (!sourcePos || !targetPos) {
      return '-';
    }

    if (sourcePos.col !== targetPos.col || Math.abs(sourcePos.row - targetPos.row) !== 2) {
      return '-';
    }

    const movingColor = lastMove.index % 2 === 1 ? ChessColorsEnum.White : ChessColorsEnum.Black;
    const capturingColor = ChessRulesService.getEnemyColor(movingColor);
    if (turn !== capturingColor) {
      return '-';
    }

    if (!ChessRulesService.hasPieceAtOnBoard(board, targetPos.row, targetPos.col, movingColor, ChessPiecesEnum.Pawn)) {
      return '-';
    }

    const adjacentCols = [targetPos.col - 1, targetPos.col + 1].filter(
      col => col >= ChessConstants.MIN_INDEX && col <= ChessConstants.MAX_INDEX
    );
    const hasCapturingPawn = adjacentCols.some(col =>
      ChessRulesService.hasPieceAtOnBoard(board, targetPos.row, col, capturingColor, ChessPiecesEnum.Pawn)
    );
    if (!hasCapturingPawn) {
      return '-';
    }

    const epRow = (sourcePos.row + targetPos.row) / 2;
    return ChessRulesService.toSquareNotation(epRow, targetPos.col);
  }

  private static canCastleByState(
    board: ChessPieceDto[][][],
    moveHistory: {[name: string]: string},
    color: ChessColorsEnum,
    kingSide: boolean
  ): boolean {
    const sourceRow = color === ChessColorsEnum.White ? 7 : 0;
    const kingSourceCol = 4;
    const rookSourceCol = kingSide ? 7 : 0;

    if (!ChessRulesService.hasPieceAtOnBoard(board, sourceRow, kingSourceCol, color, ChessPiecesEnum.King)) {
      return false;
    }

    if (!ChessRulesService.hasPieceAtOnBoard(board, sourceRow, rookSourceCol, color, ChessPiecesEnum.Rook)) {
      return false;
    }

    if (ChessRulesService.hasPieceMoved(color, ChessPiecesEnum.King, sourceRow, kingSourceCol, moveHistory)) {
      return false;
    }

    if (ChessRulesService.hasPieceMoved(color, ChessPiecesEnum.Rook, sourceRow, rookSourceCol, moveHistory)) {
      return false;
    }

    return true;
  }

  private static hasPieceAtOnBoard(
    board: ChessPieceDto[][][],
    row: number,
    col: number,
    color: ChessColorsEnum,
    pieceType: ChessPiecesEnum
  ): boolean {
    const cell = board[row] && board[row][col];
    return !!(cell && cell[0] && cell[0].color === color && cell[0].piece === pieceType);
  }

  private static hasPieceMoved(
    sourceColor: ChessColorsEnum,
    piece: ChessPiecesEnum,
    sourceRow: number,
    sourceCol: number,
    moveHistory: {[name: string]: string}
  ): boolean {
    if (!moveHistory) {
      return false;
    }
    const sourceSquare = ChessRulesService.toSquareNotation(sourceRow, sourceCol);
    const historyEntries = ChessRulesService.getSortedHistoryEntries(moveHistory);

    for (const entry of historyEntries) {
      if (piece === ChessPiecesEnum.King && (entry.notation === 'O-O' || entry.notation === 'O-O-O')) {
        const moveColor = entry.index % 2 === 1 ? ChessColorsEnum.White : ChessColorsEnum.Black;
        if (moveColor === sourceColor) {
          return true;
        }
      }

      const parsedMove = ChessRulesService.parseMoveNotation(entry.notation);
      if (!parsedMove) {
        continue;
      }
      if (parsedMove.sourceSquare === sourceSquare && parsedMove.piece === piece) {
        return true;
      }
    }
    return false;
  }

  private static parseMoveNotation(
    notation: string
  ): { piece: ChessPiecesEnum, sourceSquare: string, targetSquare: string } | null {
    if (!notation) {
      return null;
    }

    const firstToken = notation.trim().split(/\s+/)[0];
    if (!firstToken || firstToken === 'O-O' || firstToken === 'O-O-O') {
      return null;
    }

    if (!ChessMoveNotation.isValidLongNotation(firstToken)) {
      return null;
    }

    const match = firstToken.match(/^([KQRBN]?)([a-h][1-8])(?:-|x)?([a-h][1-8])/);
    if (!match) {
      return null;
    }
    const pieceChar = match[1];
    let piece = ChessPiecesEnum.Pawn;
    piece = ChessRulesService.fromNotationPiece(pieceChar);
    return {
      piece,
      sourceSquare: match[2],
      targetSquare: match[3]
    };
  }

  private static fromNotationPiece(pieceChar: string): ChessPiecesEnum {
    switch (pieceChar) {
      case 'K':
        return ChessPiecesEnum.King;
      case 'Q':
        return ChessPiecesEnum.Queen;
      case 'R':
        return ChessPiecesEnum.Rook;
      case 'B':
        return ChessPiecesEnum.Bishop;
      case 'N':
        return ChessPiecesEnum.Knight;
      default:
        return ChessPiecesEnum.Pawn;
    }
  }

  private static fromSquareNotation(square: string): { row: number, col: number } | null {
    if (!square || square.length !== 2) {
      return null;
    }

    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = Number(square.charAt(1));
    if (file < ChessConstants.MIN_INDEX ||
      file > ChessConstants.MAX_INDEX || rank < 1 || rank > ChessConstants.BOARD_SIZE) {
      return null;
    }

    return {
      row: 8 - rank,
      col: file
    };
  }

  private static getSortedHistoryEntries(moveHistory: {[name: string]: string}): Array<{ index: number, notation: string }> {
    return Object.keys(moveHistory)
      .map(key => ({ index: Number(key), notation: moveHistory[key] }))
      .filter(entry => !isNaN(entry.index) && !!entry.notation)
      .sort((a, b) => a.index - b.index);
  }

  private static toSquareNotation(row: number, col: number): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + col);
    const rank = `${8 - row}`;
    return `${file}${rank}`;
  }

  private static isSquareUnderAttack(row: number, col: number, attackerColor: ChessColorsEnum): boolean {
    const targetColor = ChessRulesService.getEnemyColor(attackerColor);
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const attackerCell = ChessBoardStateService.CHESS_FIELD[srcRow][srcCol];
        if (!(attackerCell && attackerCell[0] && attackerCell[0].color === attackerColor)) {
          continue;
        }
        const attacker = attackerCell[0];
        const canAttackSquare = ChessRulesService.canStepThere(
          row,
          col,
          [new ChessPieceDto(targetColor, ChessPiecesEnum.King)],
          srcRow,
          srcCol,
          new ChessPieceDto(attacker.color, attacker.piece)
        );
        if (canAttackSquare) {
          return true;
        }
      }
    }
    return false;
  }

  private static isMoveLeavingOwnKingInCheck(
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number,
    sourceColor: ChessColorsEnum
  ): boolean {
    const simulatedBoard = ChessRulesService.simulateMoveOnBoard(
      ChessBoardStateService.CHESS_FIELD,
      srcRow,
      srcCol,
      targetRow,
      targetCol
    );
    return ChessRulesService.isKingInCheckOnBoard(simulatedBoard, sourceColor);
  }

  private static simulateMoveOnBoard(
    board: ChessPieceDto[][][],
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number
  ): ChessPieceDto[][][] {
    const nextBoard = board.map(row => row.map(cell => {
      if (!cell || cell.length < 1) {
        return [];
      }
      return [new ChessPieceDto(cell[0].color, cell[0].piece)];
    }));

    const movingPiece = nextBoard[srcRow] && nextBoard[srcRow][srcCol] && nextBoard[srcRow][srcCol][0]
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

    return nextBoard;
  }

  private static findKingPosition(
    board: ChessPieceDto[][][],
    kingColor: ChessColorsEnum
  ): { row: number, col: number } | null {
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (cell && cell[0] && cell[0].piece === ChessPiecesEnum.King && cell[0].color === kingColor) {
          return { row, col };
        }
      }
    }
    return null;
  }

  private static isKingInCheckOnBoard(board: ChessPieceDto[][][], kingColor: ChessColorsEnum): boolean {
    const kingPosition = ChessRulesService.findKingPosition(board, kingColor);
    if (!kingPosition) {
      return false;
    }

    const attackerColor = ChessRulesService.getEnemyColor(kingColor);
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const attackerCell = board[row][col];
        if (!(attackerCell && attackerCell[0] && attackerCell[0].color === attackerColor)) {
          continue;
        }
        const attacker = attackerCell[0];
        const canAttackKing = ChessRulesService.withBoardContext(board, attackerColor, () =>
          ChessRulesService.canStepThere(
            kingPosition.row,
            kingPosition.col,
            [new ChessPieceDto(kingColor, ChessPiecesEnum.King)],
            row,
            col,
            new ChessPieceDto(attacker.color, attacker.piece)
          )
        );
        if (canAttackKing) {
          return true;
        }
      }
    }
    return false;
  }

  private static withBoardContext<T>(board: ChessPieceDto[][][], turn: ChessColorsEnum, callback: () => T): T {
    const previousField = ChessBoardStateService.CHESS_FIELD;
    const previousTurn = ChessBoardStateService.BOARD_HELPER ? ChessBoardStateService.BOARD_HELPER.colorTurn : null;
    const previousCastle = ChessBoardStateService.BOARD_HELPER ? ChessBoardStateService.BOARD_HELPER.justDidCastle : null;
    try {
      ChessBoardStateService.CHESS_FIELD = board;
      if (ChessBoardStateService.BOARD_HELPER) {
        ChessBoardStateService.BOARD_HELPER.colorTurn = turn;
        ChessBoardStateService.BOARD_HELPER.justDidCastle = null;
      }
      return callback();
    } finally {
      ChessBoardStateService.CHESS_FIELD = previousField;
      if (ChessBoardStateService.BOARD_HELPER) {
        ChessBoardStateService.BOARD_HELPER.colorTurn = previousTurn;
        ChessBoardStateService.BOARD_HELPER.justDidCastle = previousCastle;
      }
    }
  }

  static queenRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    // invalid IF NOR: Bishop + rook rules
    const violatesBishopPattern = Math.abs(cmParams.targetCol - cmParams.srcCol) !== Math.abs(cmParams.targetRow - cmParams.srcRow);
    const violatesRookPattern = cmParams.targetCol !== cmParams.srcCol && cmParams.targetRow !== cmParams.srcRow;
    const piecesInWay = ChessBoardStateService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if ((violatesBishopPattern && violatesRookPattern) || piecesInWay) {
      cmResult.canDrop = false;
    }
  }

  static rookRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    // invalid IF: not Same row AND not same col
    const piecesInWay = ChessBoardStateService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if ((cmParams.targetCol !== cmParams.srcCol && cmParams.targetRow !== cmParams.srcRow) || piecesInWay) {
      cmResult.canDrop = false;
    }
  }

  static bishopRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    // invalid IF: not same side as up-down
    const piecesInWay = ChessBoardStateService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if ((Math.abs(cmParams.targetCol - cmParams.srcCol) !== Math.abs(cmParams.targetRow - cmParams.srcRow)) || piecesInWay) {
      cmResult.canDrop = false;
    }
  }

  static valueOfPiece(piece: ChessPiecesEnum): number {
    switch (piece) {
      case ChessPiecesEnum.Pawn: {
        return 1;
      }
      case ChessPiecesEnum.Knight: {
        return 3;
      }
      case ChessPiecesEnum.King: {
        return 99;
      }
      case ChessPiecesEnum.Queen: {
        return 9;
      }
      case ChessPiecesEnum.Rook: {
        return 5;
      }
      case ChessPiecesEnum.Bishop: {
        return 3;
      }
      default:
        break;
    }
  }
}
