import { ChessBoardUtils, ChessMoveNotation } from './chess-utils';

describe('ChessBoardUtils', () => {
  it('converts algebraic notation both ways', () => {
    expect(ChessBoardUtils.toAlgebraic(7, 0)).toBe('a1');
    expect(ChessBoardUtils.fromAlgebraic('e4')).toEqual({ row: 4, col: 4 });
  });

  it('returns null for invalid algebraic strings', () => {
    expect(ChessBoardUtils.fromAlgebraic('e')).toBeNull();
    expect(ChessBoardUtils.fromAlgebraic('i4')).toBeNull();
    expect(ChessBoardUtils.fromAlgebraic('a9')).toBeNull();
  });

  it('checks board bounds', () => {
    expect(ChessBoardUtils.isInBounds(0, 0)).toBeTrue();
    expect(ChessBoardUtils.isInBounds(7, 7)).toBeTrue();
    expect(ChessBoardUtils.isInBounds(-1, 0)).toBeFalse();
    expect(ChessBoardUtils.isInBounds(0, 8)).toBeFalse();
  });

  it('calculates movement distances', () => {
    expect(ChessBoardUtils.getDistance(6, 4, 4, 5)).toEqual({
      rowDelta: 2,
      colDelta: 1,
      maxDelta: 2
    });
  });

  it('checks diagonal, file, and rank alignment', () => {
    expect(ChessBoardUtils.isOnSameDiagonal(7, 2, 5, 4)).toBeTrue();
    expect(ChessBoardUtils.isOnSameDiagonal(7, 2, 7, 2)).toBeFalse();
    expect(ChessBoardUtils.isOnSameDiagonal(7, 2, 6, 4)).toBeFalse();

    expect(ChessBoardUtils.isOnSameFile(3, 3)).toBeTrue();
    expect(ChessBoardUtils.isOnSameFile(3, 4)).toBeFalse();

    expect(ChessBoardUtils.isOnSameRank(5, 5)).toBeTrue();
    expect(ChessBoardUtils.isOnSameRank(5, 4)).toBeFalse();
  });

  it('returns direction vector between two squares', () => {
    expect(ChessBoardUtils.getDirection(6, 4, 4, 4)).toEqual({ rowDir: -1, colDir: 0 });
    expect(ChessBoardUtils.getDirection(4, 4, 5, 6)).toEqual({ rowDir: 1, colDir: 1 });
    expect(ChessBoardUtils.getDirection(4, 4, 4, 2)).toEqual({ rowDir: 0, colDir: -1 });
  });

  it('returns correct square color', () => {
    expect(ChessBoardUtils.getSquareColor(0, 0)).toBe('light');
    expect(ChessBoardUtils.getSquareColor(0, 1)).toBe('dark');
  });

  it('checks whether piece is at starting position', () => {
    expect(ChessBoardUtils.isAtStartingPosition(6, 4, 'pawn', 'white')).toBeTrue();
    expect(ChessBoardUtils.isAtStartingPosition(1, 3, 'pawn', 'black')).toBeTrue();
    expect(ChessBoardUtils.isAtStartingPosition(4, 4, 'pawn', 'white')).toBeFalse();
    expect(ChessBoardUtils.isAtStartingPosition(0, 0, 'dragon', 'white')).toBeFalse();
  });

  it('returns squares between source and target', () => {
    expect(ChessBoardUtils.getSquaresBetween(7, 0, 7, 3)).toEqual([
      { row: 7, col: 1 },
      { row: 7, col: 2 }
    ]);
    expect(ChessBoardUtils.getSquaresBetween(7, 0, 4, 3)).toEqual([
      { row: 6, col: 1 },
      { row: 5, col: 2 }
    ]);
    expect(ChessBoardUtils.getSquaresBetween(7, 0, 4, 0)).toEqual([
      { row: 6, col: 0 },
      { row: 5, col: 0 }
    ]);
  });
});

describe('ChessMoveNotation', () => {
  it('converts move to long algebraic notation', () => {
    expect(ChessMoveNotation.toLongAlgebraic(6, 4, 4, 4)).toBe('e2e4');
  });

  it('validates long notation and contrast-checks against short notation', () => {
    expect(ChessMoveNotation.isValidLongNotation('e2e4')).toBeTrue();
    expect(ChessMoveNotation.isValidLongNotation('e7e8=Q+')).toBeTrue();
    expect(ChessMoveNotation.isValidLongNotation('Nb1-c3')).toBeTrue();
    expect(ChessMoveNotation.isValidLongNotation('Ne2-e4+')).toBeTrue();
    expect(ChessMoveNotation.isValidLongNotation('O-O-O+')).toBeTrue();

    expect(ChessMoveNotation.isValidLongNotation('Nf3')).toBeFalse();
    expect(ChessMoveNotation.isValidLongNotation('exd8=Q#')).toBeFalse();
    expect(ChessMoveNotation.isValidLongNotation('Nbd7xe8=Q#')).toBeFalse();

    expect(ChessMoveNotation.isValidShortNotation('Nb1-c3')).toBeFalse();
    expect(ChessMoveNotation.isValidShortNotation('Ne2-e4+')).toBeFalse();
  });

  it('validates short notation and contrast-checks against long notation', () => {
    expect(ChessMoveNotation.isValidShortNotation('Nf3')).toBeTrue();
    expect(ChessMoveNotation.isValidShortNotation('Qh5+')).toBeTrue();
    expect(ChessMoveNotation.isValidShortNotation('exd8=Q#')).toBeTrue();
    expect(ChessMoveNotation.isValidShortNotation('O-O')).toBeTrue();

    expect(ChessMoveNotation.isValidShortNotation('e2e4')).toBeFalse();
    expect(ChessMoveNotation.isValidShortNotation('Nb1-c3')).toBeFalse();
    expect(ChessMoveNotation.isValidShortNotation('Nbd7xe8=Q#')).toBeFalse();
  });

  it('supports umbrella algebraic validator', () => {
    expect(ChessMoveNotation.isValidAlgebraic('e2e4')).toBeTrue();
    expect(ChessMoveNotation.isValidAlgebraic('Nf3')).toBeTrue();
    expect(ChessMoveNotation.isValidAlgebraic('O-O')).toBeTrue();
    expect(ChessMoveNotation.isValidAlgebraic('Nbd7xe8=Q#')).toBeFalse();
    expect(ChessMoveNotation.isValidAlgebraic('invalid')).toBeFalse();
    expect(ChessMoveNotation.isValidAlgebraic('O-O-O-O')).toBeFalse();
  });

  it('extracts promotion piece when present', () => {
    expect(ChessMoveNotation.getPromotionPiece('e7e8=Q')).toBe('queen');
    expect(ChessMoveNotation.getPromotionPiece('a2a1=N+')).toBe('knight');
    expect(ChessMoveNotation.getPromotionPiece('e2e4')).toBeNull();
  });

  it('detects check and checkmate suffixes', () => {
    expect(ChessMoveNotation.isCheck('Qh5+')).toBeTrue();
    expect(ChessMoveNotation.isCheck('Qh5')).toBeFalse();
    expect(ChessMoveNotation.isCheckmate('Qh7#')).toBeTrue();
    expect(ChessMoveNotation.isCheckmate('Qh7+')).toBeFalse();
  });
});
