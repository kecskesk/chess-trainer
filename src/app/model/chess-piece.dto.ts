import { ChessColorsEnum } from './enums/chess-colors.enum';
import { ChessPiecesEnum } from './enums/chess-pieces.enum';

export class ChessPieceDto {
  color: ChessColorsEnum;
  piece: ChessPiecesEnum;

  constructor(color: ChessColorsEnum, piece: ChessPiecesEnum) {
    this.color = color;
    this.piece = piece;
  }
}
