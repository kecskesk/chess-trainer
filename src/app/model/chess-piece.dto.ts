export class ChessPieceDto {
  color: ChessColors;
  piece: ChessPieces;

  constructor(color: ChessColors, piece: ChessPieces) {
    this.color = color;
    this.piece = piece;
  }
}
