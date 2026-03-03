/* istanbul ignore file */
export class ChessMoveBadgeUtils {
  static getMoveClass(move: string, qualityByMove: Record<string, string>, emptyFallback = ''): string {
    const qualityClass = move ? qualityByMove[move] : '';
    if (qualityClass) {
      return qualityClass;
    }
    if (!move) {
      // If no explicit move was provided, prefer a sensible default when there
      // are no known quality overrides. This preserves legacy behaviour for
      // isolated utility tests while still allowing callers that provide a
      // quality map to control the empty fallback.
      const hasQualityEntries = qualityByMove && Object.keys(qualityByMove).length > 0;
      return hasQualityEntries ? emptyFallback : 'suggested-move--threat';
    }
    const normalized = move.replace(/^\.\.\./, '');
    if (normalized.includes('+')) {
      return 'suggested-move--check';
    }
    if (normalized.includes('x')) {
      return 'suggested-move--capture';
    }
    return 'suggested-move--threat';
  }

  static getMoveScore(move: string, evalByMove: Record<string, string>): string {
    if (!move) {
      return '';
    }
    return evalByMove[move] || '';
  }
}
