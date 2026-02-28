// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { mergeUiText } from './app/constants/ui-text.constants';

function bootstrapEnglishUiTextForTests(): void {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '/assets/i18n/en_US.properties', false);
  xhr.send();
  if (xhr.status < 200 || xhr.status >= 300 || !xhr.responseText) {
    return;
  }

  const root: Record<string, unknown> = {};
  const lines = xhr.responseText.split(/\r?\n/);

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) {
      return;
    }

    const delimiterIndex = line.search(/(?<!\\)[=:]/);
    const rawKey = delimiterIndex >= 0 ? line.slice(0, delimiterIndex).trim() : line;
    const rawValue = delimiterIndex >= 0 ? line.slice(delimiterIndex + 1).trim() : '';
    if (!rawKey) {
      return;
    }

    const segments = rawKey.split('.');
    let cursor: unknown = root;

    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;
      const nextSegment = segments[index + 1];
      const nextIsArrayIndex = !!nextSegment && /^\d+$/.test(nextSegment);
      const isArrayIndex = /^\d+$/.test(segment);

      if (isArrayIndex) {
        const arrayCursor = cursor as unknown[];
        const arrayIndex = Number(segment);
        if (isLast) {
          arrayCursor[arrayIndex] = rawValue;
          return;
        }
        if (arrayCursor[arrayIndex] === undefined) {
          arrayCursor[arrayIndex] = nextIsArrayIndex ? [] : {};
        }
        cursor = arrayCursor[arrayIndex];
        return;
      }

      const objectCursor = cursor as Record<string, unknown>;
      if (isLast) {
        objectCursor[segment] = rawValue;
        return;
      }
      if (objectCursor[segment] === undefined) {
        objectCursor[segment] = nextIsArrayIndex ? [] : {};
      }
      cursor = objectCursor[segment];
    });
  });

  mergeUiText(root);
}

bootstrapEnglishUiTextForTests();

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

