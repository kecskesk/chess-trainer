import { ChessBoardUiConstants } from '../constants/chess.constants';

export class ChessBoardStorageService {
  static readDebugPanelOpenState(storageKey: string): boolean {
    try {
      return localStorage.getItem(storageKey) === ChessBoardUiConstants.STORAGE_OPEN;
    } catch {
      return false;
    }
  }

  static persistDebugPanelOpenState(storageKey: string, isOpen: boolean): void {
    try {
      localStorage.setItem(storageKey, isOpen ? ChessBoardUiConstants.STORAGE_OPEN : ChessBoardUiConstants.STORAGE_CLOSED);
    } catch {
      return;
    }
  }
}
