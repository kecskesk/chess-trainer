import { ChessBoardExportUtils } from './chess-board-export.utils';

describe('ChessBoardExportUtils', () => {
  it('builds PGN and appends result when move section has no explicit result', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-03-02T00:00:00.000Z'));
    const pgn = ChessBoardExportUtils.getCurrentPgn(['e2-e4', 'e7-e5']);
    expect(pgn).toContain('[Date "2026.03.02"]');
    expect(pgn).toContain('\n\n1. e2-e4 e7-e5 *');
    jasmine.clock().uninstall();
  });

  it('keeps explicit result and supports sparse history rows', () => {
    const pgn = ChessBoardExportUtils.getCurrentPgn(['e2-e4', '', '', '... 0-1']);
    expect(pgn).toContain('\n\n1. e2-e4 2. ... 0-1');
  });

  it('extracts result from history and falls back to unknown', () => {
    expect(ChessBoardExportUtils.getPgnResultFromHistory(['a4', 'axb5 1/2-1/2'])).toBe('1/2-1/2');
    expect(ChessBoardExportUtils.getPgnResultFromHistory([])).toBe('*');
    expect(ChessBoardExportUtils.getPgnResultFromHistory([undefined as any])).toBe('*');
    expect(ChessBoardExportUtils.getCurrentPgn(null as any)).toContain('\n\n*');
  });
});
