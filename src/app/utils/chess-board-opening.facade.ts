import { HttpClient } from '@angular/common/http';
import { UiText } from '../constants/ui-text.constants';
import { IParsedOpening } from '../model/interfaces/parsed-opening.interface';
import { ChessBoardOpeningUtils } from './chess-board-opening.utils';

export interface IChessBoardOpeningState {
  openingsLoaded: boolean;
  openings: IParsedOpening[];
  activeOpening: IParsedOpening | null;
  activeOpeningHistoryKey: string;
}

export interface IOpeningAssetLoadParams {
  http: HttpClient;
  locale: string;
  defaultLocale: string;
  loadId: number;
  getCurrentLoadId: () => number;
  state: IChessBoardOpeningState;
  onReady: () => void;
}

export class ChessBoardOpeningFacade {
  static normalizeHistorySteps(visibleHistory: string[]): string[] {
    return visibleHistory
      .map(step => ChessBoardOpeningUtils.normalizeNotationToken(step))
      .filter(step => step.length > 0);
  }

  static getRecognitionLabel(
    state: IChessBoardOpeningState,
    historySteps: string[],
    uiText: typeof UiText
  ): string {
    const moveCount = historySteps.length;
    if (moveCount < 1) {
      return uiText.recognition.waitingForOpening;
    }
    if (!state.openingsLoaded) {
      return uiText.recognition.loadingOpenings;
    }
    if (state.activeOpening) {
      return ChessBoardOpeningUtils.getDisplayedOpeningName(state.activeOpening, historySteps);
    }
    return uiText.recognition.noOpeningMatch;
  }

  static resetOpeningState(state: IChessBoardOpeningState): void {
    state.openingsLoaded = false;
    state.openings = [];
    state.activeOpening = null;
    state.activeOpeningHistoryKey = '';
  }

  static appendParsedOpenings(state: IChessBoardOpeningState, parsedItems: IParsedOpening[]): void {
    if (parsedItems.length < 1) {
      return;
    }
    state.openings = [...state.openings, ...parsedItems];
  }

  static markOpeningsLoaded(state: IChessBoardOpeningState): void {
    state.openingsLoaded = true;
  }

  static loadOpeningsFromAssets(params: IOpeningAssetLoadParams): void {
    const {
      http,
      locale,
      defaultLocale,
      loadId,
      getCurrentLoadId,
      state,
      onReady
    } = params;
    this.resetOpeningState(state);
    ChessBoardOpeningUtils.loadOpeningsFromAssets(
      http,
      locale || defaultLocale,
      defaultLocale,
      (parsedItems) => {
        if (loadId !== getCurrentLoadId()) {
          return;
        }
        this.appendParsedOpenings(state, parsedItems);
      },
      () => {
        if (loadId !== getCurrentLoadId()) {
          return;
        }
        this.markOpeningsLoaded(state);
        onReady();
      }
    );
  }

  static updateRecognizedOpeningForHistory(
    state: IChessBoardOpeningState,
    historySteps: string[],
    uiText: typeof UiText,
    naPlaceholder: string,
    onDebugText: (debugText: string) => void
  ): void {
    if (state.openings.length < 1) {
      state.activeOpening = null;
      return;
    }

    const bestMatchResult = ChessBoardOpeningUtils.findBestOpeningMatch(state.openings, historySteps);
    state.activeOpening = bestMatchResult.opening;
    const historyKey = historySteps.join('|');
    const debugKey = `${historyKey}::${state.activeOpening ? state.activeOpening.name : 'none'}`;
    if (state.activeOpening && debugKey !== state.activeOpeningHistoryKey) {
      state.activeOpeningHistoryKey = debugKey;
      onDebugText(
        ChessBoardOpeningUtils.formatOpeningDebugText(
          state.activeOpening,
          bestMatchResult.baseMatchedDepth,
          historySteps.length,
          historySteps,
          uiText,
          naPlaceholder
        )
      );
    }
  }
}
