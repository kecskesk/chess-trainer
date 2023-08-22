export class ChessMoveParamsDto {
  constructor(public targetRow: number,
              public targetCol: number,
              public srcRow: number,
              public srcCol: number,
              public sourceColor: string,
              public moveHistory: {[name: string]: string}) {
  }
}
