import { ChessColorsEnum } from '../enums/chess-colors.enum';
import { ChessPositionDto } from '../chess-position.dto';
import { ChessPieceDto } from '../chess-piece.dto';

export interface IBoardHelperSnapshot {
  debugText: string;
  history: {[name: string]: string};
  colorTurn: ChessColorsEnum;
  canPromote: number | null;
  justDidEnPassant: ChessPositionDto | null;
  justDidCastle: ChessPositionDto | null;
  gameOver: boolean;
  checkmateColor: ChessColorsEnum | null;
}

export interface IGameplaySnapshot {
  field: ChessPieceDto[][][];
  boardHelper: IBoardHelperSnapshot;
  repetitionCounts: {[positionKey: string]: number};
  trackedHistoryLength: number;
  pendingDrawOfferBy: ChessColorsEnum | null;
  clockStarted: boolean;
  clockRunning: boolean;
  whiteClockMs: number;
  blackClockMs: number;
}
