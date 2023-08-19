export class ChessPieceDto {
  color: string;
  piece: string;

  constructor(color: string, piece: string) {
    this.color = color;
    this.piece = piece;
  }
}
