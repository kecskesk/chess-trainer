import { ChessColorsEnum } from './chess.colors';

export class ChessMoveParamsDto {
  constructor(public targetRow: number,
              public targetCol: number,
              public srcRow: number,
              public srcCol: number,
              public sourceColor: ChessColorsEnum,
              public moveHistory: {[name: string]: string}) {
  }
}
