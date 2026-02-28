import { UiText, mergeUiText, resetUiText } from './ui-text.constants';

const initialUiTextSnapshot = JSON.parse(JSON.stringify(UiText));

describe('ui-text.constants', () => {
  afterEach(() => {
    resetUiText();
    mergeUiText(initialUiTextSnapshot as any);
  });

  it('merges nested values and arrays', () => {
    mergeUiText({
      status: { white: 'White', black: 'Black' },
      infoOverlay: { items: ['a', 'b'] },
      language: { english: 'English' }
    } as any);

    expect(UiText.status.white).toBe('White');
    expect(UiText.status.black).toBe('Black');
    expect(UiText.language.english).toBe('English');
    expect(UiText.infoOverlay.items).toEqual(['a', 'b']);
  });

  it('replaces incompatible target types and resets back to defaults', () => {
    mergeUiText({
      app: 'not-an-object',
      recognition: { loadingOpenings: 'Loading...' },
      message: { checkmateWinner: 'wins.' }
    } as any);

    mergeUiText({
      app: { brandTitle: 'Ne Chess Fel!' }
    } as any);

    expect(UiText.app.brandTitle).toBe('Ne Chess Fel!');
    expect(UiText.recognition.loadingOpenings).toBe('Loading...');
    expect(UiText.message.checkmateWinner).toBe('wins.');

    resetUiText();
    expect(UiText.app.brandTitle).toBe('');
    expect(UiText.recognition.loadingOpenings).toBe('');
    expect(UiText.message.checkmateWinner).toBe('');
  });
});
