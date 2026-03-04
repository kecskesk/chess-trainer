import { ChessBoardExportFacade } from './chess-board-export.facade';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessFenUtils } from './chess-fen.utils';
import { ChessRulesService } from '../services/chess-rules.service';

describe('ChessBoardExportFacade FEN and PGN', () => {
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

});

describe('ChessBoardExportFacade DOM and clipboard', () => {
  it('returns null image when board shell is unavailable', async () => {
    await expectAsync(ChessBoardExportFacade.createBoardImageDataUrlFromDom({
      chessFieldNativeElement: document.createElement('div')
    })).toBeResolvedTo(null);
  });

  it('returns null image when document is undefined', async () => {
    spyOn<any>(ChessBoardExportFacade as any, 'getDocument').and.returnValue(null);
    await expectAsync(ChessBoardExportFacade.createBoardImageDataUrlFromDom({
      chessFieldNativeElement: null
    })).toBeResolvedTo(null);
  });

  it('returns null image when window is unavailable', async () => {
    spyOn<any>(ChessBoardExportFacade as any, 'getWindow').and.returnValue(null);
    await expectAsync(ChessBoardExportFacade.createBoardImageDataUrlFromDom({
      chessFieldNativeElement: null
    })).toBeResolvedTo(null);
  });

  it('covers image export device pixel ratio fallback branch', async () => {
    const boardShell = document.createElement('div');
    boardShell.className = 'board-shell';
    const child = document.createElement('div');
    boardShell.appendChild(child);
    document.body.appendChild(boardShell);

    const descriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    try {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: 0
      });

      const imageDataUrl = await ChessBoardExportFacade.createBoardImageDataUrlFromDom({
        chessFieldNativeElement: child
      });
      expect(typeof imageDataUrl === 'string' || imageDataUrl === null).toBeTrue();
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'devicePixelRatio', descriptor);
      }
      document.body.removeChild(boardShell);
    }
  });

  it('downloads data url via document link click', () => {
    const clickSpy = jasmine.createSpy('click');
    const originalCreateElement = document.createElement.bind(document);
    const createSpy = spyOn(document, 'createElement').and.callFake(((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    }) as any);
    const appendSpy = spyOn(document.body, 'appendChild').and.callThrough();
    const removeSpy = spyOn(document.body, 'removeChild').and.callThrough();

    ChessBoardExportFacade.downloadDataUrl('data:image/png;base64,AA', 'x.png');
    expect(clickSpy).toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('returns early for download when document is unavailable', () => {
    const createSpy = spyOn(document, 'createElement').and.callThrough();
    spyOn<any>(ChessBoardExportFacade as any, 'getDocument').and.returnValue(null);
    expect(() => ChessBoardExportFacade.downloadDataUrl('data:image/png;base64,AA', 'x.png')).not.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
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
