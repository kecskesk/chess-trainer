import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardVisualizationFacade } from './chess-board-visualization.facade';

const emptyBoard = (): ChessPieceDto[][][] =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));

describe('ChessBoardVisualizationFacade', () => {
  it('returns empty threats when source cell is empty', () => {
    const board = emptyBoard();
    const canPlayLegalMove = jasmine.createSpy('canPlayLegalMove').and.returnValue(false);
    expect(ChessBoardVisualizationFacade.getThreatsBy(board, 0, 0, ChessColorsEnum.White, ChessColorsEnum.Black, canPlayLegalMove)).toEqual([]);
    expect(canPlayLegalMove).not.toHaveBeenCalled();
  });

  it('returns empty threats-on when target cell is empty', () => {
    const board = emptyBoard();
    const canPlayLegalMove = jasmine.createSpy('canPlayLegalMove').and.returnValue(false);
    expect(ChessBoardVisualizationFacade.getThreatsOn(board, 0, 0, ChessColorsEnum.Black, canPlayLegalMove)).toEqual([]);
    expect(canPlayLegalMove).not.toHaveBeenCalled();
  });
});
