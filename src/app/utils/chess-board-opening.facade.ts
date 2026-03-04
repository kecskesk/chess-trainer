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

export interface IChessBoardOpeningStateAccessors {
  getOpeningsLoaded: () => boolean;
  setOpeningsLoaded: (value: boolean) => void;
  getOpenings: () => IParsedOpening[];
  setOpenings: (value: IParsedOpening[]) => void;
  getActiveOpening: () => IParsedOpening | null;
  setActiveOpening: (value: IParsedOpening | null) => void;
  getActiveOpeningHistoryKey: () => string;
  setActiveOpeningHistoryKey: (value: string) => void;
}

export interface IOpeningAssetLoadParams {
  http: HttpClient;
  locale: string;
  defaultLocale: string;
  loadId: number;
  getCurrentLoadId: () => number;
  state: IChessBoardOpeningStateAccessors;
  onReady: () => void;
}

export class ChessBoardOpeningFacade {
  static normalizeHistorySteps(visibleHistory: string[]): string[] {
    return visibleHistory
      .map(step => ChessBoardOpeningUtils.normalizeNotationToken(step))
      .filter(step => step.length > 0);
  }

  static getRecognitionLabel(
    state: IChessBoardOpeningStateAccessors,
    historySteps: string[]
  ): string {
    const moveCount = historySteps.length;
    if (moveCount < 1) {
      return UiText.recognition.waitingForOpening;
    }
    if (!state.getOpeningsLoaded()) {
      return UiText.recognition.loadingOpenings;
    }
    const activeOpening = state.getActiveOpening();
    if (activeOpening) {
      return ChessBoardOpeningUtils.getDisplayedOpeningName(activeOpening, historySteps);
    }
    return UiText.recognition.noOpeningMatch;
  }

  static resetOpeningState(state: IChessBoardOpeningStateAccessors): void {
    state.setOpeningsLoaded(false);
    state.setOpenings([]);
    state.setActiveOpening(null);
    state.setActiveOpeningHistoryKey('');
  }

  static appendParsedOpenings(state: IChessBoardOpeningStateAccessors, parsedItems: IParsedOpening[]): void {
    if (parsedItems.length < 1) {
      return;
    }
    state.setOpenings([...state.getOpenings(), ...parsedItems]);
  }

  static markOpeningsLoaded(state: IChessBoardOpeningStateAccessors): void {
    state.setOpeningsLoaded(true);
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
    state: IChessBoardOpeningStateAccessors,
    historySteps: string[],
    onDebugText: (debugText: string) => void
  ): void {
    const openings = state.getOpenings();
    if (openings.length < 1) {
      state.setActiveOpening(null);
      return;
    }

    const bestMatchResult = ChessBoardOpeningUtils.findBestOpeningMatch(openings, historySteps);
    const activeOpening = bestMatchResult.opening;
    state.setActiveOpening(activeOpening);
    const historyKey = historySteps.join('|');
    const debugKey = `${historyKey}::${activeOpening ? activeOpening.name : 'none'}`;
    if (activeOpening && debugKey !== state.getActiveOpeningHistoryKey()) {
      state.setActiveOpeningHistoryKey(debugKey);
      onDebugText(
        ChessBoardOpeningUtils.formatOpeningDebugText(
          activeOpening,
          bestMatchResult.baseMatchedDepth,
          historySteps.length,
          historySteps,
          UiText
        )
      );
    }
  }
}
