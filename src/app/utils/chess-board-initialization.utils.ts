import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

export class ChessBoardInitializationUtils {
  static createInitialField(): ChessPieceDto[][][] {
    return [
      [
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Queen)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)]
      ],
      [
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)]
      ],
      [[], [], [], [], [], [], [], []],
      [[], [], [], [], [], [], [], []],
      [[], [], [], [], [], [], [], []],
      [[], [], [], [], [], [], [], []],
      [
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)]
      ],
      [
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)],
        [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)]
      ]
    ];
  }

  static randomizeAmbientStyle(randomBetween: (min: number, max: number) => number): {[key: string]: string} {
    return {
      '--blob1-x': `${randomBetween(28, 42)}%`,
      '--blob1-y': `${randomBetween(24, 40)}%`,
      '--blob1-r': `${randomBetween(7, 11)}%`,
      '--blob2-x': `${randomBetween(58, 72)}%`,
      '--blob2-y': `${randomBetween(24, 40)}%`,
      '--blob2-r': `${randomBetween(7, 12)}%`,
      '--blob3-x': `${randomBetween(40, 60)}%`,
      '--blob3-y': `${randomBetween(52, 68)}%`,
      '--blob3-r': `${randomBetween(6, 10)}%`,
      '--blob4-x': `${randomBetween(30, 46)}%`,
      '--blob4-y': `${randomBetween(58, 78)}%`,
      '--blob4-r': `${randomBetween(7, 11)}%`,
      '--blob5-x': `${randomBetween(54, 70)}%`,
      '--blob5-y': `${randomBetween(58, 78)}%`,
      '--blob5-r': `${randomBetween(6, 10)}%`,
      '--wobble-a': `${randomBetween(5.8, 8.4)}s`,
      '--wobble-b': `${randomBetween(7.6, 11.2)}s`
    };
  }

  static randomBetween(min: number, max: number): number {
    return Number((Math.random() * (max - min) + min).toFixed(2));
  }
}
