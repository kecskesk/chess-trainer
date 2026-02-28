/**
 * Interface for validation result of a potential move
 */
export interface IMoveValidationResult {
  /** Whether the move is allowed */
  isValid: boolean;
  /** Error message if invalid */
  errorMessage?: string;
  /** Whether the target square is empty */
  isEmptyTarget: boolean;
  /** Whether the target has an enemy piece */
  isEnemyPiece: boolean;
}
