import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChessBoardComponent } from './components/chess-board/chess-board.component';

interface BoardThemeOption {
  id: string;
  label: string;
  light: string;
  dark: string;
}

interface PieceThemeOption {
  id: string;
  label: string;
  white: string;
  black: string;
}

type PieceStyleId = 'font-awesome' | 'sprite-1' | 'ascii';

interface PieceStyleOption {
  id: PieceStyleId;
  label: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
  standalone: true,
  imports: [CommonModule, RouterModule, ChessBoardComponent]
})
export class AppComponent {
  private static readonly STORAGE_KEYS = {
    themeId: 'ct.start.themeId',
    pieceThemeId: 'ct.start.pieceThemeId',
    pieceStyleId: 'ct.start.pieceStyleId',
    squareGapPx: 'ct.start.squareGapPx',
    borderWidthPx: 'ct.start.borderWidthPx'
  } as const;

  readonly feedbackUrl = 'https://forms.gle/vymR8USxXXX6WEN99';
  readonly boardThemeOptions: BoardThemeOption[] = [
    { id: 'classic', label: 'Classic', light: '#f1d9b5', dark: '#b58863' },
    { id: 'ocean', label: 'Ocean', light: '#d7edf9', dark: '#4a7997' },
    { id: 'forest', label: 'Forest', light: '#d8e7d4', dark: '#5d7f5b' },
    { id: 'sandstone', label: 'Sandstone', light: '#f4e8cf', dark: '#8f6a4c' },
    { id: 'graphite', label: 'Graphite', light: '#d6d9df', dark: '#4d5564' },
    { id: 'rosewood', label: 'Rosewood', light: '#f1d6d0', dark: '#7f4a4e' }
  ];
  readonly pieceThemeOptions: PieceThemeOption[] = [
    { id: 'classic', label: 'Classic', white: '#f7f0de', black: '#252a3a' },
    { id: 'pure-contrast', label: 'Pure Black & White', white: '#ffffff', black: '#000000' },
    { id: 'mint-charcoal', label: 'Mint Charcoal', white: '#e2f2ea', black: '#30353e' }
  ];
  readonly pieceStyleOptions: PieceStyleOption[] = [
    { id: 'font-awesome', label: 'Font Awesome' },
    { id: 'sprite-1', label: 'WikiMedia' },
    { id: 'ascii', label: 'ASCII' }
  ];

  isGameStarted = false;
  selectedThemeId = this.boardThemeOptions[0].id;
  selectedPieceThemeId = this.pieceThemeOptions[0].id;
  selectedPieceStyleId: PieceStyleId = this.pieceStyleOptions[0].id;
  squareGapPx = 1;
  borderWidthPx = 1;

  constructor() {
    this.loadSettingsFromStorage();
  }

  get selectedTheme(): BoardThemeOption {
    const matchingTheme = this.boardThemeOptions.find(theme => theme.id === this.selectedThemeId);
    return matchingTheme || this.boardThemeOptions[0];
  }

  get selectedPieceTheme(): PieceThemeOption {
    const matchingTheme = this.pieceThemeOptions.find(theme => theme.id === this.selectedPieceThemeId);
    return matchingTheme || this.pieceThemeOptions[0];
  }

  get selectedPieceStyle(): PieceStyleOption {
    const matchingStyle = this.pieceStyleOptions.find(style => style.id === this.selectedPieceStyleId);
    return matchingStyle || this.pieceStyleOptions[0];
  }

  startGame(): void {
    this.isGameStarted = true;
  }

  changeTheme(themeId: string): void {
    this.selectedThemeId = themeId;
    this.setStorageValue(AppComponent.STORAGE_KEYS.themeId, themeId);
  }

  changePieceTheme(themeId: string): void {
    this.selectedPieceThemeId = themeId;
    this.setStorageValue(AppComponent.STORAGE_KEYS.pieceThemeId, themeId);
  }

  changePieceStyle(styleId: PieceStyleId): void {
    this.selectedPieceStyleId = styleId;
    this.setStorageValue(AppComponent.STORAGE_KEYS.pieceStyleId, styleId);
  }

  setSquareGap(value: number): void {
    const clampedValue = this.clampToRange(value, 0, 4);
    this.squareGapPx = clampedValue;
    this.setStorageValue(AppComponent.STORAGE_KEYS.squareGapPx, String(clampedValue));
  }

  setBorderWidth(value: number): void {
    const clampedValue = this.clampToRange(value, 0, 4);
    this.borderWidthPx = clampedValue;
    this.setStorageValue(AppComponent.STORAGE_KEYS.borderWidthPx, String(clampedValue));
  }

  private loadSettingsFromStorage(): void {
    const savedThemeId = this.getStorageValue(AppComponent.STORAGE_KEYS.themeId);
    if (savedThemeId && this.boardThemeOptions.some(option => option.id === savedThemeId)) {
      this.selectedThemeId = savedThemeId;
    }
    const savedPieceThemeId = this.getStorageValue(AppComponent.STORAGE_KEYS.pieceThemeId);
    if (savedPieceThemeId && this.pieceThemeOptions.some(option => option.id === savedPieceThemeId)) {
      this.selectedPieceThemeId = savedPieceThemeId;
    }
    const savedPieceStyleId = this.getStorageValue(AppComponent.STORAGE_KEYS.pieceStyleId);
    if (savedPieceStyleId && this.pieceStyleOptions.some(option => option.id === savedPieceStyleId)) {
      this.selectedPieceStyleId = savedPieceStyleId as PieceStyleId;
    }

    const savedGap = Number(this.getStorageValue(AppComponent.STORAGE_KEYS.squareGapPx));
    if (!Number.isNaN(savedGap)) {
      this.squareGapPx = this.clampToRange(savedGap, 0, 4);
    }

    const savedBorder = Number(this.getStorageValue(AppComponent.STORAGE_KEYS.borderWidthPx));
    if (!Number.isNaN(savedBorder)) {
      this.borderWidthPx = this.clampToRange(savedBorder, 0, 4);
    }
  }

  private clampToRange(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  private getStorageValue(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private setStorageValue(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage write failures (private mode / blocked storage).
    }
  }
}
