import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessPositionDto } from '../model/chess-position.dto';
import { IVisualizationArrow } from '../model/interfaces/visualization-arrow.interface';
import { ChessConstants } from '../constants/chess.constants';
import { ChessRulesService } from '../services/chess-rules.service';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';

export class ChessBoardVisualizationFacade {
  static initColors(turnColor: ChessColorsEnum, ofEnemy: boolean): { ofColor: ChessColorsEnum; enemyColor: ChessColorsEnum } {
    if (!ofEnemy) {
      return {
        ofColor: turnColor,
        enemyColor: turnColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White
      };
    }
    return {
      enemyColor: turnColor,
      ofColor: turnColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White
    };
  }

  static createVisualizationArrow(
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

  static getThreatsBy(
    board: ChessPieceDto[][][],
    rowIdx: number,
    cellIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): { pos: ChessPositionDto; piece: ChessPiecesEnum }[] {
    const cell = board[rowIdx][cellIdx];
    if (!(cell && cell[0])) {
      return [];
    }
    const threats: { pos: ChessPositionDto; piece: ChessPiecesEnum }[] = [];
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        if (cellIdx === targetCol && rowIdx === targetRow) {
          continue;
        }
        const targetCell = board[targetRow][targetCol];
        const isEnemyTarget = !!(targetCell && targetCell[0] && targetCell[0].color === enemyColor);
        if (!isEnemyTarget) {
          continue;
        }
        const legalMove = ChessBoardLogicUtils.canPlayLegalMove(board, rowIdx, cellIdx, targetRow, targetCol, ofColor, cell[0]);
        if (legalMove) {
          threats.push({ pos: new ChessPositionDto(targetRow, targetCol), piece: targetCell[0].piece });
        }
      }
    }
    return threats;
  }

  static getThreatsOn(
    board: ChessPieceDto[][][],
    rowIdx: number,
    cellIdx: number,
    attackerColor: ChessColorsEnum
  ): { pos: ChessPositionDto; piece: ChessPiecesEnum }[] {
    const cell = board[rowIdx][cellIdx];
    if (!(cell && cell[0])) {
      return [];
    }
    const threats: { pos: ChessPositionDto; piece: ChessPiecesEnum }[] = [];
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        if (cellIdx === targetCol && rowIdx === targetRow) {
          continue;
        }
        const attackerCell = board[targetRow][targetCol];
        if (!(attackerCell && attackerCell[0] && attackerCell[0].color === attackerColor)) {
          continue;
        }
        const legalMove = ChessBoardLogicUtils.canPlayLegalMove(
          board,
          targetRow,
          targetCol,
          rowIdx,
          cellIdx,
          attackerColor,
          attackerCell[0]
        );
        if (legalMove) {
          threats.push({ pos: new ChessPositionDto(targetRow, targetCol), piece: cell[0].piece });
        }
      }
    }
    return threats;
  }

  static getProtectors(
    board: ChessPieceDto[][][],
    cellA: ChessPieceDto[],
    rowAIdx: number,
    cellAIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): ChessPositionDto[] {
    const protectors: ChessPositionDto[] = [];
    board.forEach((rowB, rowBIdx) => {
      rowB.forEach((cellB, cellBIdx) => {
        if (!(cellB && cellB[0] && cellB[0].color === ofColor)) {
          return;
        }
        if (cellAIdx === cellBIdx && rowAIdx === rowBIdx) {
          return;
        }
        if (ChessRulesService.canStepThere(
          rowAIdx,
          cellAIdx,
          [{ color: enemyColor, piece: cellA[0].piece }],
          rowBIdx,
          cellBIdx,
          { color: ofColor, piece: cellB[0].piece }
        )) {
          protectors.push(new ChessPositionDto(rowBIdx, cellBIdx));
        }
      });
    });
    return protectors;
  }

  static threatIntensity(attackerPiece: ChessPiecesEnum, defenderPiece: ChessPiecesEnum): number {
    let intensity = 0.25;
    const attacker = ChessRulesService.valueOfPiece(attackerPiece);
    const defender = ChessRulesService.valueOfPiece(defenderPiece);
    if (attacker / defender > 1) {
      intensity += 0.15;
    }
    if (attacker / defender < 1) {
      intensity -= 0.15;
    }
    return intensity;
  }

  static buildThreatArrows(
    board: ChessPieceDto[][][],
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum,
    getThreatsBy: (
      cell: ChessPieceDto[],
      rowIdx: number,
      cellIdx: number,
      srcColor: ChessColorsEnum,
      dstColor: ChessColorsEnum
    ) => { pos: ChessPositionDto; piece: ChessPiecesEnum }[],
    getProtectors: (
      cellA: ChessPieceDto[],
      rowAIdx: number,
      cellAIdx: number,
      color: ChessColorsEnum,
      enemy: ChessColorsEnum
    ) => ChessPositionDto[]
  ): IVisualizationArrow[] {
    const arrows: IVisualizationArrow[] = [];
    board.forEach((row, rowIdx) => {
      row.forEach((cell, cellIdx) => {
        if (!(cell && cell[0] && cell[0].color === ofColor)) {
          return;
        }
        const threats = getThreatsBy(cell, rowIdx, cellIdx, ofColor, enemyColor);
        threats.forEach(threat => {
          const scaryThreat = this.threatIntensity(threat.piece, cell[0].piece);
          const posFrom = new ChessPositionDto(8 - rowIdx, cellIdx + 1);
          const posTo = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
          const threatenedCell = board[threat.pos.row][threat.pos.col];
          if (threatenedCell && threatenedCell[0]) {
            const protectors = getProtectors(threatenedCell, threat.pos.row, threat.pos.col, enemyColor, ofColor);
            let threatColor: IVisualizationArrow['color'] = protectors.length > 0 ? 'blue' : 'cyan';
            if (threatenedCell[0].piece === ChessPiecesEnum.King) {
              threatColor = 'red';
            }
            arrows.push(this.createVisualizationArrow(posFrom, posTo, threatColor, scaryThreat));
            protectors.forEach(protector => {
              const protectionFrom = new ChessPositionDto(8 - protector.row, protector.col + 1);
              const protectionTo = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
              arrows.push(this.createVisualizationArrow(protectionFrom, protectionTo, 'gold', 0.25));
            });
          } else {
            arrows.push(this.createVisualizationArrow(posFrom, posTo, 'cyan', scaryThreat));
          }
        });
      });
    });
    return arrows;
  }

  static buildProtectedArrows(
    board: ChessPieceDto[][][],
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum,
    getProtectors: (
      cellA: ChessPieceDto[],
      rowAIdx: number,
      cellAIdx: number,
      color: ChessColorsEnum,
      enemy: ChessColorsEnum
    ) => ChessPositionDto[],
    getThreatsOn?: (
      cell: ChessPieceDto[],
      rowIdx: number,
      cellIdx: number,
      defendedColor: ChessColorsEnum,
      attackerColor: ChessColorsEnum
    ) => { pos: ChessPositionDto; piece: ChessPiecesEnum }[]
  ): IVisualizationArrow[] {
    const arrows: IVisualizationArrow[] = [];
    const protectedByMap: {
      [protectorKey: string]: {
        protector: ChessPositionDto;
        targets: Array<{ row: number; col: number; piece: ChessPiecesEnum }>;
      };
    } = {};
    board.forEach((row, rowAIdx) => {
      row.forEach((cellA, cellAIdx) => {
        if (!(cellA && cellA[0] && cellA[0].color === ofColor)) {
          return;
        }
        const protectors = getProtectors(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
        protectors.forEach(cellB => {
          const posFrom = new ChessPositionDto(8 - cellB.row, cellB.col + 1);
          const posTo = new ChessPositionDto(8 - rowAIdx, cellAIdx + 1);
          arrows.push(this.createVisualizationArrow(posFrom, posTo, 'gold', 0.25));

          const protectorKey = `${cellB.row}${cellB.col}`;
          if (!protectedByMap[protectorKey]) {
            protectedByMap[protectorKey] = {
              protector: cellB,
              targets: []
            };
          }
          protectedByMap[protectorKey].targets.push({
            row: rowAIdx,
            col: cellAIdx,
            piece: cellA[0].piece
          });
        });
      });
    });

    Object.values(protectedByMap).forEach((entry) => {
      if (entry.targets.length < 2) {
        return;
      }
      const criticalTargets = entry.targets.filter(target => {
        if (target.piece === ChessPiecesEnum.King) {
          return true;
        }
        if (!getThreatsOn) {
          return true;
        }
        const threatsOnTarget = getThreatsOn(
          board[target.row][target.col],
          target.row,
          target.col,
          ofColor,
          enemyColor
        );
        return threatsOnTarget.length > 0;
      });
      if (criticalTargets.length < 2) {
        return;
      }
      criticalTargets.forEach(target => {
        const from = new ChessPositionDto(8 - entry.protector.row, entry.protector.col + 1);
        const to = new ChessPositionDto(8 - target.row, target.col + 1);
        arrows.push(this.createVisualizationArrow(from, to, 'green', 0.45));
      });
    });

    return arrows;
  }

  static buildHangingArrows(
    board: ChessPieceDto[][][],
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum,
    getProtectors: (
      cellA: ChessPieceDto[],
      rowAIdx: number,
      cellAIdx: number,
      color: ChessColorsEnum,
      enemy: ChessColorsEnum
    ) => ChessPositionDto[],
    getThreatsOn: (
      cell: ChessPieceDto[],
      rowIdx: number,
      cellIdx: number,
      defendedColor: ChessColorsEnum,
      attackerColor: ChessColorsEnum
    ) => { pos: ChessPositionDto; piece: ChessPiecesEnum }[]
  ): IVisualizationArrow[] {
    const arrows: IVisualizationArrow[] = [];
    board.forEach((row, rowAIdx) => {
      row.forEach((cellA, cellAIdx) => {
        if (!(cellA && cellA[0] && cellA[0].color === ofColor)) {
          return;
        }
        const protectedBy = getProtectors(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
        if (protectedBy.length > 0) {
          return;
        }
        const threatsOnCell = getThreatsOn(cellA, rowAIdx, cellAIdx, ofColor, enemyColor);
        threatsOnCell.forEach(threat => {
          const scaryThreat = this.threatIntensity(cellA[0].piece, threat.piece);
          const posFrom = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
          const posTo = new ChessPositionDto(8 - rowAIdx, cellAIdx + 1);
          arrows.push(this.createVisualizationArrow(posFrom, posTo, 'blue', scaryThreat));
        });
      });
    });
    return arrows;
  }

  static buildForkArrows(
    board: ChessPieceDto[][][],
    getThreatsBy: (
      cell: ChessPieceDto[],
      rowIdx: number,
      cellIdx: number,
      srcColor: ChessColorsEnum,
      dstColor: ChessColorsEnum
    ) => { pos: ChessPositionDto; piece: ChessPiecesEnum }[]
  ): IVisualizationArrow[] {
    const forkArrows: IVisualizationArrow[] = [];
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const cell = board[row][col];
        if (!(cell && cell[0])) {
          continue;
        }
        const sourcePiece = cell[0];
        const enemyColor = sourcePiece.color === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
        const threats = getThreatsBy(cell, row, col, sourcePiece.color, enemyColor);
        if (threats.length < 2) {
          continue;
        }
        const sourcePosition = new ChessPositionDto(8 - row, col + 1);
        threats.forEach(threat => {
          const targetPosition = new ChessPositionDto(8 - threat.pos.row, threat.pos.col + 1);
          forkArrows.push(this.createVisualizationArrow(sourcePosition, targetPosition, 'yellow', 0.25));
        });
      }
    }
    return forkArrows;
  }

  static buildPinArrows(
    board: ChessPieceDto[][][],
    getPinDirections: (piece: ChessPiecesEnum) => Array<{ dr: number; dc: number }>,
    isWithinBoard: (row: number, col: number) => boolean,
    isPinnedToValuablePiece: (pinned: ChessPiecesEnum, protectedPiece: ChessPiecesEnum) => boolean,
    isSkewerPair: (frontPiece: ChessPiecesEnum, rearPiece: ChessPiecesEnum) => boolean
  ): IVisualizationArrow[] {
    const pinArrows: IVisualizationArrow[] = [];
    for (let row = ChessConstants.MIN_INDEX; row <= ChessConstants.MAX_INDEX; row++) {
      for (let col = ChessConstants.MIN_INDEX; col <= ChessConstants.MAX_INDEX; col++) {
        const attackerCell = board[row][col];
        if (!(attackerCell && attackerCell[0])) {
          continue;
        }
        const attackerPiece = attackerCell[0];
        const directions = getPinDirections(attackerPiece.piece);
        if (directions.length < 1) {
          continue;
        }
        directions.forEach(direction => {
          let scanRow = row + direction.dr;
          let scanCol = col + direction.dc;
          let maybePinned: ChessPieceDto | null = null;
          let maybePinnedPos: ChessPositionDto | null = null;
          while (isWithinBoard(scanRow, scanCol)) {
            const targetCell = board[scanRow][scanCol];
            if (!(targetCell && targetCell[0])) {
              scanRow += direction.dr;
              scanCol += direction.dc;
              continue;
            }
            const targetPiece = targetCell[0];
            if (!maybePinned) {
              if (targetPiece.color === attackerPiece.color) {
                break;
              }
              maybePinned = targetPiece;
              maybePinnedPos = new ChessPositionDto(scanRow, scanCol);
              scanRow += direction.dr;
              scanCol += direction.dc;
              continue;
            }
            if (targetPiece.color !== maybePinned.color) {
              break;
            }
            if (isPinnedToValuablePiece(maybePinned.piece, targetPiece.piece)) {
              const attackerFrom = new ChessPositionDto(8 - row, col + 1);
              const pinnedPos = maybePinnedPos as ChessPositionDto;
              const pinnedTo = new ChessPositionDto(8 - pinnedPos.row, pinnedPos.col + 1);
              const protectedFrom = new ChessPositionDto(8 - scanRow, scanCol + 1);
              pinArrows.push(this.createVisualizationArrow(attackerFrom, pinnedTo, 'green', 0.25));
              pinArrows.push(this.createVisualizationArrow(protectedFrom, pinnedTo, 'green', 0.25));
            }
            if (isSkewerPair(maybePinned.piece, targetPiece.piece)) {
              const attackerFrom = new ChessPositionDto(8 - row, col + 1);
              const pinnedPos = maybePinnedPos as ChessPositionDto;
              const frontTo = new ChessPositionDto(8 - pinnedPos.row, pinnedPos.col + 1);
              const rearTo = new ChessPositionDto(8 - scanRow, scanCol + 1);
              pinArrows.push(this.createVisualizationArrow(attackerFrom, frontTo, 'orange', 0.25));
              pinArrows.push(this.createVisualizationArrow(frontTo, rearTo, 'orange', 0.25));
            }
            break;
          }
        });
      }
    }
    return pinArrows;
  }
}
