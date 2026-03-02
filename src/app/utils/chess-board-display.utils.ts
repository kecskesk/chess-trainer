import { ChessConstants } from '../constants/chess.constants';
import { ChessPositionDto } from '../model/chess-position.dto';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { IVisualizationArrow } from '../model/interfaces/visualization-arrow.interface';
import { ChessRulesService } from '../services/chess-rules.service';

export class ChessBoardDisplayUtils {
  static getBoardIndexForDisplay(displayIndex: number, isBoardFlipped: boolean): number {
    return isBoardFlipped ? ChessConstants.BOARD_SIZE - 1 - displayIndex : displayIndex;
  }

  static mapPercentCoordinateForDisplay(value: string, isBoardFlipped: boolean): string {
    if (!isBoardFlipped || !value) {
      return value;
    }
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)%$/);
    if (!match) {
      return value;
    }
    const parsed = Number(match[1]);
    return `${Number((100 - parsed).toFixed(4))}%`;
  }

  static mapRotationForDisplay(value: string, isBoardFlipped: boolean): string {
    if (!isBoardFlipped || !value) {
      return value;
    }
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (!match) {
      return value;
    }
    const parsed = Number(match[1]);
    let rotated = parsed + 180;
    while (rotated >= 360) {
      rotated -= 360;
    }
    while (rotated < 0) {
      rotated += 360;
    }
    return `${Number(rotated.toFixed(4))}deg`;
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

  static collectForkVisualizationArrows(
    board: ChessPieceDto[][][],
    getThreatsBy: (
      cell: ChessPieceDto[],
      rowIdx: number,
      cellIdx: number,
      ofColor: ChessColorsEnum,
      enemyColor: ChessColorsEnum
    ) => {pos: ChessPositionDto, piece: ChessPiecesEnum}[]
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
          forkArrows.push(ChessBoardDisplayUtils.createVisualizationArrow(sourcePosition, targetPosition, 'yellow', 0.25));
        });
      }
    }
    return forkArrows;
  }

  static getPinDirections(piece: ChessPiecesEnum): Array<{dr: number, dc: number}> {
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

  static isPinnedToValuablePiece(pinned: ChessPiecesEnum, protectedPiece: ChessPiecesEnum): boolean {
    if (pinned === ChessPiecesEnum.King) {
      return false;
    }
    if (protectedPiece === ChessPiecesEnum.King) {
      return true;
    }
    return ChessRulesService.valueOfPiece(protectedPiece) > ChessRulesService.valueOfPiece(pinned);
  }

  static isSkewerPair(frontPiece: ChessPiecesEnum, rearPiece: ChessPiecesEnum): boolean {
    if (rearPiece === ChessPiecesEnum.King) {
      return false;
    }
    if (frontPiece === ChessPiecesEnum.King) {
      return true;
    }
    return ChessRulesService.valueOfPiece(frontPiece) > ChessRulesService.valueOfPiece(rearPiece);
  }

  static collectPinVisualizationArrows(
    board: ChessPieceDto[][][],
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
        const directions = ChessBoardDisplayUtils.getPinDirections(attackerPiece.piece);
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
              pinArrows.push(ChessBoardDisplayUtils.createVisualizationArrow(attackerFrom, pinnedTo, 'green', 0.25));
              pinArrows.push(ChessBoardDisplayUtils.createVisualizationArrow(protectedFrom, pinnedTo, 'green', 0.25));
            }

            if (isSkewerPair(maybePinned.piece, targetPiece.piece)) {
              const attackerFrom = new ChessPositionDto(8 - row, col + 1);
              const pinnedPos = maybePinnedPos as ChessPositionDto;
              const frontTo = new ChessPositionDto(8 - pinnedPos.row, pinnedPos.col + 1);
              const rearTo = new ChessPositionDto(8 - scanRow, scanCol + 1);
              pinArrows.push(ChessBoardDisplayUtils.createVisualizationArrow(attackerFrom, frontTo, 'orange', 0.25));
              pinArrows.push(ChessBoardDisplayUtils.createVisualizationArrow(frontTo, rearTo, 'orange', 0.25));
            }
            break;
          }
        });
      }
    }

    return pinArrows;
  }
}
