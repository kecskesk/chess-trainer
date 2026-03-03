import { UiText } from '../constants/ui-text.constants';
import { ChessBoardOpeningFacade, IChessBoardOpeningState } from './chess-board-opening.facade';

describe('ChessBoardOpeningFacade', () => {
  it('keeps state unchanged when appendParsedOpenings is called with empty list', () => {
    const state: IChessBoardOpeningState = {
      openingsLoaded: false,
      openings: [],
      activeOpening: null,
      activeOpeningHistoryKey: ''
    };

    ChessBoardOpeningFacade.appendParsedOpenings(state, []);

    expect(state.openings).toEqual([]);
  });

  it('returns waiting recognition label when history is empty', () => {
    const state: IChessBoardOpeningState = {
      openingsLoaded: true,
      openings: [],
      activeOpening: null,
      activeOpeningHistoryKey: ''
    };
    expect(ChessBoardOpeningFacade.getRecognitionLabel(state, [], UiText)).toBe(UiText.recognition.waitingForOpening);
  });
});
