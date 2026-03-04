import { ChessBoardInitializationUtils } from './chess-board-initialization.utils';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

describe('ChessBoardInitializationUtils', () => {
  it('creates the standard initial board layout', () => {
    const field = ChessBoardInitializationUtils.createInitialField();
    expect(field.length).toBe(8);
    expect(field[0][4][0].piece).toBe(ChessPiecesEnum.King);
    expect(field[0][4][0].color).toBe(ChessColorsEnum.Black);
    expect(field[7][4][0].piece).toBe(ChessPiecesEnum.King);
    expect(field[7][4][0].color).toBe(ChessColorsEnum.White);
    expect(field[3][3]).toEqual([]);
  });

  it('builds ambient style values from internal random helper', () => {
    spyOn(ChessBoardInitializationUtils, 'randomBetween').and.returnValue(7.5);
    const style = ChessBoardInitializationUtils.randomizeAmbientStyle();
    expect(style['--blob1-x']).toBe('7.5%');
    expect(style['--wobble-a']).toBe('7.5s');
    expect(Object.keys(style).length).toBeGreaterThan(0);
  });

  it('generates bounded random values with 2 decimals', () => {
    const value = ChessBoardInitializationUtils.randomBetween(1, 2);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(2);
    expect(Number(value.toFixed(2))).toBe(value);
  });
});
