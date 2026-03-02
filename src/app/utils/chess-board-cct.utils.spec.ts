import { ChessBoardCctUtils } from './chess-board-cct.utils';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

function emptyBoard(): ChessPieceDto[][][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));
}

describe('ChessBoardCctUtils', () => {
  it('parses suggested moves and handles invalid notation', () => {
    expect(ChessBoardCctUtils.parseSuggestedMove('...Nf3+')).toEqual({
      piece: ChessPiecesEnum.Knight,
      targetRow: 5,
      targetCol: 5
    });
    expect(ChessBoardCctUtils.parseSuggestedMove('Qh5?!')).toEqual({
      piece: ChessPiecesEnum.Queen,
      targetRow: 3,
      targetCol: 7
    });
    expect(ChessBoardCctUtils.parseSuggestedMove('e4')).toEqual({
      piece: ChessPiecesEnum.Pawn,
      targetRow: 4,
      targetCol: 4
    });
    expect(ChessBoardCctUtils.parseSuggestedMove('invalid')).toBeNull();
  });

  it('deduplicates and sorts top recommendations by score', () => {
    const picked = ChessBoardCctUtils.pickTopRecommendations([
      { move: 'Qh5+', tooltip: 'a', score: 1 },
      { move: 'Qh5+', tooltip: 'better', score: 3 },
      { move: 'Nf3', tooltip: 'b', score: 2 },
      { move: 'Bc4', tooltip: 'c', score: 8 },
      { move: 'd4', tooltip: 'd', score: 6 }
    ]);

    expect(picked.length).toBe(3);
    expect(picked[0].move).toBe('Bc4');
    expect(picked.some(item => item.tooltip === 'better')).toBeTrue();
  });

  it('collects threatened enemy pieces from a moved piece', () => {
    const board = emptyBoard();
    board[4][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    board[3][4] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn)];
    board[4][6] = [new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook)];
    board[6][6] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop)];

    const threatened = ChessBoardCctUtils.getThreatenedEnemyPiecesByMovedPiece(
      board,
      4,
      4,
      ChessColorsEnum.White,
      ChessColorsEnum.Black,
      (targetRow, targetCol) => (targetRow === 3 && targetCol === 4) || (targetRow === 4 && targetCol === 6)
    );
    expect(threatened).toEqual([ChessPiecesEnum.Pawn, ChessPiecesEnum.Rook]);

    expect(
      ChessBoardCctUtils.getThreatenedEnemyPiecesByMovedPiece(
        board,
        0,
        0,
        ChessColorsEnum.White,
        ChessColorsEnum.Black,
        () => true
      )
    ).toEqual([]);
  });

  it('formats cct move notation and algebraic helpers', () => {
    expect(ChessBoardCctUtils.formatCctMove(ChessPiecesEnum.Pawn, 6, 4, 4, 4, false, false)).toBe('e4');
    expect(ChessBoardCctUtils.formatCctMove(ChessPiecesEnum.Pawn, 6, 4, 5, 5, true, false)).toBe('exf3');
    expect(ChessBoardCctUtils.formatCctMove(ChessPiecesEnum.Knight, 7, 1, 5, 2, false, true)).toBe('Nc3+');

    expect(ChessBoardCctUtils.toAlgebraicSquare(7, 0)).toBe('a1');
    expect(ChessBoardCctUtils.pieceNotation(ChessPiecesEnum.King)).toBe('K');
    expect(ChessBoardCctUtils.pieceNotation(ChessPiecesEnum.Rook)).toBe('R');
    expect(ChessBoardCctUtils.pieceNotation(ChessPiecesEnum.Pawn)).toBe('');
    expect(ChessBoardCctUtils.pieceName(ChessPiecesEnum.Bishop)).toBe('bishop');
    expect(ChessBoardCctUtils.pieceName(ChessPiecesEnum.Pawn)).toBe('pawn');
  });
});
