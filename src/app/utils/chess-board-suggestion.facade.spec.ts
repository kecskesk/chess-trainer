import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessBoardSuggestionFacade } from './chess-board-suggestion.facade';

const emptyBoard = (): ChessPieceDto[][][] =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));

describe('ChessBoardSuggestionFacade', () => {
  it('uses built-in square parser in formatUciMoveForDisplay when parser is omitted', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    expect(ChessBoardSuggestionFacade.formatUciMoveForDisplay('e1e2', board)).toBe('Ke2');
  });

  it('uses provided square parser in formatUciMoveForDisplay', () => {
    const board = emptyBoard();
    board[7][6] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    const parser = (sq: string) => (sq === 'g1' ? { row: 7, col: 6 } : sq === 'f3' ? { row: 5, col: 5 } : null);
    expect(ChessBoardSuggestionFacade.formatUciMoveForDisplay('g1f3', board, parser)).toBe('Nf3');
  });

  it('uses built-in square parser in resolveMoveToUci when parser is omitted', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    expect(
      ChessBoardSuggestionFacade.resolveMoveToUci({
        move: 'Ke2',
        board,
        turnColor: ChessColorsEnum.White
      })
    ).toBe('e1e2');
  });

  it('uses provided square parser in resolveMoveToUci', () => {
    const board = emptyBoard();
    board[7][6] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight)];
    const parser = (sq: string) => (sq === 'f3' ? { row: 5, col: 5 } : null);
    expect(
      ChessBoardSuggestionFacade.resolveMoveToUci({
        move: 'Nf3',
        board,
        turnColor: ChessColorsEnum.White,
        parseSquareToCoords: parser
      })
    ).toBe('g1f3');
  });
});
