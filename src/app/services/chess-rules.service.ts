import { Injectable } from '@angular/core';
import { GlobalVariablesService } from './global-variables.service';
import { ChessMoveResultDto } from '../model/chess-move-result.dto';
import { ChessMoveParamsDto } from '../model/chess-move-params.dto';
import { ChessPieceDto } from '../model/chess-piece.dto';

@Injectable()
export class ChessRulesService {

  constructor() {}

  public static canStepThere(targetRow: number, targetCol: number, targetData: ChessPieceDto[], srcRow: number, srcCol: number, justLookingWithPiece: ChessPieceDto = null): boolean {
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
      let sourceColor = null;
      if (!GlobalVariablesService.CHESS_FIELD || !GlobalVariablesService.DEBUG_OBJECT) {
        return false;
      }
      const moveHistory = GlobalVariablesService.DEBUG_OBJECT.history
      sourceData = GlobalVariablesService.CHESS_FIELD[srcRow][srcCol];
      if (justLookingWithPiece) {
        sourceData = [justLookingWithPiece];
      }
      if (!(sourceData && sourceData[0])) {
        return false;
      }
      sourceColor = sourceData[0].color;
      let enemyColor = sourceColor === 'white' ? 'black' : 'white';
      sourcePiece = sourceData[0].piece;
      if (sourceColor !== GlobalVariablesService.DEBUG_OBJECT.colorTurn) {
        return false;
      }
      const cmResult = new ChessMoveResultDto(
        targetData.length < 1, false, false, targetData.length < 1);
      if (targetData.length === 1 && targetData[0].color != sourceColor) {
        cmResult.canDrop = true;
        cmResult.canHit = true;
      }
      const cmParams = new ChessMoveParamsDto(
        targetRow, targetCol, srcRow, srcCol, sourceColor, moveHistory);
      switch (sourcePiece) {
        case 'pawn': {
          ChessRulesService.pawnRules(cmResult, cmParams);
          break;
        }
        case 'knight': {
          ChessRulesService.knightRules(cmResult, cmParams);
          break;
        }
        case 'king': {
          ChessRulesService.kingRules(cmResult, cmParams);
          break;
        }
        case 'queen': {
          ChessRulesService.queenRules(cmResult, cmParams);
          break;
        }
        case 'rook': {
          ChessRulesService.rookRules(cmResult, cmParams);
          break;
        }
        case 'bishop': {
          ChessRulesService.bishopRules(cmResult, cmParams);
          break;
        }
        default:
          break;
      }

      let enemyKingPos = { row: null, col: null };
      GlobalVariablesService.CHESS_FIELD.forEach((row, rowIdx) => {
        const kingIndex = row.findIndex(
          cell => cell && cell[0] && cell[0].piece === 'king' && cell[0].color === enemyColor);
        if (kingIndex >= 0) {
          enemyKingPos.row = rowIdx;
          enemyKingPos.col = kingIndex;
        }
      });
      if (!justLookingWithPiece) {
        const isCheck = ChessRulesService.canStepThere(
          enemyKingPos.row, enemyKingPos.col, [new ChessPieceDto(enemyColor, 'king')],
          targetRow, targetCol, { color: sourceColor, piece: sourcePiece });
        if (GlobalVariablesService.DEBUG_OBJECT && cmResult.canDrop) {
          if (!GlobalVariablesService.DEBUG_OBJECT.possibles) {
            GlobalVariablesService.DEBUG_OBJECT.possibles = {};
          }
          GlobalVariablesService.addPossible({ row: targetRow, col: targetCol });
          if (cmResult.canHit) {
            if (!GlobalVariablesService.DEBUG_OBJECT.hits) {
              GlobalVariablesService.DEBUG_OBJECT.hits = {};
            }
            GlobalVariablesService.addHit({ row: targetRow, col: targetCol });
          }
          if (isCheck) {
            if (!GlobalVariablesService.DEBUG_OBJECT.checks) {
              GlobalVariablesService.DEBUG_OBJECT.checks = {};
            }
            GlobalVariablesService.addCheck({ row: targetRow, col: targetCol });
            GlobalVariablesService.addArrow({
              top: '250px',
              left: '130px',
              rotate: '45deg',
              transform: 'scaleX(5.5)'
            }, 1);
          }
        }
      }

      return cmResult.canDrop;
  }

