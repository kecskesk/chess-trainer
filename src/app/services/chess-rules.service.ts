import { Injectable } from '@angular/core';
import { GlobalVariablesService } from './global-variables.service';

@Injectable()
export class ChessRulesService {

  constructor() {}

  public static canStepThere(sourceLocation: string, targetLocation: string, targetData: any): boolean {
      let targetObj = null;
      let targetPiece = null;
      let targetColor = null;
      if (targetData && targetData[0]) {
        targetObj = targetData[0];
        targetColor = targetObj.color;
        targetPiece = targetObj.piece;
      }
      const targetLocSplit = targetLocation.split('field');
      const targetRow = Number(targetLocSplit[1][0]);
      const targetCell = Number(targetLocSplit[1][1]);
      let sourceObj = null;
      let sourcePiece = null;
      let sourceColor = null;
      const sourceLocSplit = sourceLocation.split('field');
      const sourceRow = Number(sourceLocSplit[1][0]);
      const sourceCell = Number(sourceLocSplit[1][1]);
      if (!GlobalVariablesService.CHESS_FIELD || !GlobalVariablesService.DEBUG_OBJECT) {
        return false;
      }
      const history = GlobalVariablesService.DEBUG_OBJECT.history
      sourceObj = GlobalVariablesService.CHESS_FIELD[sourceRow][sourceCell];
      if (!(sourceObj && sourceObj[0])) {
        return false;
      }
      sourceColor = sourceObj[0].color;
      sourcePiece = sourceObj[0].piece;
      if (sourceColor !== GlobalVariablesService.DEBUG_OBJECT.colorTurn) {
        return false;
      }
      // Cell occupied
      let canDrop = targetData.length < 1;
      // Can hit
      let canHit = false;
      if (targetData.length === 1 && targetData[0].color != sourceColor) {
        canDrop = true;
        canHit = true;
      }
      switch (sourcePiece) {
        case 'pawn': {
          const stepY = targetRow - sourceRow;
          const stepX = Math.abs(targetCell - sourceCell);
          // Can step 1 in direction
          const targetDirectionStep = sourceColor === 'white' ? -1 : 1;
          // Pawn on home row
          const homeRow = sourceColor === 'white' ? 6 : 1;
          const enemyFirstStep = sourceColor === 'black' ? 5 : 2;
          // Can step 2 from home row
          const homeRowStep = sourceColor === 'white' ? -2 : 2;
          // Cannot step left/right
          const validStepForward = ((stepY === targetDirectionStep) || (sourceRow === homeRow && stepY === homeRowStep)) && stepX === 0;
          if (!validStepForward) {
            canDrop = false;
          }
          // Pawn magic 1 (cannot hit straight)
          if (validStepForward && canHit) {
            canDrop = false;
            canHit = false;
          }
          // Pawn magic 2 (can hit 1 across)
          if (canHit && stepX === 1 && stepY === targetDirectionStep) {
            canDrop = true;
          }
          // Pawn magic 3 (en passant)
          const lastHistory = history[history.length - 1];
          const epTargetRow = sourceColor === 'white' ? 3 : 4;
          const epSourceRow = sourceColor === 'white' ? 1 : 6;
          const possibleEP = GlobalVariablesService.translateNotation(
            epTargetRow, targetCell, epSourceRow, targetCell, 'pawn', false, false, false, false, null);
          if (stepX === 1 && stepY === targetDirectionStep && targetRow === enemyFirstStep && lastHistory === possibleEP) {
            canDrop = true;
            canHit = true;
            GlobalVariablesService.DEBUG_OBJECT.justDidEnPassant = { row: epTargetRow, col: targetCell };
          }
          break;
        }
        case 'knight': {
          const stepX = Math.abs(targetCell - sourceCell);
          const stepY = Math.abs(targetRow - sourceRow);
          // Side 1 and up-down 2 or side 2 and up-down 1
          if (!(stepX === 2 && stepY === 1) && !(stepX === 1 && stepY === 2)) {
            canDrop = false;
          }
          break;
        }
        case 'king': {
          // Side 1 and up-down 1
          if (Math.abs(targetCell - sourceCell) > 1) {
            canDrop = false;
          }
          if (Math.abs(targetRow - sourceRow) > 1) {
            canDrop = false;
          }
          break;
        }
        case 'queen': {
          // invalid IF NOR: Bishop + rook rules
          const bishopRules = Math.abs(targetCell - sourceCell) !== Math.abs(targetRow - sourceRow);
          const rookRules = targetCell !== sourceCell && targetRow !== sourceRow;
          if (bishopRules && rookRules) {
            canDrop = false;
          }
          break;
        }
        case 'rook': {
          // invalid IF not:  Same row OR same col
          if (targetCell !== sourceCell && targetRow !== sourceRow) {
            canDrop = false;
          }
          break;
        }
        case 'bishop': {
          // invalid IF not: must be same side as up-down
          if (Math.abs(targetCell - sourceCell) !== Math.abs(targetRow - sourceRow)) {
            canDrop = false;
          }
          break;
        }
        default:
          break;
      }
      if (GlobalVariablesService.DEBUG_OBJECT && canDrop) {
        if (!GlobalVariablesService.DEBUG_OBJECT.possibles) {
          GlobalVariablesService.DEBUG_OBJECT.possibles = [];
        }
        GlobalVariablesService.DEBUG_OBJECT.possibles.push(targetLocation)
        if (canHit) {
          if (!GlobalVariablesService.DEBUG_OBJECT.hits) {
            GlobalVariablesService.DEBUG_OBJECT.hits = [];
          }
          GlobalVariablesService.DEBUG_OBJECT.hits.push(targetLocation)
        }
      }
      return canDrop;
  }

}
