import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessBoardSuggestionFacade } from './chess-board-suggestion.facade';
import { ChessBoardInitializationUtils } from './chess-board-initialization.utils';
import { ChessBoardGridComponent } from '../components/chess-board-grid/chess-board-grid.component';

const emptyBoard = (): ChessPieceDto[][][] =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as ChessPieceDto[]));

describe('ChessBoardSuggestionFacade', () => {
  it('uses built-in square parser in formatUciMoveForDisplay when parser is omitted', () => {
    const board = emptyBoard();
    board[7][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King)];
    expect(ChessBoardSuggestionFacade.formatUciMoveForDisplay('e1e2', board)).toBe('Ke2');
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

describe('Coverage extras', () => {
  it('covers classifySuggestionLoss branches', () => {
    expect(ChessBoardSuggestionFacade.classifySuggestionLoss(0.05)).toBe('history-quality--genius');
    expect(ChessBoardSuggestionFacade.classifySuggestionLoss(0.2)).toBe('history-quality--great');
    expect(ChessBoardSuggestionFacade.classifySuggestionLoss(0.5)).toBe('history-quality--good');
    expect(ChessBoardSuggestionFacade.classifySuggestionLoss(1.0)).toBe('history-quality--small-error');
    expect(ChessBoardSuggestionFacade.classifySuggestionLoss(2.0)).toBe('history-quality--mistake');
    expect(ChessBoardSuggestionFacade.classifySuggestionLoss(3.0)).toBe('history-quality--blunder');
  });

  it('formats UCI moves for pawn and piece cases and rejects invalid input', () => {
    const field = ChessBoardInitializationUtils.createInitialField();
    // e2 pawn (white) -> e4
    const res1 = ChessBoardSuggestionFacade.formatUciMoveForDisplay('e2e4', field);
    expect(res1).toBe('e4');

    // place a black pawn at e4 to make it a capture
    field[4][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn } as any];
    const res2 = ChessBoardSuggestionFacade.formatUciMoveForDisplay('e2e4', field);
    expect(res2).toContain('x');

    // invalid UCI -> empty
    expect(ChessBoardSuggestionFacade.formatUciMoveForDisplay('invalid', field)).toBe('');
  });

  it('parses algebraic squares and resolves display-to-uci mapping', () => {
    expect(ChessBoardSuggestionFacade.parseSquareToCoords('a1')).toEqual({ row: 7, col: 0 });
    expect(ChessBoardSuggestionFacade.parseSquareToCoords('z9')).toBeNull();

    const map = ChessBoardSuggestionFacade.buildDisplayToUciMap({
      topMovesUci: ['e2e4', 'g1f3'],
      topMovesDisplay: ['e4', 'Nf3'],
      cctMoves: ['d4'],
      resolveMoveToUci: (m: string) => (m === 'd4' ? 'd2d4' : null)
    });
    expect(map.get('e4')).toBe('e2e4');
    expect(map.get('Nf3')).toBe('g1f3');
    expect(map.get('d4')).toBe('d2d4');
  });

  it('covers early return in cctMoves.forEach callback when move is already present', () => {
    const map = ChessBoardSuggestionFacade.buildDisplayToUciMap({
      topMovesUci: ['e2e4'],
      topMovesDisplay: ['e4'],
      cctMoves: ['e4', 'd4'],
      resolveMoveToUci: (m: string) => (m === 'd4' ? 'd2d4' : null)
    });
    expect(map.get('e4')).toBe('e2e4');
    expect(map.get('d4')).toBe('d2d4');
  });

  it('evaluateUciMovesForQuality returns early on runToken mismatch and handles missing engine', async () => {
    const result1 = await ChessBoardSuggestionFacade.evaluateUciMovesForQuality({
      runToken: 1,
      getCurrentRunToken: () => 2,
      fen: 'fen',
      uniqueUciMoves: ['e2e4'],
      suggestedMovesDepth: 1,
      analysisClampPawns: 10
    } as any);
    expect(result1.pawnsByUci.size).toBe(0);

    const result2 = await ChessBoardSuggestionFacade.evaluateUciMovesForQuality({
      runToken: 1,
      getCurrentRunToken: () => 1,
      fen: 'fen',
      uniqueUciMoves: ['e2e4'],
      suggestedMovesDepth: 1,
      analysisClampPawns: 10
    } as any);
    expect(result2.pawnsByUci.size).toBe(0);
  });

  it('exercises ChessBoardGridComponent display helpers', () => {
    const grid = new ChessBoardGridComponent();
    grid.previewMode = true;
    grid.previewPreset = 'piece-colors';
    grid.renderedBoardRows = [0, 1];
    grid.renderedBoardCols = [0, 1];
    grid.field = ChessBoardInitializationUtils.createInitialField();

    const cell = grid.getDisplayCell(0, 0);
    expect(Array.isArray(cell)).toBeTrue();
    expect(grid.getDisplayPiece(0, 0)).toBeDefined();
    expect(typeof grid.getDisplayFieldId(0, 0)).toBe('string');
    expect(typeof grid.getDisplayNotation(0, 0)).toBe('string');
    expect(typeof grid.getDisplaySquareHighlightClass(0, 0)).toBe('string');
  });
});

