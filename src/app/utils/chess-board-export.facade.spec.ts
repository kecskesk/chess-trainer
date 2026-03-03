import { ChessBoardExportFacade } from './chess-board-export.facade';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessFenUtils } from './chess-fen.utils';
import { ChessRulesService } from '../services/chess-rules.service';

describe('ChessBoardExportFacade', () => {
  it('returns empty PGN when board state is absent and formatted PGN otherwise', () => {
    expect(ChessBoardExportFacade.getCurrentPgn(false, ['e2-e4'])).toBe('');
    expect(ChessBoardExportFacade.getCurrentPgn(true, ['e2-e4'])).toContain('1. e2-e4');
    expect(ChessBoardExportFacade.getCurrentPgn(true, null as any)).toContain('\n\n*');
  });

  it('returns fallback FEN when board state is missing', () => {
    const fen = ChessBoardExportFacade.getCurrentFen({
      hasBoardState: false,
      board: null,
      turn: null,
      moveHistory: null,
      helperHistory: null
    });
    expect(fen).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
  });

  it('builds FEN using helpers when board state is present', () => {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as any[]));
    spyOn(ChessRulesService, 'getCastlingRightsNotation').and.returnValue('KQkq');
    spyOn(ChessRulesService, 'getEnPassantRightsNotation').and.returnValue('-');
    spyOn(ChessFenUtils, 'getPlyCountFromHistory').and.returnValue(4);
    spyOn(ChessFenUtils, 'getFullmoveNumberFromPlyCount').and.returnValue(3);
    spyOn(ChessFenUtils, 'getHalfmoveClockFromHistory').and.returnValue(1);
    spyOn(ChessFenUtils, 'generateFen').and.returnValue('fen');

    const fen = ChessBoardExportFacade.getCurrentFen({
      hasBoardState: true,
      board,
      turn: ChessColorsEnum.White,
      moveHistory: ['e2-e4'],
      helperHistory: {}
    });

    expect(fen).toBe('fen');

    const fenWithFallbackInputs = ChessBoardExportFacade.getCurrentFen({
      hasBoardState: true,
      board,
      turn: ChessColorsEnum.Black,
      moveHistory: null as any,
      helperHistory: null as any
    });
    expect(fenWithFallbackInputs).toBe('fen');
  });

  it('returns null image when document/window/board shell are unavailable', async () => {
    await expectAsync(ChessBoardExportFacade.createBoardImageDataUrlFromDom({
      getDocumentRef: () => null as any,
      getWindowRef: () => window,
      chessFieldNativeElement: document.createElement('div')
    })).toBeResolvedTo(null);

    await expectAsync(ChessBoardExportFacade.createBoardImageDataUrlFromDom({
      getDocumentRef: () => document,
      getWindowRef: () => null as any,
      chessFieldNativeElement: document.createElement('div')
    })).toBeResolvedTo(null);

    await expectAsync(ChessBoardExportFacade.createBoardImageDataUrlFromDom({
      getDocumentRef: () => document,
      getWindowRef: () => window,
      chessFieldNativeElement: document.createElement('div')
    })).toBeResolvedTo(null);
  });

  it('downloads data url only when document exists', () => {
    expect(() => ChessBoardExportFacade.downloadDataUrl('data:image/png;base64,AA', 'x.png', () => null as any)).not.toThrow();

    const doc = document.implementation.createHTMLDocument('x');
    const clickSpy = jasmine.createSpy('click');
    spyOn(doc, 'createElement').and.callFake(((tag: string) => {
      const el = document.createElement(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    }) as any);

    ChessBoardExportFacade.downloadDataUrl('data:image/png;base64,AA', 'x.png', () => doc);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('handles clipboard availability branches', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const restore = () => {
      if (descriptor) {
        Object.defineProperty(navigator, 'clipboard', descriptor);
      }
    };

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await expectAsync(ChessBoardExportFacade.copyToClipboard('a')).toBeResolvedTo(false);

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: null } });
    await expectAsync(ChessBoardExportFacade.copyToClipboard('a')).toBeResolvedTo(false);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jasmine.createSpy('writeText').and.resolveTo(undefined) }
    });
    await expectAsync(ChessBoardExportFacade.copyToClipboard('a')).toBeResolvedTo(true);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jasmine.createSpy('writeText').and.returnValue(Promise.reject(new Error('x'))) }
    });
    await expectAsync(ChessBoardExportFacade.copyToClipboard('a')).toBeResolvedTo(false);

    restore();
  });
});
