import { ChessArrowDto } from './chess-arrow.dto';
import { ChessColorsEnum } from './enums/chess-colors.enum';
import { ChessPositionDto } from './chess-position.dto';

export class ChessBoardHelperDto {
  constructor(public debugText: string,
              public possibles: {[name: string]: ChessPositionDto},
              public hits: {[name: string]: ChessPositionDto},
              public checks: {[name: string]: ChessPositionDto},
              public arrows: {[name: string]: ChessArrowDto},
              public history: {[name: string]: string},
              public colorTurn: ChessColorsEnum,
              public canPromote: number,
              public justDidEnPassant: ChessPositionDto,
              public justDidCastle: ChessPositionDto,
              public gameOver: boolean = false,
              public checkmateColor: ChessColorsEnum = null) {
  }
}
