import { Injectable } from '@angular/core';

/**
 * Service for board position validation and error handling
 * Prevents out-of-bounds access and invalid board states
 */
@Injectable({
  providedIn: 'root'
})
export class ChessBoardValidationService {
  private static readonly MIN_BOARD_INDEX = 0;
  private static readonly MAX_BOARD_INDEX = 7;
  private static readonly BOARD_SIZE = 8;

  /**
   * Validates that a row index is within valid chess board bounds
   * @throws Error if row is out of bounds
   */
  validateRowIndex(row: number): void {
    if (!Number.isInteger(row) || row < ChessBoardValidationService.MIN_BOARD_INDEX || row > ChessBoardValidationService.MAX_BOARD_INDEX) {
      throw new Error(`Invalid row index: ${row}. Must be between 0 and 7.`);
    }
  }

  /**
   * Validates that a column index is within valid chess board bounds
   * @throws Error if column is out of bounds
   */
  validateColIndex(col: number): void {
    if (!Number.isInteger(col) || col < ChessBoardValidationService.MIN_BOARD_INDEX || col > ChessBoardValidationService.MAX_BOARD_INDEX) {
      throw new Error(`Invalid column index: ${col}. Must be between 0 and 7.`);
    }
  }

  /**
   * Validates both row and column indices
   * @throws Error if either index is out of bounds
   */
  validateBoardPosition(row: number, col: number): void {
    try {
      this.validateRowIndex(row);
      this.validateColIndex(col);
    } catch (error) {
      throw new Error(`Invalid board position [${row}, ${col}]: ${error.message}`);
    }
  }

  /**
   * Validates that a move is not out of bounds
   * @throws Error if move goes outside the board
   */
  validateMoveIsInBounds(sourceRow: number, sourceCol: number, targetRow: number, targetCol: number): void {
    try {
      this.validateBoardPosition(sourceRow, sourceCol);
      this.validateBoardPosition(targetRow, targetCol);
    } catch (error) {
      throw new Error(`Invalid move from [${sourceRow}, ${sourceCol}] to [${targetRow}, ${targetCol}]: ${error.message}`);
    }
  }

  /**
   * Validates that a board array is properly initialized
   * @throws Error if board is invalid
   */
  validateBoardStructure(field: any[][][]): void {
    if (!Array.isArray(field)) {
      throw new Error('Board field must be an array');
    }
    if (field.length !== ChessBoardValidationService.BOARD_SIZE) {
      throw new Error(`Board must have ${ChessBoardValidationService.BOARD_SIZE} rows, got ${field.length}`);
    }
    for (let i = 0; i < field.length; i++) {
      if (!Array.isArray(field[i]) || field[i].length !== ChessBoardValidationService.BOARD_SIZE) {
        throw new Error(`Row ${i} is invalid. Each row must have ${ChessBoardValidationService.BOARD_SIZE} columns.`);
      }
    }
  }

  /**
   * Safe getter for board cell with validation
   * @returns The cell data or null if empty
   * @throws Error if position is invalid
   */
  getSafeBoardCell(field: any[][][], row: number, col: number): any[] | null {
    try {
      this.validateBoardPosition(row, col);
      const cell = field[row] && field[row][col];
      return cell ? cell : null;
    } catch (error) {
      throw new Error(`Failed to get board cell: ${error.message}`);
    }
  }

  /**
   * Safe setter for board cell with validation
   * @throws Error if position is invalid
   */
  setSafeBoardCell(field: any[][][], row: number, col: number, value: any[]): void {
    try {
      this.validateBoardPosition(row, col);
      field[row][col] = value;
    } catch (error) {
      throw new Error(`Failed to set board cell: ${error.message}`);
    }
  }
}

