import { ChessFenUtils } from './chess-fen.utils';
import { ChessBoardStateService } from '../services/chess-board-state.service';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

describe('ChessFenUtils', () => {
  it('generates start-position FEN', () => {
    const state = new ChessBoardStateService();
    const fen = ChessFenUtils.generateFen(
      state.field,
      ChessColorsEnum.White,
      'KQkq',
      '-',
      0,
      1
    );

    expect(fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('normalizes castling/en-passant fields', () => {
    const state = new ChessBoardStateService();
    const fen = ChessFenUtils.generateFen(
      state.field,
      ChessColorsEnum.Black,
      'qkq--K',
      'z9',
      4,
      2
    );

    expect(fen).toContain(' b Kkq - 4 2');
  });

  it('extracts move-only ply count from history that includes result suffix', () => {
    const history = [
      'e2-e4',
      'e7-e5',
      'Ng1-f3 1-0 {Black resigns}'
    ];
    expect(ChessFenUtils.getPlyCountFromHistory(history)).toBe(3);
  });

  it('computes halfmove clock and fullmove number from move history', () => {
    const history = ['e2-e4', 'e7-e5', 'Ng1-f3', 'Nb8-c6'];
    expect(ChessFenUtils.getHalfmoveClockFromHistory(history)).toBe(2);
    expect(ChessFenUtils.getFullmoveNumberFromPlyCount(ChessFenUtils.getPlyCountFromHistory(history))).toBe(3);
  });

  it('covers fallback branches for malformed board and zero fullmove input', () => {
    const malformedBoard: ChessPieceDto[][][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => []));
    for (let col = 0; col < 8; col++) {
      malformedBoard[0][col] = [{ color: ChessColorsEnum.White, piece: 'dragon' as ChessPiecesEnum } as ChessPieceDto];
    }
    (malformedBoard[1] as any)[2] = undefined;

    const fen = ChessFenUtils.generateFen(
      malformedBoard,
      ChessColorsEnum.White,
      undefined as any,
      undefined as any,
      -1,
      0
    );
    expect(fen).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
  });

  it('returns valid en-passant square when provided and handles null history entries', () => {
    const state = new ChessBoardStateService();
    const fen = ChessFenUtils.generateFen(
      state.field,
      ChessColorsEnum.White,
      'KQkq',
      'e3',
      ChessFenUtils.getHalfmoveClockFromHistory([null as any, undefined as any, '1-0 {done}']),
      ChessFenUtils.getFullmoveNumberFromPlyCount(ChessFenUtils.getPlyCountFromHistory([null as any, undefined as any, '1-0 {done}']))
    );

    expect(fen).toContain(' w KQkq e3 0 1');
  });

  it('returns empty-board placement when board is missing', () => {
    const fen = ChessFenUtils.generateFen(
      null as any,
      ChessColorsEnum.White,
      'KQkq',
      '-',
      0,
      1
    );
    expect(fen).toBe('8/8/8/8/8/8/8/8 w KQkq - 0 1');
  });

  it('adds pending empty-count before first piece in a row', () => {
    const board: ChessPieceDto[][][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => []));
    board[0][4] = [new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen)];
    const fen = ChessFenUtils.generateFen(board, ChessColorsEnum.White, '-', '-', 0, 1);
    expect(fen.startsWith('4Q3/')).toBeTrue();
  });

  it('treats castling notation as non-pawn move in halfmove clock', () => {
    expect(ChessFenUtils.getHalfmoveClockFromHistory(['O-O'])).toBe(1);
  });
});
