import { UiText } from '../constants/ui-text.constants';
import { ChessBoardOpeningFacade, IChessBoardOpeningState, IChessBoardOpeningStateAccessors } from './chess-board-opening.facade';

function buildAccessors(state: IChessBoardOpeningState): IChessBoardOpeningStateAccessors {
  return {
    getOpeningsLoaded: () => state.openingsLoaded,
    setOpeningsLoaded: (value) => { state.openingsLoaded = value; },
    getOpenings: () => state.openings,
    setOpenings: (value) => { state.openings = value; },
    getActiveOpening: () => state.activeOpening,
    setActiveOpening: (value) => { state.activeOpening = value; },
    getActiveOpeningHistoryKey: () => state.activeOpeningHistoryKey,
    setActiveOpeningHistoryKey: (value) => { state.activeOpeningHistoryKey = value; }
  };
}

describe('ChessBoardOpeningFacade', () => {
  it('keeps state unchanged when appendParsedOpenings is called with empty list', () => {
    const state: IChessBoardOpeningState = {
      openingsLoaded: false,
      openings: [],
      activeOpening: null,
      activeOpeningHistoryKey: ''
    };

    ChessBoardOpeningFacade.appendParsedOpenings(buildAccessors(state), []);

    expect(state.openings).toEqual([]);
  });

  it('returns waiting recognition label when history is empty', () => {
    const state: IChessBoardOpeningState = {
      openingsLoaded: true,
      openings: [],
      activeOpening: null,
      activeOpeningHistoryKey: ''
    };
    expect(ChessBoardOpeningFacade.getRecognitionLabel(buildAccessors(state), [], UiText))
      .toBe(UiText.recognition.waitingForOpening);
  });
});
