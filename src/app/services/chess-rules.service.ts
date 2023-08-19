import { Injectable } from '@angular/core';
import { DebugObjectService } from './debug-object.service';

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
      if (DebugObjectService.CHESS_FIELD) {
        sourceObj = DebugObjectService.CHESS_FIELD[sourceRow][sourceCell];
        if (sourceObj && sourceObj[0]) {
          sourceColor = sourceObj[0].color;
          sourcePiece = sourceObj[0].piece;
        }
      }
      // Cell occupied
      let canDrop = targetData.length < 1;
      // Can hit
      let canHit = false;
      if (targetData.length == 1 && targetData[0].color != sourceColor) {
        canDrop = true;
        canHit = true;
      }
      switch (sourcePiece) {
        case 'pawn': {
          const stepY = targetRow - sourceRow;
          // Can step 1 in direction
          const targetDirectionStep = sourceColor === 'white' ? -1 : 1;
          // Pawn on home row
          const homeRow = sourceColor === 'white' ? 6 : 1;
          // Can step 2 from home row
          const homeRowStep = sourceColor === 'white' ? -2 : 2;
          // Cannot step left/right **** TODO can hit left right + en passant
          const sameColumn = targetCell === sourceCell;
          const validStepForward = (stepY === targetDirectionStep) || (sourceRow == homeRow && stepY === homeRowStep)
          if (!sameColumn || !validStepForward) {
            canDrop = false;
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
      if (DebugObjectService.DEBUG_OBJECT && canDrop) {
        // DebugObjectService.DEBUG_OBJECT.debugText += `source c${sourceCell}r${sourceRow}`
        const letterChar = String.fromCharCode('a'.charCodeAt(0) + targetCell);
        const numberChar = (8 - targetRow);
        if (!DebugObjectService.DEBUG_OBJECT.possibles) {
          DebugObjectService.DEBUG_OBJECT.possibles = [];
        }
        DebugObjectService.DEBUG_OBJECT.possibles.push(targetLocation)
        if (canHit) {
          if (!DebugObjectService.DEBUG_OBJECT.hits) {
            DebugObjectService.DEBUG_OBJECT.hits = [];
          }
          DebugObjectService.DEBUG_OBJECT.hits.push(targetLocation)
        }
      }
      return canDrop;
  }

}
