import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { mergeUiText, resetUiText } from '../constants/ui-text.constants';

type PropertyTree = Record<string, unknown>;

@Injectable({
  providedIn: 'root'
})
export class UiTextLoaderService {
  static readonly DEFAULT_LOCALE = 'en_US';
  static readonly SUPPORTED_LOCALES = ['en_US', 'hu_HU'] as const;
  private readonly localeStorageKey = 'chess-trainer.locale';
  private currentLocale = UiTextLoaderService.DEFAULT_LOCALE;

  constructor(private readonly http: HttpClient) {}

  async initialize(): Promise<void> {
    const initialLocale = this.resolveInitialLocale();
    await this.load(initialLocale);
  }

  getCurrentLocale(): string {
    return this.currentLocale;
  }

  async setActiveLocale(locale: string): Promise<void> {
    await this.load(locale);
  }

  async load(locale: string = UiTextLoaderService.DEFAULT_LOCALE): Promise<void> {
    const normalizedLocale = this.normalizeLocale(locale);
    const path = `assets/i18n/${normalizedLocale}.properties`;
    try {
      const content = await firstValueFrom(this.http.get(path, { responseType: 'text' }));
      const parsed = this.parseProperties(content);
      resetUiText();
      mergeUiText(parsed);
      this.currentLocale = normalizedLocale;
      this.persistLocale(normalizedLocale);
    } catch (error) {
      console.error(`Failed to load UI text properties from ${path}.`, error);
      if (normalizedLocale !== UiTextLoaderService.DEFAULT_LOCALE) {
        await this.load(UiTextLoaderService.DEFAULT_LOCALE);
      }
    }
  }

  private resolveInitialLocale(): string {
    const storedLocale = this.readPersistedLocale();
    if (storedLocale) {
      return storedLocale;
    }

    const browserLocale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : '';
    if (browserLocale.toLowerCase().startsWith('hu')) {
      return 'hu_HU';
    }
    return UiTextLoaderService.DEFAULT_LOCALE;
  }

  private normalizeLocale(locale: string): string {
    return UiTextLoaderService.SUPPORTED_LOCALES.includes(locale as typeof UiTextLoaderService.SUPPORTED_LOCALES[number])
      ? locale
      : UiTextLoaderService.DEFAULT_LOCALE;
  }

  private readPersistedLocale(): string | null {
    try {
      const rawValue = localStorage.getItem(this.localeStorageKey);
      if (!rawValue) {
        return null;
      }
      return this.normalizeLocale(rawValue);
    } catch {
      return null;
    }
  }

  private persistLocale(locale: string): void {
    try {
      localStorage.setItem(this.localeStorageKey, locale);
    } catch {
      return;
    }
  }

  private parseProperties(content: string): PropertyTree {
    const root: PropertyTree = {};
    const lines = content.split(/\r?\n/);

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('!')) {
        return;
      }

      const delimiterIndex = this.findDelimiterIndex(line);
      const rawKey = delimiterIndex >= 0 ? line.slice(0, delimiterIndex).trim() : line;
      const rawValue = delimiterIndex >= 0 ? line.slice(delimiterIndex + 1).trim() : '';
      if (!rawKey) {
        return;
      }

      this.setByPath(root, rawKey.split('.'), this.unescape(rawValue));
    });

    return root;
  }

  private findDelimiterIndex(line: string): number {
    for (let idx = 0; idx < line.length; idx++) {
      const char = line.charAt(idx);
      if ((char === '=' || char === ':') && (idx === 0 || line.charAt(idx - 1) !== '\\')) {
        return idx;
      }
    }
    return -1;
  }

  private setByPath(target: PropertyTree, rawSegments: string[], value: string): void {
    let cursor: unknown = target;

    rawSegments.forEach((segment, index) => {
      const isLast = index === rawSegments.length - 1;
      const nextSegment = rawSegments[index + 1];
      const nextIsArrayIndex = this.isArrayIndex(nextSegment);

      if (this.isArrayIndex(segment)) {
        const arrayIndex = Number(segment);
        const arrayCursor = cursor as unknown[];
        if (isLast) {
          arrayCursor[arrayIndex] = value;
          return;
        }
        if (arrayCursor[arrayIndex] === undefined) {
          arrayCursor[arrayIndex] = nextIsArrayIndex ? [] : {};
        }
        cursor = arrayCursor[arrayIndex];
        return;
      }

      const objectCursor = cursor as PropertyTree;
      if (isLast) {
        objectCursor[segment] = value;
        return;
      }
      if (objectCursor[segment] === undefined) {
        objectCursor[segment] = nextIsArrayIndex ? [] : {};
      }
      cursor = objectCursor[segment];
    });
  }

  private isArrayIndex(segment: string | undefined): boolean {
    return !!segment && /^\d+$/.test(segment);
  }

  private unescape(value: string): string {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\:/g, ':')
      .replace(/\\=/g, '=')
      .replace(/\\\\/g, '\\');
  }
}
