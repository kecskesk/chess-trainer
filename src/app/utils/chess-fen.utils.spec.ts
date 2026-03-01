import { ChessFenUtils } from './chess-fen.utils';
import { ChessBoardStateService } from '../services/chess-board-state.service';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';

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
});
