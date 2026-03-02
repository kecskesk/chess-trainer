import { ChessBoardDisplayUtils } from './chess-board-display.utils';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

function emptyBoard(): ChessPieceDto[][][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));
}

describe('ChessBoardDisplayUtils mapping helpers', () => {
  it('maps board index for normal and flipped orientation', () => {
    expect(ChessBoardDisplayUtils.getBoardIndexForDisplay(2, false)).toBe(2);
    expect(ChessBoardDisplayUtils.getBoardIndexForDisplay(2, true)).toBe(5);
  });

  it('maps percent coordinates for display with fallback cases', () => {
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('25%', false)).toBe('25%');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('', true)).toBe('');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('abc', true)).toBe('abc');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('12.5%', true)).toBe('87.5%');
    expect(ChessBoardDisplayUtils.mapPercentCoordinateForDisplay('10%', true)).toBe('90%');
  });

  it('maps rotation values for display with all branches', () => {
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('30deg', false)).toBe('30deg');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('', true)).toBe('');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('bad', true)).toBe('bad');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('390deg', true)).toBe('210deg');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('-300deg', true)).toBe('240deg');
    expect(ChessBoardDisplayUtils.mapRotationForDisplay('540deg', true)).toBe('0deg');
  });

  it('creates visualization arrows with clamped intensity', () => {
    const low = ChessBoardDisplayUtils.createVisualizationArrow(
      { row: 7, col: 1 } as any,
      { row: 6, col: 1 } as any,
      'yellow',
      -1
    );
    expect(low.intensity).toBe(0);

    const high = ChessBoardDisplayUtils.createVisualizationArrow(
      { row: 7, col: 1 } as any,
      { row: 6, col: 1 } as any,
      'yellow',
      5
    );
    expect(high.intensity).toBe(1);

    const mid = ChessBoardDisplayUtils.createVisualizationArrow(
      { row: 7, col: 1 } as any,
      { row: 6, col: 1 } as any,
      'yellow',
      0.5
    );
    expect(mid.intensity).toBe(0.5);
  });

  it('returns pin directions by piece type', () => {
    expect(ChessBoardDisplayUtils.getPinDirections(ChessPiecesEnum.Bishop).length).toBe(4);
    expect(ChessBoardDisplayUtils.getPinDirections(ChessPiecesEnum.Rook).length).toBe(4);
    expect(ChessBoardDisplayUtils.getPinDirections(ChessPiecesEnum.Queen).length).toBe(8);
    expect(ChessBoardDisplayUtils.getPinDirections(ChessPiecesEnum.Knight)).toEqual([]);
  });

  it('evaluates pinned and skewer pairs with edge branches', () => {
    expect(ChessBoardDisplayUtils.isPinnedToValuablePiece(ChessPiecesEnum.King, ChessPiecesEnum.Queen)).toBeFalse();
    expect(ChessBoardDisplayUtils.isPinnedToValuablePiece(ChessPiecesEnum.Pawn, ChessPiecesEnum.King)).toBeTrue();
    expect(ChessBoardDisplayUtils.isPinnedToValuablePiece(ChessPiecesEnum.Queen, ChessPiecesEnum.Rook)).toBeFalse();

    expect(ChessBoardDisplayUtils.isSkewerPair(ChessPiecesEnum.Queen, ChessPiecesEnum.King)).toBeFalse();
    expect(ChessBoardDisplayUtils.isSkewerPair(ChessPiecesEnum.King, ChessPiecesEnum.Queen)).toBeTrue();
    expect(ChessBoardDisplayUtils.isSkewerPair(ChessPiecesEnum.Queen, ChessPiecesEnum.Rook)).toBeTrue();
  });
});

describe('ChessBoardDisplayUtils arrow collection', () => {
  it('collects fork arrows only when a piece threatens at least two targets', () => {
    const board = emptyBoard();
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    board[5][5] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)];

    const arrows = ChessBoardDisplayUtils.collectForkVisualizationArrows(
      board,
      (cell, row, col) => {
        if (!(cell && cell[0] && row === 4 && col === 4)) {
          return [];
        }
        return [
          { pos: { row: 2, col: 3 } as any, piece: ChessPiecesEnum.Queen },
          { pos: { row: 2, col: 5 } as any, piece: ChessPiecesEnum.Rook }
        ];
      }
    );

    expect(arrows.length).toBe(2);
    expect(arrows[0].color).toBe('yellow');
  });

  it('collects pin and skewer arrows across scan branches', () => {
    const board = emptyBoard();
    board[7][7] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    board[6][6] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)];
    board[5][5] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Queen)];

    board[4][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    board[4][2] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Queen)];
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];

    board[2][2] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    board[1][1] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn)];

    const arrows = ChessBoardDisplayUtils.collectPinVisualizationArrows(
      board,
      (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8,
      ChessBoardDisplayUtils.isPinnedToValuablePiece,
      ChessBoardDisplayUtils.isSkewerPair
    );

    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows.some(arrow => arrow.color === 'green')).toBeTrue();
    expect(arrows.some(arrow => arrow.color === 'orange')).toBeTrue();
  });

  it('breaks pin scan when rear piece has opposite color to pinned piece', () => {
    const board = emptyBoard();
    board[0][0] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook)];
    board[0][2] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop)];
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];

    const arrows = ChessBoardDisplayUtils.collectPinVisualizationArrows(
      board,
      (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8,
      ChessBoardDisplayUtils.isPinnedToValuablePiece,
      ChessBoardDisplayUtils.isSkewerPair
    );

    expect(arrows).toEqual([]);
  });
});
