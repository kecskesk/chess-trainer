import { ChessBoardLanguageToolsComponent } from './chess-board-language-tools.component';

describe('ChessBoardLanguageToolsComponent', () => {
  let component: ChessBoardLanguageToolsComponent;

  beforeEach(() => {
    component = new ChessBoardLanguageToolsComponent();
  });

  it('emits selected locale when locale button action is triggered', () => {
    const emitSpy = spyOn(component.localeChange, 'emit');

    component.onLocaleClick('hu_HU');

    expect(emitSpy).toHaveBeenCalledWith('hu_HU');
  });
});