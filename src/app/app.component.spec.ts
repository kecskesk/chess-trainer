import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the app component instance', () => {
    const component = new AppComponent();
    expect(component).toBeTruthy();
  });

  it('starts with defaults and can start game', () => {
    spyOn(Storage.prototype, 'getItem').and.returnValue(null);
    const component = new AppComponent();
    expect(component.isGameStarted).toBeFalse();
    expect(component.selectedThemeId).toBe('classic');
    expect(component.selectedPieceThemeId).toBe('classic');
    expect(component.squareGapPx).toBe(0);
    expect(component.borderWidthPx).toBe(0);

    component.startGame();
    expect(component.isGameStarted).toBeTrue();
  });

  it('reads selected theme and piece theme with fallback', () => {
    const component = new AppComponent();
    component.selectedThemeId = 'ocean';
    component.selectedPieceThemeId = 'mint-charcoal';
    expect(component.selectedTheme.id).toBe('ocean');
    expect(component.selectedPieceTheme.id).toBe('mint-charcoal');

    component.selectedThemeId = 'missing-theme';
    component.selectedPieceThemeId = 'missing-piece';
    expect(component.selectedTheme.id).toBe('classic');
    expect(component.selectedPieceTheme.id).toBe('classic');
  });

  it('persists selected theme and piece theme', () => {
    const setItemSpy = spyOn(Storage.prototype, 'setItem').and.callThrough();
    const component = new AppComponent();

    component.changeTheme('forest');
    component.changePieceTheme('pure-contrast');

    expect(component.selectedThemeId).toBe('forest');
    expect(component.selectedPieceThemeId).toBe('pure-contrast');
    expect(setItemSpy).toHaveBeenCalledWith('ct.start.themeId', 'forest');
    expect(setItemSpy).toHaveBeenCalledWith('ct.start.pieceThemeId', 'pure-contrast');
  });

  it('clamps and persists spacing controls', () => {
    const setItemSpy = spyOn(Storage.prototype, 'setItem').and.callThrough();
    const component = new AppComponent();

    component.setSquareGap(-3);
    expect(component.squareGapPx).toBe(0);
    component.setSquareGap(9);
    expect(component.squareGapPx).toBe(4);
    component.setSquareGap(2.6);
    expect(component.squareGapPx).toBe(3);

    component.setBorderWidth(-5);
    expect(component.borderWidthPx).toBe(0);
    component.setBorderWidth(9);
    expect(component.borderWidthPx).toBe(4);
    component.setBorderWidth(1.6);
    expect(component.borderWidthPx).toBe(2);

    expect(setItemSpy).toHaveBeenCalledWith('ct.start.squareGapPx', '3');
    expect(setItemSpy).toHaveBeenCalledWith('ct.start.borderWidthPx', '2');
  });
});

describe('AppComponent storage loading and failures', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads valid settings from localStorage', () => {
    const getItemSpy = spyOn(Storage.prototype, 'getItem').and.callFake((key: string) => {
      const values: Record<string, string> = {
        'ct.start.themeId': 'rosewood',
        'ct.start.pieceThemeId': 'pure-contrast',
        'ct.start.squareGapPx': '4',
        'ct.start.borderWidthPx': '0'
      };
      return values[key] ?? null;
    });

    const component = new AppComponent();

    expect(component.selectedThemeId).toBe('rosewood');
    expect(component.selectedPieceThemeId).toBe('pure-contrast');
    expect(component.squareGapPx).toBe(4);
    expect(component.borderWidthPx).toBe(0);
    expect(getItemSpy).toHaveBeenCalled();
  });

  it('ignores invalid storage values', () => {
    spyOn(Storage.prototype, 'getItem').and.callFake((key: string) => {
      const values: Record<string, string> = {
        'ct.start.themeId': 'missing',
        'ct.start.pieceThemeId': 'missing',
        'ct.start.squareGapPx': 'nan',
        'ct.start.borderWidthPx': 'nope'
      };
      return values[key] ?? null;
    });

    const component = new AppComponent();

    expect(component.selectedThemeId).toBe('classic');
    expect(component.selectedPieceThemeId).toBe('classic');
    expect(component.squareGapPx).toBe(1);
    expect(component.borderWidthPx).toBe(1);
  });

  it('handles storage read and write failures gracefully', () => {
    const getItemSpy = spyOn(Storage.prototype, 'getItem').and.throwError('read blocked');
    const component = new AppComponent();
    expect(component.selectedThemeId).toBe('classic');
    expect(component.selectedPieceThemeId).toBe('classic');
    expect(getItemSpy).toHaveBeenCalled();

    const setItemSpy = spyOn(Storage.prototype, 'setItem').and.throwError('write blocked');
    expect(() => component.changeTheme('graphite')).not.toThrow();
    expect(() => component.changePieceTheme('mint-charcoal')).not.toThrow();
    expect(() => component.setSquareGap(2)).not.toThrow();
    expect(() => component.setBorderWidth(3)).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
  });
});
