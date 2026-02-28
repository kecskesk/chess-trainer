import { of, throwError } from 'rxjs';
import { UiTextLoaderService } from './ui-text-loader.service';
import { UiText, mergeUiText, resetUiText } from '../constants/ui-text.constants';

const initialUiTextSnapshot = JSON.parse(JSON.stringify(UiText));

let httpGetSpy: jasmine.Spy;
let service: UiTextLoaderService;

const createService = (): UiTextLoaderService => {
  httpGetSpy = jasmine.createSpy('get');
  return new UiTextLoaderService({ get: httpGetSpy } as any);
};

const setupUiTextLoaderServiceSuite = (): void => {
  beforeEach(() => {
    resetUiText();
    localStorage.removeItem('chess-trainer.locale');
    service = createService();
    spyOn(console, 'error');
  });

  afterEach(() => {
    resetUiText();
    mergeUiText(initialUiTextSnapshot as any);
    localStorage.removeItem('chess-trainer.locale');
  });
};

describe('UiTextLoaderService loading and locale selection', () => {
  setupUiTextLoaderServiceSuite();

  it('loads default locale and parses nested/object/array keys', async () => {
    httpGetSpy.and.returnValue(of(
      [
        '# comment',
        '! skipped',
        'status.white=White',
        'status.black=Black',
        'infoOverlay.items.0=Roadmap',
        'infoOverlay.items.1=CCT',
        'message.checkmateCallout=Checkmate\\!',
        'escaped.value=one\\ntwo\\rthree\\tfour\\:\\=\\\\',
        'coverageArray.0.label=ok',
        'coverageMatrix.0.1=ok2',
        'coverageNoDelimiterKey',
        '=ignored'
      ].join('\n')
    ));

    await service.load();

    expect(httpGetSpy).toHaveBeenCalledWith('assets/i18n/en_US.properties', { responseType: 'text' });
    expect(service.getCurrentLocale()).toBe('en_US');
    expect(localStorage.getItem('chess-trainer.locale')).toBe('en_US');
    expect(UiText.status.white).toBe('White');
    expect(UiText.status.black).toBe('Black');
    expect(UiText.infoOverlay.items).toEqual(['Roadmap', 'CCT']);
    expect((UiText as any).coverageArray[0].label).toBe('ok');
    expect((UiText as any).coverageMatrix[0][1]).toBe('ok2');
    expect((UiText as any).coverageNoDelimiterKey).toBe('');
    expect((UiText as any).escaped.value).toBe('one\ntwo\rthree\tfour:=\\');
  });

  it('normalizes unsupported locale to default and handles setActiveLocale', async () => {
    httpGetSpy.and.returnValue(of('status.white=White'));

    await service.setActiveLocale('xx_XX');

    expect(httpGetSpy).toHaveBeenCalledWith('assets/i18n/en_US.properties', { responseType: 'text' });
    expect(service.getCurrentLocale()).toBe('en_US');
  });

  it('initializes from persisted locale', async () => {
    localStorage.setItem('chess-trainer.locale', 'hu_HU');
    httpGetSpy.and.returnValue(of('status.white=Feher'));

    await service.initialize();

    expect(httpGetSpy).toHaveBeenCalledWith('assets/i18n/hu_HU.properties', { responseType: 'text' });
    expect(service.getCurrentLocale()).toBe('hu_HU');
  });

  it('falls back to browser locale when storage is empty', async () => {
    const browserLanguageSpy = spyOnProperty(navigator, 'language', 'get').and.returnValue('hu-HU');
    httpGetSpy.and.returnValue(of('status.white=Feher'));

    await service.initialize();

    expect(browserLanguageSpy).toHaveBeenCalled();
    expect(httpGetSpy).toHaveBeenCalledWith('assets/i18n/hu_HU.properties', { responseType: 'text' });
  });

  it('returns default locale when browser locale is missing or non-hungarian', () => {
    const browserLanguageSpy = spyOnProperty(navigator, 'language', 'get').and.returnValue('');
    spyOn<any>(service, 'readPersistedLocale').and.returnValue(null);

    const resolved = (service as any).resolveInitialLocale();
    expect(resolved).toBe(UiTextLoaderService.DEFAULT_LOCALE);
    expect(browserLanguageSpy).toHaveBeenCalled();
  });
});

describe('UiTextLoaderService error and persistence handling', () => {
  setupUiTextLoaderServiceSuite();

  it('falls back to default locale after non-default load error', async () => {
    httpGetSpy.and.callFake((path: string) => {
      if (path.includes('hu_HU')) {
        return throwError(() => new Error('missing hu'));
      }
      return of('status.white=White');
    });

    await service.load('hu_HU');

    expect((console.error as jasmine.Spy).calls.count()).toBe(1);
    expect(httpGetSpy.calls.allArgs()).toEqual([
      ['assets/i18n/hu_HU.properties', { responseType: 'text' }],
      ['assets/i18n/en_US.properties', { responseType: 'text' }]
    ]);
    expect(service.getCurrentLocale()).toBe('en_US');
  });

  it('handles default-locale load error without recursive reload', async () => {
    httpGetSpy.and.returnValue(throwError(() => new Error('missing en')));

    await service.load('en_US');

    expect(httpGetSpy.calls.count()).toBe(1);
    expect((console.error as jasmine.Spy).calls.count()).toBe(1);
  });

  it('returns null when reading locale throws and ignores persist errors', () => {
    const getItemSpy = spyOn(localStorage, 'getItem').and.throwError('blocked');
    const setItemSpy = spyOn(localStorage, 'setItem').and.throwError('blocked');

    expect((service as any).readPersistedLocale()).toBeNull();
    expect(() => (service as any).persistLocale('en_US')).not.toThrow();
    expect(getItemSpy).toHaveBeenCalled();
    expect(setItemSpy).toHaveBeenCalled();
  });
});

describe('UiTextLoaderService parser helpers', () => {
  setupUiTextLoaderServiceSuite();

  it('covers delimiter detection and helper methods', () => {
    expect((service as any).findDelimiterIndex('a=b')).toBe(1);
    expect((service as any).findDelimiterIndex('a\\=b:c')).toBe(4);
    expect((service as any).findDelimiterIndex('no-delimiter')).toBe(-1);
    expect((service as any).isArrayIndex('0')).toBeTrue();
    expect((service as any).isArrayIndex('x')).toBeFalse();
    expect((service as any).isArrayIndex(undefined)).toBeFalse();
    expect((service as any).unescape('x\\ny\\rz\\t\\:\\=\\\\')).toBe('x\ny\rz\t:=\\');
  });
});
