/**
 * Interface for board position highlighting
 */
export interface IBoardHighlight {
  row: number;
  col: number;
  type: 'possible' | 'capture' | 'check';
}
