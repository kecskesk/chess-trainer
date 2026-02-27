import { ChessColorsEnum } from './chess.colors';
import { ChessPiecesEnum } from './chess.pieces';

export class ChessPieceDto {
  color: ChessColorsEnum;
  piece: ChessPiecesEnum;

  constructor(color: ChessColorsEnum, piece: ChessPiecesEnum) {
    this.color = color;
    this.piece = piece;
  }
}
