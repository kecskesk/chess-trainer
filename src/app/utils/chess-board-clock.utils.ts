export class ChessBoardClockUtils {
  static formatClock(clockMs: number): string {
    const totalMs = Math.max(0, Math.floor(clockMs));
    const totalSeconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((totalMs % 1000) / 100);
    if (minutes >= 1) {
      return `${ChessBoardClockUtils.padToTwo(minutes)}:${ChessBoardClockUtils.padToTwo(seconds)}`;
    }
    return `${ChessBoardClockUtils.padToTwo(minutes)}:${ChessBoardClockUtils.padToTwo(seconds)}.${tenths}`;
  }

  static padToTwo(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}
