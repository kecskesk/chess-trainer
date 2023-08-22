import { ChessArrowDto } from './chess-arrow.dto';
import { ChessPositionDto } from './chess-position.dto';

export class ChessBoardHelperDto {
  constructor(public debugText: string,
              public possibles: {[name: string]: ChessPositionDto},
              public hits: {[name: string]: ChessPositionDto},
              public checks: {[name: string]: ChessPositionDto},
              public arrows: {[name: string]: ChessArrowDto},
              public history: {[name: string]: string},
              public colorTurn: 'white' | 'black',
              public canPromote: number,
              public justDidEnPassant: ChessPositionDto,
              public justDidCastle: ChessPositionDto) {
  }
}
