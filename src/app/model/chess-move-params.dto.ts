export class ChessMoveParamsDto {
  constructor(public targetRow: number,
              public targetCol: number,
              public srcRow: number,
              public srcCol: number,
              public sourceColor: ChessColors,
              public moveHistory: {[name: string]: string}) {
  }
}
