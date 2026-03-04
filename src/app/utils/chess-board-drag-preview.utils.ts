import { ChessConstants } from '../constants/chess.constants';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';

export class ChessBoardDragPreviewUtils {
  static collectMateInOneTargets(
    board: ChessPieceDto[][][],
    attackerColor: ChessColorsEnum,
    defenderColor: ChessColorsEnum
  ): {[key: string]: boolean} {
    const targets: {[key: string]: boolean} = {};
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === attackerColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
          for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }
            
            const canMove = ChessBoardLogicUtils.canPlayLegalMove(
              board,
              srcRow,
              srcCol,
              targetRow,
              targetCol,
              attackerColor,
              sourcePiece
            );
            if (!canMove) {
              continue;
            }

            const afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);
            
            const attackerInCheck = ChessBoardLogicUtils.isKingInCheck(afterMove, attackerColor);
            if (attackerInCheck) {
              continue;
            }

            const defenderInCheck = ChessBoardLogicUtils.isKingInCheck(afterMove, defenderColor);
            if (!defenderInCheck) {
              continue;
            }

            const defenderHasResponse = ChessBoardLogicUtils.hasAnyLegalMove(afterMove, defenderColor);
            if (!defenderHasResponse) {
              targets[`${targetRow}${targetCol}`] = true;
            }
          }
        }
      }
    }
    return targets;
  }

  static previewHoverMateInOne(
    board: ChessPieceDto[][][],
    srcRow: number,
    srcCol: number,
    targetRow: number,
    targetCol: number,
    isValidMove: boolean,
    colorTurn: ChessColorsEnum
  ): { mateInOneTargets: {[key: string]: boolean}, mateInOneBlunderTargets: {[key: string]: boolean}, lastMatePreviewKey: string } {
    if (!isValidMove) {
      return { mateInOneTargets: {}, mateInOneBlunderTargets: {}, lastMatePreviewKey: '' };
    }

    const previewKey = `${srcRow}${srcCol}-${targetRow}${targetCol}`;
    
    const sourceCell = board[srcRow][srcCol];
    const forColor = sourceCell && sourceCell[0]
      ? sourceCell[0].color
      : colorTurn;
    const enemyColor = forColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    
    const afterMove = ChessBoardLogicUtils.simulateMove(board, srcRow, srcCol, targetRow, targetCol);

    const currentSideInCheck = ChessBoardLogicUtils.isKingInCheck(afterMove, forColor);
    if (currentSideInCheck) {
      return { mateInOneTargets: {}, mateInOneBlunderTargets: {}, lastMatePreviewKey: previewKey };
    }

    const enemyInCheck = ChessBoardLogicUtils.isKingInCheck(afterMove, enemyColor);
    const enemyHasResponse = ChessBoardLogicUtils.hasAnyLegalMove(afterMove, enemyColor);
    
    const mateInOneTargets: {[key: string]: boolean} = {};
    const mateInOneBlunderTargets: {[key: string]: boolean} = {};
    
    if (enemyInCheck && !enemyHasResponse) {
      mateInOneTargets[`${targetRow}${targetCol}`] = true;
    }

    const enemyMateInOneTargets = ChessBoardDragPreviewUtils.collectMateInOneTargets(
      afterMove,
      enemyColor,
      forColor
    );
    if (Object.keys(enemyMateInOneTargets).length > 0) {
      mateInOneBlunderTargets[`${targetRow}${targetCol}`] = true;
    }

    return { mateInOneTargets, mateInOneBlunderTargets, lastMatePreviewKey: previewKey };
  }
}

