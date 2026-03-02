import { ChessConstants } from '../constants/chess.constants';
import { ChessPositionDto } from '../model/chess-position.dto';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessRulesService } from '../services/chess-rules.service';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';

export class ChessBoardThreatUtils {
  static getThreatsBy(
    board: ChessPieceDto[][][],
    cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    ofColor: ChessColorsEnum,
    enemyColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
          const targetCell = board[targetRow][targetCol];
          const isEnemyTarget = !!(targetCell && targetCell[0] && targetCell[0].color === enemyColor);
          if (!isEnemyTarget) {
            continue;
          }
          const legalMove = ChessBoardLogicUtils.canPlayLegalMove(
            board,
            rowIdx,
            cellIdx,
            targetRow,
            targetCol,
            ofColor,
            cell[0]
          );
          if (legalMove) {
            threats.push({pos: new ChessPositionDto(targetRow, targetCol), piece: targetCell[0].piece});
          }
        }
      }
    }
    return threats;
  }

  static getThreatsOn(
    board: ChessPieceDto[][][],
    cell: ChessPieceDto[],
    rowIdx: number,
    cellIdx: number,
    _defendedColor: ChessColorsEnum,
    attackerColor: ChessColorsEnum
  ): {pos: ChessPositionDto, piece: ChessPiecesEnum}[] {
    const threats: {pos: ChessPositionDto, piece: ChessPiecesEnum}[] = [];
    for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
      for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
        if (cellIdx !== targetCol || rowIdx !== targetRow) {
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
            threats.push({pos: new ChessPositionDto(targetRow, targetCol), piece: cell[0].piece});
          }
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
    const protectors = [] as ChessPositionDto[];
    board.forEach((rowB, rowBIdx) => {
      rowB.forEach((cellB, cellBIdx) => {
        // All pieces of the color
        if (cellB && cellB[0] && cellB[0].color === ofColor) {
          if (cellAIdx !== cellBIdx || rowAIdx !== rowBIdx) {
            if (ChessRulesService.canStepThere(
              rowAIdx,
              cellAIdx,
              [{ color: enemyColor, piece: cellA[0].piece }],
              rowBIdx,
              cellBIdx,
              { color: ofColor, piece: cellB[0].piece })) {
              protectors.push(new ChessPositionDto(rowBIdx, cellBIdx));
            }
          }
        }
      });
    });
    return protectors;
  }
}

