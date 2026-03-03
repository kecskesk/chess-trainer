export class ChessMoveBadgeUtils {
  static getMoveClass(move: string, qualityByMove: Record<string, string>, emptyFallback = ''): string {
    const qualityClass = move ? qualityByMove[move] : '';
    if (qualityClass) {
      return qualityClass;
    }
    if (!move) {
      return emptyFallback;
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
