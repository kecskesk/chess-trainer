import { Injectable } from '@angular/core';
import { GlobalVariablesService } from './global-variables.service';
import { ChessMoveResultDto } from '../model/chess-move-result.dto';
import { ChessMoveParamsDto } from '../model/chess-move-params.dto';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/chess.colors';
import { ChessPiecesEnum } from '../model/chess.pieces';
import { IMoveValidationResult } from '../model/move-validation-result.interface';
import { IBoardHighlight } from '../model/board-highlight.interface';
import { IVisualizationArrow } from '../model/visualization-arrow.interface';

@Injectable()
export class ChessRulesService {

  constructor() {}

  public static canStepThere(
    targetRow: number,
    targetCol: number,
    targetData: ChessPieceDto[],
    srcRow: number,
    srcCol: number,
    justLookingWithPiece: ChessPieceDto = null
  ): boolean {
      let targetObj = null;
      let targetPiece = null;
      let targetColor = null;
      if (targetData && targetData[0]) {
        targetObj = targetData[0];
        targetColor = targetObj.color;
        targetPiece = targetObj.piece;
      }
      let sourceData = null;
      let sourcePiece = null;
      let sourceColor: ChessColorsEnum = null;
      if (!GlobalVariablesService.CHESS_FIELD || !GlobalVariablesService.BOARD_HELPER) {
        return false;
      }
      const moveHistory = GlobalVariablesService.BOARD_HELPER.history;
      sourceData = GlobalVariablesService.CHESS_FIELD[srcRow][srcCol];
      if (justLookingWithPiece) {
        sourceData = [justLookingWithPiece];
      }
      if (!(sourceData && sourceData[0])) {
        return false;
      }
      sourceColor = sourceData[0].color;
      const enemyColor: ChessColorsEnum = sourceColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
      sourcePiece = sourceData[0].piece;
      const moveValidationResult: IMoveValidationResult = {
        isValid: targetData.length < 1,
        isEmptyTarget: targetData.length < 1,
        isEnemyPiece: false
      };
      if (targetData.length === 1 && targetData[0].color !== sourceColor) {
        moveValidationResult.isValid = true;
        moveValidationResult.isEnemyPiece = true;
      }
      if (sourceColor !== GlobalVariablesService.BOARD_HELPER.colorTurn && !justLookingWithPiece) {
        moveValidationResult.isValid = false;
        moveValidationResult.errorMessage = 'Not this color\'s turn';
        return false;
      }
      const cmResult = new ChessMoveResultDto(
        moveValidationResult.isValid, moveValidationResult.isEnemyPiece, false, moveValidationResult.isEmptyTarget);
      const cmParams = new ChessMoveParamsDto(
        targetRow, targetCol, srcRow, srcCol, sourceColor, moveHistory, !!justLookingWithPiece);
      switch (sourcePiece) {
        case ChessPiecesEnum.Pawn: {
          ChessRulesService.pawnRules(cmResult, cmParams);
          break;
        }
        case ChessPiecesEnum.Knight: {
          ChessRulesService.knightRules(cmResult, cmParams);
          break;
        }
        case ChessPiecesEnum.King: {
          ChessRulesService.kingRules(cmResult, cmParams);
          break;
        }
        case ChessPiecesEnum.Queen: {
          ChessRulesService.queenRules(cmResult, cmParams);
          break;
        }
        case ChessPiecesEnum.Rook: {
          ChessRulesService.rookRules(cmResult, cmParams);
          break;
        }
        case ChessPiecesEnum.Bishop: {
          ChessRulesService.bishopRules(cmResult, cmParams);
          break;
        }
        default:
          break;
      }

      const enemyKingPos = { row: null, col: null };
      GlobalVariablesService.CHESS_FIELD.forEach((row, rowIdx) => {
        const kingIndex = row.findIndex(
          cell => cell && cell[0] && cell[0].piece === ChessPiecesEnum.King && cell[0].color === enemyColor);
        if (kingIndex >= 0) {
          enemyKingPos.row = rowIdx;
          enemyKingPos.col = kingIndex;
        }
      });
      if (!justLookingWithPiece) {
        const isCheck = ChessRulesService.canStepThere(
          enemyKingPos.row, enemyKingPos.col, [new ChessPieceDto(enemyColor, ChessPiecesEnum.King)],
          targetRow, targetCol, { color: sourceColor, piece: sourcePiece });
        if (GlobalVariablesService.BOARD_HELPER && cmResult.canDrop) {
          if (!GlobalVariablesService.BOARD_HELPER.possibles) {
            GlobalVariablesService.BOARD_HELPER.possibles = {};
          }
          GlobalVariablesService.addHighlight({ row: targetRow, col: targetCol, type: 'possible' });
          if (cmResult.canHit) {
            if (!GlobalVariablesService.BOARD_HELPER.hits) {
              GlobalVariablesService.BOARD_HELPER.hits = {};
            }
            GlobalVariablesService.addHighlight({ row: targetRow, col: targetCol, type: 'capture' });
          }
          if (isCheck) {
            if (!GlobalVariablesService.BOARD_HELPER.checks) {
              GlobalVariablesService.BOARD_HELPER.checks = {};
            }
            const checkHighlight: IBoardHighlight = { row: targetRow, col: targetCol, type: 'check' };
            GlobalVariablesService.addHighlight(checkHighlight);
            const checkArrow: IVisualizationArrow = {
              fromRow: 8 - srcRow,
              fromCol: srcCol + 1,
              toRow: 8 - targetRow,
              toCol: targetCol + 1,
              color: 'red',
              intensity: 0.25
            };
            GlobalVariablesService.createArrowFromVisualization(checkArrow);
          }
        }
      }

      return cmResult.canDrop;
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
      (GlobalVariablesService.CHESS_FIELD && GlobalVariablesService.CHESS_FIELD[srcRow] && GlobalVariablesService.CHESS_FIELD[srcRow][srcCol]
        ? GlobalVariablesService.CHESS_FIELD[srcRow][srcCol][0]
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
    const stepY = cmParams.targetRow - cmParams.srcRow;
    const stepX = Math.abs(cmParams.targetCol - cmParams.srcCol);
    // Can step 1 in direction
    const targetDirectionStep = cmParams.sourceColor === ChessColorsEnum.White ? -1 : 1;
    // Pawn on home row
    const homeRow = cmParams.sourceColor === ChessColorsEnum.White ? 6 : 1;
    const enemyFirstStep = cmParams.sourceColor === ChessColorsEnum.Black ? 5 : 2;
    // Can step 2 from home row
    const homeRowStep = cmParams.sourceColor === ChessColorsEnum.White ? -2 : 2;
    // Cannot step left/right
    const validStepForward = ((stepY === targetDirectionStep) || (cmParams.srcRow === homeRow && stepY === homeRowStep)) && stepX === 0;
    if (!validStepForward) {
      cmResult.canDrop = false;
    }
    // Pawn magic 1 (cannot hit straight)
    if (validStepForward && cmResult.canHit) {
      cmResult.canDrop = false;
      cmResult.canHit = false;
    }
    // Pawn magic 2 (can hit 1 across)
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if (cmResult.canHit && stepX === 1 && stepY === targetDirectionStep && !piecesInWay) {
      cmResult.canDrop = true;
    }
    // Pawn magic 3 (en passant)
    const historyLength = Object.keys(cmParams.moveHistory).length;
    const lastHistory = cmParams.moveHistory[historyLength];
    const epTargetRow = cmParams.sourceColor === ChessColorsEnum.White ? 3 : 4;
    const epSourceRow = cmParams.sourceColor === ChessColorsEnum.White ? 1 : 6;
    const possibleEP = GlobalVariablesService.translateNotation(
      epTargetRow, cmParams.targetCol, epSourceRow, cmParams.targetCol, ChessPiecesEnum.Pawn, false, false, false, false, null);
    if (stepX === 1 && stepY === targetDirectionStep && cmParams.targetRow === enemyFirstStep && lastHistory === possibleEP) {
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
    const rookCell = GlobalVariablesService.CHESS_FIELD[castleSourceRow][rookSourceCol];
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
    const hasPieceInWay = rookPathCols.some(col => GlobalVariablesService.CHESS_FIELD[castleSourceRow][col].length > 0);
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
    GlobalVariablesService.BOARD_HELPER.justDidCastle = { row: cmParams.targetRow, col: cmParams.targetCol };
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
    const historyEntries = Object.keys(moveHistory)
      .map(key => ({ index: Number(key), notation: moveHistory[key] }))
      .filter(entry => !isNaN(entry.index) && !!entry.notation)
      .sort((a, b) => a.index - b.index);

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
  ): { piece: ChessPiecesEnum, sourceSquare: string } | null {
    if (!notation || notation === 'O-O' || notation === 'O-O-O') {
      return null;
    }
    const match = notation.match(/^([KQRBN]?)([a-h][1-8])(?:-|x)?[a-h][1-8]/);
    if (!match) {
      return null;
    }
    const pieceChar = match[1];
    let piece = ChessPiecesEnum.Pawn;
    switch (pieceChar) {
      case 'K': {
        piece = ChessPiecesEnum.King;
        break;
      }
      case 'Q': {
        piece = ChessPiecesEnum.Queen;
        break;
      }
      case 'R': {
        piece = ChessPiecesEnum.Rook;
        break;
      }
      case 'B': {
        piece = ChessPiecesEnum.Bishop;
        break;
      }
      case 'N': {
        piece = ChessPiecesEnum.Knight;
        break;
      }
      default: {
        piece = ChessPiecesEnum.Pawn;
        break;
      }
    }
    return {
      piece,
      sourceSquare: match[2]
    };
  }

  private static toSquareNotation(row: number, col: number): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + col);
    const rank = `${8 - row}`;
    return `${file}${rank}`;
  }

  private static isSquareUnderAttack(row: number, col: number, attackerColor: ChessColorsEnum): boolean {
    const targetColor = attackerColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    for (let srcRow = 0; srcRow <= 7; srcRow++) {
      for (let srcCol = 0; srcCol <= 7; srcCol++) {
        const attackerCell = GlobalVariablesService.CHESS_FIELD[srcRow][srcCol];
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

  static queenRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    // invalid IF NOR: Bishop + rook rules
    const bishopRules = Math.abs(cmParams.targetCol - cmParams.srcCol) !== Math.abs(cmParams.targetRow - cmParams.srcRow);
    const rookRules = cmParams.targetCol !== cmParams.srcCol && cmParams.targetRow !== cmParams.srcRow;
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if ((bishopRules && rookRules) || piecesInWay) {
      cmResult.canDrop = false;
    }
  }

  static rookRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    // invalid IF: not Same row AND not same col
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if ((cmParams.targetCol !== cmParams.srcCol && cmParams.targetRow !== cmParams.srcRow) || piecesInWay) {
      cmResult.canDrop = false;
    }
  }

  static bishopRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto): void {
    // invalid IF: not same side as up-down
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
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
