import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { mergeUiText } from '../constants/ui-text.constants';

type PropertyTree = Record<string, unknown>;

@Injectable({
  providedIn: 'root'
})
export class UiTextLoaderService {
  constructor(private readonly http: HttpClient) {}

  async load(locale: string = 'en_US'): Promise<void> {
    const path = `assets/i18n/${locale}.properties`;
    try {
      const content = await firstValueFrom(this.http.get(path, { responseType: 'text' }));
      const parsed = this.parseProperties(content);
      mergeUiText(parsed);
    } catch (error) {
      console.error(`Failed to load UI text properties from ${path}.`, error);
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
