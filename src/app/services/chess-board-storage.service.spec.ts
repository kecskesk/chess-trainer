import { ChessBoardStorageService } from './chess-board-storage.service';
import { ChessBoardUiConstants } from '../constants/chess.constants';

describe('ChessBoardStorageService', () => {
  it('reads debug panel state and handles storage errors', () => {
    localStorage.setItem('debug', ChessBoardUiConstants.STORAGE_OPEN);
    expect(ChessBoardStorageService.readDebugPanelOpenState('debug')).toBeTrue();

    const getSpy = spyOn(localStorage, 'getItem').and.throwError('denied');
    expect(ChessBoardStorageService.readDebugPanelOpenState('debug')).toBeFalse();
    getSpy.and.callThrough();
  });

  it('persists debug panel state and handles storage errors', () => {
    ChessBoardStorageService.persistDebugPanelOpenState('debug', true);
    expect(localStorage.getItem('debug')).toBe(ChessBoardUiConstants.STORAGE_OPEN);

    const setSpy = spyOn(localStorage, 'setItem').and.throwError('denied');
    expect(() => ChessBoardStorageService.persistDebugPanelOpenState('debug', false)).not.toThrow();
    setSpy.and.callThrough();
  });
});
