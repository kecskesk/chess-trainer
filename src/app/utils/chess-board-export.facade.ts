import html2canvas from 'html2canvas';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessRulesService } from '../services/chess-rules.service';
import { ChessFenUtils } from './chess-fen.utils';
import { ChessBoardExportUtils } from './chess-board-export.utils';

export class ChessBoardExportFacade {
  private static readonly EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

  static getCurrentPgn(hasBoardState: boolean, history: string[]): string {
    if (!hasBoardState) {
      return '';
    }
    return ChessBoardExportUtils.getCurrentPgn(history || []);
  }

  static getCurrentFen(params: {
    hasBoardState: boolean;
    board: ChessPieceDto[][][] | null | undefined;
    turn: ChessColorsEnum | null | undefined;
    moveHistory: string[] | null | undefined;
    helperHistory: Record<string, string> | null | undefined;
  }): string {
    if (!params.hasBoardState || !params.board || !params.turn) {
      return ChessBoardExportFacade.EMPTY_FEN;
    }

    const castlingRights = ChessRulesService.getCastlingRightsNotation(params.board, params.helperHistory || {});
    const enPassantRights = ChessRulesService.getEnPassantRightsNotation(
      params.board,
      params.helperHistory || {},
      params.turn
    );
    const plyCount = ChessFenUtils.getPlyCountFromHistory(params.moveHistory || []);
    const fullmoveNumber = ChessFenUtils.getFullmoveNumberFromPlyCount(plyCount);
    const halfmoveClock = ChessFenUtils.getHalfmoveClockFromHistory(params.moveHistory || []);

    return ChessFenUtils.generateFen(
      params.board,
      params.turn,
      castlingRights,
      enPassantRights,
      halfmoveClock,
      fullmoveNumber
    );
  }

  static async createBoardImageDataUrlFromDom(params: {
    chessFieldNativeElement: HTMLElement | null | undefined;
  }): Promise<string | null> {
    const doc = ChessBoardExportFacade.getDocument();
    const win = ChessBoardExportFacade.getWindow();
    if (!doc || !win) {
      return null;
    }

    const boardElement = params.chessFieldNativeElement?.closest('.board-shell') as HTMLElement | null;
    if (!boardElement) {
      return null;
    }

    try {
      const deviceScale = Math.max(1, Math.ceil(win.devicePixelRatio || 1));
      const canvas = await html2canvas(boardElement, {
        backgroundColor: null,
        scale: deviceScale,
        useCORS: true,
        logging: false
      });
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  static downloadDataUrl(dataUrl: string, fileName: string): void {
    const doc = ChessBoardExportFacade.getDocument();
    if (!doc) {
      return;
    }
    const link = doc.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.rel = 'noopener';
    doc.body.appendChild(link);
    link.click();
    doc.body.removeChild(link);
  }

  static copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      return Promise.resolve(false);
    }
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }

  static getImageDebugText(readyText: string, now: Date): string {
    return `${readyText} (${now.toLocaleTimeString()})`;
  }

  static getImageFileName(now: Date): string {
    return `chess-board-${now.toISOString().replace(/[:.]/g, '-')}.png`;
  }

  private static getDocument(): Document | null {
    return document;
  }

  private static getWindow(): Window | null {
    return window;
  }
}

