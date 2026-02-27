import { ChessPiecesEnum } from './chess.pieces';
import { ChessColorsEnum } from './chess.colors';

/**
 * Interface for a chess move
 */
export interface IChessMove {
  /** Source row (0-7, where 0 is top) */
  sourceRow: number;
  /** Source column (0-7, where 0 is left) */
  sourceCol: number;
  /** Target row (0-7) */
  targetRow: number;
  /** Target column (0-7) */
  targetCol: number;
  /** The piece being moved */
  piece: ChessPiecesEnum;
  /** Color of the moving piece */
  color: ChessColorsEnum;
  /** Whether this move is a capture */
  isCapture: boolean;
  /** Whether this move gives check */
  isCheck: boolean;
  /** Whether this is checkmate */
  isCheckmate: boolean;
  /** Whether this is en passant */
  isEnPassant?: boolean;
  /** If castling: 'O-O' or 'O-O-O', otherwise null */
  castleType?: 'O-O' | 'O-O-O' | null;
}

