/**
 * Interface for visualization arrow
 */
export interface IVisualizationArrow {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  color: 'blue' | 'red' | 'yellow' | 'green' | 'gold' | 'cyan' | 'orange';
  intensity: number; // 0-1
  label?: string;
}
