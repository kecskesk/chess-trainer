import { Injectable } from '@angular/core';
import { GlobalVariablesService } from './global-variables.service';
import { ChessMoveResultDto } from '../model/chess-move-result.dto';
import { ChessMoveParamsDto } from '../model/chess-move-params.dto';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/chess.colors';
import { ChessPiecesEnum } from '../model/chess.pieces';

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
      if (sourceColor !== GlobalVariablesService.BOARD_HELPER.colorTurn && !justLookingWithPiece) {
        return false;
      }
      const cmResult = new ChessMoveResultDto(
        targetData.length < 1, false, false, targetData.length < 1);
      if (targetData.length === 1 && targetData[0].color !== sourceColor) {
        cmResult.canDrop = true;
        cmResult.canHit = true;
      }
      const cmParams = new ChessMoveParamsDto(
        targetRow, targetCol, srcRow, srcCol, sourceColor, moveHistory);
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
          GlobalVariablesService.addPossible({ row: targetRow, col: targetCol });
          if (cmResult.canHit) {
            if (!GlobalVariablesService.BOARD_HELPER.hits) {
              GlobalVariablesService.BOARD_HELPER.hits = {};
            }
            GlobalVariablesService.addHit({ row: targetRow, col: targetCol });
          }
          if (isCheck) {
            if (!GlobalVariablesService.BOARD_HELPER.checks) {
              GlobalVariablesService.BOARD_HELPER.checks = {};
            }
            GlobalVariablesService.addCheck({ row: targetRow, col: targetCol });
            GlobalVariablesService.createArrow(
              { row: 8 - srcRow, col: srcCol + 1 }, { row: 8 - targetRow, col: targetCol + 1 }, 'red', 0.25);
          }
        }
      }

      return cmResult.canDrop;
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
    // Side 1 and up-down 1
    if (Math.abs(cmParams.targetCol - cmParams.srcCol) > 1) {
      cmResult.canDrop = false;
    }
    if (Math.abs(cmParams.targetRow - cmParams.srcRow) > 1) {
      cmResult.canDrop = false;
    }
    const castleSourceRow = cmParams.sourceColor === ChessColorsEnum.White ? 7 : 0;
    const castleSourceCell = 4;
    const castleTargetRow = castleSourceRow;
    const castleTargetCell1 = 2;
    const castleTargetCell2 = 6;
    const rookInPlace1 = GlobalVariablesService.CHESS_FIELD[castleSourceRow][0];
    const rook1OK = rookInPlace1.length === 1 &&
      rookInPlace1[0] && rookInPlace1[0].color === cmParams.sourceColor && rookInPlace1[0].piece === ChessPiecesEnum.Rook;
    const rookInPlace2 = GlobalVariablesService.CHESS_FIELD[castleSourceRow][7];
    const rook2OK = rookInPlace2.length === 1 &&
      rookInPlace2[0] && rookInPlace2[0].color === cmParams.sourceColor && rookInPlace2[0].piece === ChessPiecesEnum.Rook;
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if (cmResult.targetEmpty && cmParams.srcRow === castleSourceRow && cmParams.srcCol === castleSourceCell &&
      cmParams.targetRow === castleTargetRow && cmParams.targetCol === castleTargetCell1 &&
      rook1OK && !piecesInWay) {
      cmResult.canDrop = true;
      GlobalVariablesService.BOARD_HELPER.justDidCastle = { row: cmParams.targetRow, col: cmParams.targetCol };
    }
    if (cmResult.targetEmpty && cmParams.srcRow === castleSourceRow && cmParams.srcCol === castleSourceCell &&
      cmParams.targetRow === castleTargetRow && cmParams.targetCol === castleTargetCell2 &&
      rook2OK && !piecesInWay) {
      cmResult.canDrop = true;
      GlobalVariablesService.BOARD_HELPER.justDidCastle = { row: cmParams.targetRow, col: cmParams.targetCol };
    }
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
