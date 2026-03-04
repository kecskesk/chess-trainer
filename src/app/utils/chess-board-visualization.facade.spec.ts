import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessBoardVisualizationFacade } from './chess-board-visualization.facade';
import { ChessPositionDto } from '../model/chess-position.dto';

const emptyBoard = (): ChessPieceDto[][][] =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));

describe('ChessBoardVisualizationFacade', () => {
  it('returns empty threats when source cell is empty', () => {
    const board = emptyBoard();
    expect(ChessBoardVisualizationFacade.getThreatsBy(board, 0, 0, ChessColorsEnum.White, ChessColorsEnum.Black)).toEqual([]);
  });

  it('returns empty threats-on when target cell is empty', () => {
    const board = emptyBoard();
    expect(ChessBoardVisualizationFacade.getThreatsOn(board, 0, 0, ChessColorsEnum.Black)).toEqual([]);
  });

  it('builds green overloaded arrows when one protector must defend multiple critical targets', () => {
    const board = emptyBoard();
    board[4][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    board[6][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    board[4][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];

    const getProtectors = (_cellA: ChessPieceDto[], rowAIdx: number, cellAIdx: number) => {
      if ((rowAIdx === 6 && cellAIdx === 3) || (rowAIdx === 4 && cellAIdx === 1)) {
        return [new ChessPositionDto(4, 3)];
      }
      return [];
    };
    const getThreatsOn = (_cell: ChessPieceDto[], rowIdx: number, cellIdx: number) =>
      ((rowIdx === 6 && cellIdx === 3) || (rowIdx === 4 && cellIdx === 1))
        ? [{ pos: new ChessPositionDto(0, 0), piece: ChessPiecesEnum.Rook }]
        : [];

    const arrows = ChessBoardVisualizationFacade.buildProtectedArrows(
      board,
      ChessColorsEnum.White,
      ChessColorsEnum.Black,
      getProtectors,
      getThreatsOn
    );

    expect(arrows.some(arrow => arrow.color === 'green')).toBeTrue();
  });

  it('can mark overloaded protectors even without threat callback', () => {
    const board = emptyBoard();
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    board[4][3] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];
    board[3][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];

    const getProtectors = (_cellA: ChessPieceDto[], rowAIdx: number, cellAIdx: number) => {
      if ((rowAIdx === 4 && cellAIdx === 3) || (rowAIdx === 3 && cellAIdx === 4)) {
        return [new ChessPositionDto(4, 4)];
      }
      return [];
    };

    const arrows = ChessBoardVisualizationFacade.buildProtectedArrows(
      board,
      ChessColorsEnum.White,
      ChessColorsEnum.Black,
      getProtectors
    );

    expect(arrows.some(arrow => arrow.color === 'green')).toBeTrue();
  });
});
