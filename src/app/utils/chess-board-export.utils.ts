export class ChessBoardExportUtils {
  static getCurrentPgn(history: string[], now: Date = new Date()): string {
    const safeHistory = history || [];
    const result = ChessBoardExportUtils.getPgnResultFromHistory(safeHistory);
    const pgnDate = now.toISOString().slice(0, 10).replace(/-/g, '.');
    const headers = [
      '[Event "Chess Trainer Game"]',
      '[Site "Local"]',
      `[Date "${pgnDate}"]`,
      '[Round "-"]',
      '[White "White"]',
      '[Black "Black"]',
      `[Result "${result}"]`
    ];

    const movePairs: string[] = [];
    for (let index = 0; index < safeHistory.length; index += 2) {
      const moveNumber = Math.floor(index / 2) + 1;
      const whiteMove = (safeHistory[index] || '').trim();
      const blackMove = (safeHistory[index + 1] || '').trim();
      if (!whiteMove && !blackMove) {
        continue;
      }
      let movePair = `${moveNumber}.`;
      if (whiteMove) {
        movePair += ` ${whiteMove}`;
      }
      if (blackMove) {
        movePair += ` ${blackMove}`;
      }
      movePairs.push(movePair);
    }

    const moveSection = movePairs.join(' ').trim();
    const hasExplicitResult = /(?:^|\s)(1-0|0-1|1\/2-1\/2)(?:\s|$)/.test(moveSection);
    const withResult = moveSection
      ? (hasExplicitResult ? moveSection : `${moveSection} ${result}`.trim())
      : result;

    return `${headers.join('\n')}\n\n${withResult}`;
  }

  static getPgnResultFromHistory(history: string[]): '1-0' | '0-1' | '1/2-1/2' | '*' {
    if (!history || history.length < 1) {
      return '*';
    }
    for (let idx = history.length - 1; idx >= 0; idx--) {
      const item = history[idx] || '';
      const resultMatch = item.match(/(?:^|\s)(1-0|0-1|1\/2-1\/2)(?:\s|$)/);
      if (resultMatch && resultMatch[1]) {
        return resultMatch[1] as '1-0' | '0-1' | '1/2-1/2';
      }
    }
    return '*';
  }
}