  static knightRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto) {
    const stepX = Math.abs(cmParams.targetCol - cmParams.srcCol);
    const stepY = Math.abs(cmParams.targetRow - cmParams.srcRow);
    // Side 1 and up-down 2 or side 2 and up-down 1
    if (!(stepX === 2 && stepY === 1) && !(stepX === 1 && stepY === 2)) {
      cmResult.canDrop = false;
    }
  }

  static pawnRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto) {
    const stepY = cmParams.targetRow - cmParams.srcRow;
    const stepX = Math.abs(cmParams.targetCol - cmParams.srcCol);
    // Can step 1 in direction
    const targetDirectionStep = cmParams.sourceColor === 'white' ? -1 : 1;
    // Pawn on home row
    const homeRow = cmParams.sourceColor === 'white' ? 6 : 1;
    const enemyFirstStep = cmParams.sourceColor === 'black' ? 5 : 2;
    // Can step 2 from home row
    const homeRowStep = cmParams.sourceColor === 'white' ? -2 : 2;
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
    const lastHistory = cmParams.moveHistory[historyLength - 1];
    const epTargetRow = cmParams.sourceColor === 'white' ? 3 : 4;
    const epSourceRow = cmParams.sourceColor === 'white' ? 1 : 6;
    const possibleEP = GlobalVariablesService.translateNotation(
      epTargetRow, cmParams.targetCol, epSourceRow, cmParams.targetCol, 'pawn', false, false, false, false, null);
    if (stepX === 1 && stepY === targetDirectionStep && cmParams.targetRow === enemyFirstStep && lastHistory === possibleEP) {
      cmResult.canDrop = true;
      cmResult.canHit = true;
      GlobalVariablesService.DEBUG_OBJECT.justDidEnPassant = { row: epTargetRow, col: cmParams.targetCol };
    }
  }

  static kingRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto) {
    // Side 1 and up-down 1
    if (Math.abs(cmParams.targetCol - cmParams.srcCol) > 1) {
      cmResult.canDrop = false;
    }
    if (Math.abs(cmParams.targetRow - cmParams.srcRow) > 1) {
      cmResult.canDrop = false;
    }
    const castleSourceRow = cmParams.sourceColor === 'white' ? 7 : 0;
    const castleSourceCell = 4;
    const castleTargetRow = castleSourceRow;
    const castleTargetCell1 = 2;
    const castleTargetCell2 = 6;
    const rookInPlace1 = GlobalVariablesService.CHESS_FIELD[castleSourceRow][0];
    const rook1OK = rookInPlace1.length === 1 &&
      rookInPlace1[0] && rookInPlace1[0].color === cmParams.sourceColor && rookInPlace1[0].piece === 'rook';
    const rookInPlace2 = GlobalVariablesService.CHESS_FIELD[castleSourceRow][7];
    const rook2OK = rookInPlace2.length === 1 &&
      rookInPlace2[0] && rookInPlace2[0].color === cmParams.sourceColor && rookInPlace2[0].piece === 'rook';
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if (cmResult.targetEmpty && cmParams.srcRow === castleSourceRow && cmParams.srcCol === castleSourceCell &&
      cmParams.targetRow === castleTargetRow && cmParams.targetCol === castleTargetCell1 &&
      rook1OK && !piecesInWay) {
      cmResult.canDrop = true;
      GlobalVariablesService.DEBUG_OBJECT.justDidCastle = { row: cmParams.targetRow, col: cmParams.targetCol };
    }
    if (cmResult.targetEmpty && cmParams.srcRow === castleSourceRow && cmParams.srcCol === castleSourceCell &&
      cmParams.targetRow === castleTargetRow && cmParams.targetCol === castleTargetCell2 &&
      rook2OK && !piecesInWay) {
      cmResult.canDrop = true;
      GlobalVariablesService.DEBUG_OBJECT.justDidCastle = { row: cmParams.targetRow, col: cmParams.targetCol };
    }
  }

  static queenRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto) {
    // invalid IF NOR: Bishop + rook rules
    const bishopRules = Math.abs(cmParams.targetCol - cmParams.srcCol) !== Math.abs(cmParams.targetRow - cmParams.srcRow);
    const rookRules = cmParams.targetCol !== cmParams.srcCol && cmParams.targetRow !== cmParams.srcRow;
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if ((bishopRules && rookRules) || piecesInWay) {
      cmResult.canDrop = false;
    }
  }

  static rookRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto) {
    // invalid IF: not Same row AND not same col
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if ((cmParams.targetCol !== cmParams.srcCol && cmParams.targetRow !== cmParams.srcRow) || piecesInWay) {
      cmResult.canDrop = false;
    }
  }

  static bishopRules(cmResult: ChessMoveResultDto, cmParams: ChessMoveParamsDto) {
    // invalid IF: not same side as up-down
    const piecesInWay = GlobalVariablesService.pieceIsInWay(cmParams.targetRow, cmParams.targetCol, cmParams.srcRow, cmParams.srcCol);
    if ((Math.abs(cmParams.targetCol - cmParams.srcCol) !== Math.abs(cmParams.targetRow - cmParams.srcRow)) || piecesInWay) {
      cmResult.canDrop = false;
    }
  }

}
