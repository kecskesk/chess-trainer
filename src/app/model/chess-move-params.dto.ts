import { ChessColorsEnum } from './enums/chess-colors.enum';

export class ChessMoveParamsDto {
  constructor(public targetRow: number,
              public targetCol: number,
              public srcRow: number,
              public srcCol: number,
              public sourceColor: ChessColorsEnum,
              public moveHistory: {[name: string]: string},
              public justLooking = false) {
  }
}
