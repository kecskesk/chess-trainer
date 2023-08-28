export class ChessPieceDto {
  color: ChessColorDto;
  piece: string;

  constructor(color: ChessColorDto, piece: string) {
    this.color = color;
    this.piece = piece;
  }
}
