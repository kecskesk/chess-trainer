/**
 * Interface for visualization arrow
 */
export interface IVisualizationArrow {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  color: 'blue' | 'red' | 'yellow' | 'green';
  intensity: number; // 0-1
  label?: string;
}
