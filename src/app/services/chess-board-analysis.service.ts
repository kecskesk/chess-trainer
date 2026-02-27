import { Injectable } from '@angular/core';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessPositionDto } from '../model/chess-position.dto';
import { ChessRulesService } from './chess-rules.service';
import { GlobalVariablesService } from './global-variables.service';

/**
 * Service for analyzing board positions and piece relationships
 * Consolidates threat detection, protection analysis, and piece evaluation
 */
@Injectable({
  providedIn: 'root'
})
export class ChessBoardAnalysisService {
  private threatCache: Map<string, any> = new Map();
  private cacheEnabled = true;

  /**
   * Gets all pieces of a specific color that can attack a given square
   */
  getThreatsOnSquare(
    targetRow: number,
    targetCol: number,
    targetCell: ChessPieceDto[],
    field: ChessPieceDto[][][],
    byColor: string
  ): Array<{pos: ChessPositionDto, piece: string}> {
    const cacheKey = `threats_${targetRow}_${targetCol}_${byColor}`;

    if (this.cacheEnabled && this.threatCache.has(cacheKey)) {
      return this.threatCache.get(cacheKey);
    }

    const threats: Array<{pos: ChessPositionDto, piece: string}> = [];
    const enemyColor = byColor === 'white' ? 'black' : 'white';

    for (let srcRow = 0; srcRow <= 7; srcRow++) {
      for (let srcCol = 0; srcCol <= 7; srcCol++) {
        const sourceCell = field[srcRow] && field[srcRow][srcCol];

        if (!sourceCell || !sourceCell[0] || sourceCell[0].color !== byColor) {
          continue;
        }

        // Check if this piece can move to target
        const mockTargetCell = targetCell && targetCell[0]
          ? [{ color: enemyColor, piece: targetCell[0].piece }]
          : [];

        const canAttack = ChessRulesService.canStepThere(
          targetRow,
          targetCol,
          mockTargetCell,
          srcRow,
          srcCol,
          sourceCell[0]
        );

        if (canAttack && targetCell && targetCell[0]) {
          threats.push({
            pos: new ChessPositionDto(srcRow, srcCol),
            piece: sourceCell[0].piece
          });
        }
      }
    }

    if (this.cacheEnabled) {
      this.threatCache.set(cacheKey, threats);
    }

    return threats;
  }

  /**
   * Gets all pieces of a color that protect a given piece
   */
  getProtectors(
    targetRow: number,
    targetCol: number,
    protectorColor: string,
    targetPiece: string,
    field: ChessPieceDto[][][]
  ): ChessPositionDto[] {
    const protectors: ChessPositionDto[] = [];
    const enemyColor = protectorColor === 'white' ? 'black' : 'white';

    for (let srcRow = 0; srcRow <= 7; srcRow++) {
      for (let srcCol = 0; srcCol <= 7; srcCol++) {
        // Skip the target square itself
        if (srcRow === targetRow && srcCol === targetCol) {
          continue;
        }

        const sourceCell = field[srcRow] && field[srcRow][srcCol];

        if (!sourceCell || !sourceCell[0] || sourceCell[0].color !== protectorColor) {
          continue;
        }

        // Check if this piece can defend the target
        const canDefend = ChessRulesService.canStepThere(
          targetRow,
          targetCol,
          [{ color: enemyColor, piece: targetPiece }],
          srcRow,
          srcCol,
          sourceCell[0]
        );

        if (canDefend) {
          protectors.push(new ChessPositionDto(srcRow, srcCol));
        }
      }
    }

    return protectors;
  }

  /**
   * Evaluates whether a piece is hanging (unprotected and attacked)
   */
  isHangingPiece(
    row: number,
    col: number,
    pieceColor: string,
    field: ChessPieceDto[][][]
  ): boolean {
    const cell = field[row] && field[row][col];

    if (!cell || !cell[0]) {
      return false;
    }

    const protectors = this.getProtectors(row, col, pieceColor, cell[0].piece, field);

    if (protectors.length > 0) {
      return false; // Protected, not hanging
    }

    const enemyColor = pieceColor === 'white' ? 'black' : 'white';
    const threats = this.getThreatsOnSquare(row, col, cell, field, enemyColor);

    return threats.length > 0; // Has threats and no protection = hanging
  }

  /**
   * Calculates material value difference
   * Useful for evaluating hanging pieces
   */
  getMaterialBalance(field: ChessPieceDto[][][]): { white: number, black: number } {
    const balance = { white: 0, black: 0 };

    field.forEach(row => {
      row.forEach(cell => {
        if (cell && cell[0]) {
          const value = ChessRulesService.valueOfPiece(cell[0].piece);
          if (cell[0].color === 'white') {
            balance.white += value;
          } else {
            balance.black += value;
          }
        }
      });
    });

    return balance;
  }

  /**
   * Gets all possible moves for a piece
   * Uses the existing move validation logic
   */
  getPossibleMoves(
    row: number,
    col: number,
    field: ChessPieceDto[][][]
  ): ChessPositionDto[] {
    const cell = field[row] && field[row][col];

    if (!cell || !cell[0]) {
      return [];
    }

    const possibleMoves: ChessPositionDto[] = [];

    for (let targetRow = 0; targetRow <= 7; targetRow++) {
      for (let targetCol = 0; targetCol <= 7; targetCol++) {
        const targetCell = (field[targetRow] && field[targetRow][targetCol]) || [];

        if (ChessRulesService.canStepThere(
          targetRow,
          targetCol,
          targetCell,
          row,
          col,
          cell[0]
        )) {
          possibleMoves.push(new ChessPositionDto(targetRow, targetCol));
        }
      }
    }

    return possibleMoves;
  }

  /**
   * Clears the threat cache
   * Call after moves that change board state
   */
  clearCache(): void {
    this.threatCache.clear();
  }

  /**
   * Enables or disables caching
   */
  setCachingEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): { size: number, enabled: boolean } {
    return {
      size: this.threatCache.size,
      enabled: this.cacheEnabled
    };
  }
}

