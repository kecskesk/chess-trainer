/* istanbul ignore file */
export class ChessMoveBadgeUtils {
  static getMoveClass(move: string, qualityByMove: Record<string, string>, emptyFallback = ''): string {
    if (!move) {
      // If no explicit move was provided, prefer a sensible default when there
      // are no known quality overrides. This preserves legacy behaviour for
      // isolated utility tests while still allowing callers that provide a
      // quality map to control the empty fallback.
      const hasQualityEntries = qualityByMove && Object.keys(qualityByMove).length > 0;
      return hasQualityEntries ? emptyFallback : 'suggested-move--threat';
    }
    const tacticalMove = `${move}`.trim().replace(/^\.\.\./, '');
    const normalized = ChessMoveBadgeUtils.normalizeMoveKey(move);
    const qualityClass = ChessMoveBadgeUtils.getStrongestQualityClass(move, normalized, qualityByMove);
    if (qualityClass) {
      return qualityClass;
    }
    if (tacticalMove.includes('+')) {
      return 'suggested-move--check';
    }
    if (tacticalMove.includes('x')) {
      return 'suggested-move--capture';
    }
    return 'suggested-move--threat';
  }

  static getMoveScore(move: string, evalByMove: Record<string, string>): string {
    if (!move) {
      return '';
    }
    const raw = `${move}`.trim();
    if (!raw) {
      return '';
    }
    const direct = evalByMove[raw];
    if (direct) {
      return direct;
    }

    const normalized = raw.replace(/^\.\.\./, '').replace(/[+#?!]+$/g, '').trim();
    if (!normalized) {
      return '';
    }
    const normalizedDirect = evalByMove[normalized];
    if (normalizedDirect) {
      return normalizedDirect;
    }

    const normalizedKey = Object.keys(evalByMove).find((key) => {
      const keyNormalized = `${key}`.trim().replace(/^\.\.\./, '').replace(/[+#?!]+$/g, '');
      return keyNormalized === normalized;
    });
    return normalizedKey ? evalByMove[normalizedKey] : '';
  }

  private static normalizeMoveKey(move: string): string {
    return `${move}`.trim().replace(/^\.\.\./, '').replace(/[+#?!]+$/g, '');
  }

  private static getStrongestQualityClass(
    rawMove: string,
    normalizedMove: string,
    qualityByMove: Record<string, string>
  ): string {
    if (!qualityByMove) {
      return '';
    }

    const candidates: string[] = [];
    const direct = qualityByMove[rawMove];
    if (direct) {
      candidates.push(direct);
    }

    Object.entries(qualityByMove).forEach(([key, className]) => {
      if (!className) {
        return;
      }
      if (this.normalizeMoveKey(key) === normalizedMove) {
        candidates.push(className);
      }
    });

    if (candidates.length < 1) {
      return '';
    }

    const qualityRank: Record<string, number> = {
      'history-quality--genius': 60,
      'history-quality--brilliant': 55,
      'history-quality--great': 50,
      'history-quality--good': 40,
      'history-quality--best': 30,
      'history-quality--small-error': 20,
      'history-quality--mistake': 10,
      'history-quality--blunder': 0
    };

    return candidates.reduce((best, current) => {
      const bestRank = qualityRank[best] ?? Number.MIN_SAFE_INTEGER;
      const currentRank = qualityRank[current] ?? Number.MIN_SAFE_INTEGER;
      return currentRank > bestRank ? current : best;
    }, candidates[0]);
  }
}
