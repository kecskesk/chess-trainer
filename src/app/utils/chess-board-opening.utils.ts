import { ChessMoveNotation } from './chess-utils';
import { IOpeningAssetItem } from '../model/interfaces/opening-asset-item.interface';
import { IParsedOpening } from '../model/interfaces/parsed-opening.interface';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface IOpeningDebugTextDictionary {
  message: {
    openingPrefix: string;
    matchedStepsPrefix: string;
    linePrefix: string;
    bookRecommendationPrefix: string;
    bookRecommendationNowSuffix: string;
    bookRecommendationAfterSuffix: string;
    notesPrefix: string;
  };
  status: {
    white: string;
    black: string;
  };
}

export interface IOpeningMatchResult {
  opening: IParsedOpening | null;
  baseMatchedDepth: number;
}

export class ChessBoardOpeningUtils {
  static loadOpeningsFromAssets(
    http: HttpClient,
    locale: string,
    defaultLocale: string,
    onItemsLoaded: (items: IParsedOpening[]) => void,
    onCompleted: () => void,
    openingFiles: string[] = ['openings1.json', 'openings2.json', 'openings3.json']
  ): void {
    if (!(openingFiles && openingFiles.length > 0)) {
      onCompleted();
      return;
    }

    let remainingFiles = openingFiles.length;
    openingFiles.forEach((fileName) => {
      ChessBoardOpeningUtils.getOpeningAsset$(http, fileName, locale, defaultLocale).subscribe({
        next: (items) => {
          const parsedItems = ChessBoardOpeningUtils.parseOpeningsPayload(items);
          if (parsedItems.length > 0) {
            onItemsLoaded(parsedItems);
          }
        },
        complete: () => {
          remainingFiles -= 1;
          if (remainingFiles > 0) {
            return;
          }
          onCompleted();
        }
      });
    });
  }

  static getOpeningAsset$(
    http: HttpClient,
    fileName: string,
    locale: string,
    defaultLocale: string
  ): Observable<IOpeningAssetItem[]> {
    const fallbackPath = `assets/openings/${fileName}`;
    if (locale === defaultLocale) {
      return http.get<IOpeningAssetItem[]>(fallbackPath).pipe(
        catchError(() => of([]))
      );
    }

    const localizedPath = `assets/openings/${locale}/${fileName}`;
    return http.get<IOpeningAssetItem[]>(localizedPath).pipe(
      catchError(() => http.get<IOpeningAssetItem[]>(fallbackPath).pipe(
        catchError(() => of([]))
      ))
    );
  }

  static parseOpeningsPayload(items: IOpeningAssetItem[]): IParsedOpening[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(item => !!(item && item.name && item.long_algebraic_notation))
      .map(item => ({
        name: item.name,
        raw: item,
        steps: ChessBoardOpeningUtils.extractNotationSteps(item.long_algebraic_notation)
      }))
      .filter(item => item.steps.length > 0);
  }

  static extractNotationSteps(notation: string): string[] {
    if (!notation) {
      return [];
    }
    return notation
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 0)
      .filter(token => !/^\d+\.{1,3}$/.test(token))
      .map(token => ChessBoardOpeningUtils.normalizeNotationToken(token))
      .filter(token => ChessMoveNotation.isValidLongNotation(token))
      .filter(token => token.length > 0);
  }

  static normalizeNotationToken(token: string): string {
    if (!token) {
      return '';
    }
    return token
      .replace(/[+#?!]+$/g, '')
      .replace(/\s*e\.p\.$/i, '')
      .trim();
  }

  static shouldPrefixSuggestedOpeningName(openingName: string, suggestedName: string): boolean {
    const base = (openingName || '').trim();
    const suggestion = (suggestedName || '').trim();
    if (!base || !suggestion) {
      return false;
    }

    const normalizedBase = base.toLowerCase();
    const normalizedSuggestion = suggestion.toLowerCase();
    return !(normalizedSuggestion.includes(normalizedBase) || normalizedBase.includes(normalizedSuggestion));
  }

  static getDisplayedOpeningName(opening: IParsedOpening, historySteps: string[]): string {
    if (!opening || !opening.raw) {
      return '';
    }

    const suggestedName = (opening.raw.suggested_best_response_name || '').trim();
    const suggestedStep = opening.raw.suggested_best_response_notation_step || '';
    const suggestedMove = ChessBoardOpeningUtils.extractNotationSteps(suggestedStep)[0] || '';
    if (!suggestedName || !suggestedMove || historySteps.length <= opening.steps.length) {
      return opening.name;
    }

    const openingPrefixMatches = opening.steps.every((step, idx) => historySteps[idx] === step);
    if (!openingPrefixMatches) {
      return opening.name;
    }

    if (historySteps[opening.steps.length] === suggestedMove) {
      if (ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName(opening.name, suggestedName)) {
        return `${opening.name}: ${suggestedName}`;
      }
      return suggestedName;
    }

    return opening.name;
  }

  static findBestOpeningMatch(openings: IParsedOpening[], historySteps: string[]): IOpeningMatchResult {
    let bestMatch: IParsedOpening | null = null;
    let bestMatchDepth = 0;
    let bestMatchBaseDepth = 0;
    let bestMatchIsComplete = false;
    let bestMatchStepLength = Number.MAX_SAFE_INTEGER;

    openings.forEach(opening => {
      const maxComparableLength = Math.min(historySteps.length, opening.steps.length);
      let baseMatchedDepth = 0;
      for (let idx = 0; idx < maxComparableLength; idx++) {
        if (historySteps[idx] !== opening.steps[idx]) {
          break;
        }
        baseMatchedDepth += 1;
      }

      if (baseMatchedDepth < 1) {
        return;
      }

      let effectiveMatchedDepth = baseMatchedDepth;
      let effectiveStepLength = opening.steps.length;
      const suggestedSequence = ChessBoardOpeningUtils.extractNotationSteps(opening.raw.suggested_best_response_notation_step || '');
      const hasStartedSuggestedLine =
        baseMatchedDepth === opening.steps.length &&
        suggestedSequence.length > 0 &&
        historySteps.length > opening.steps.length &&
        historySteps[opening.steps.length] === suggestedSequence[0];

      if (hasStartedSuggestedLine) {
        const extraHistoryCount = Math.max(historySteps.length - opening.steps.length, 0);
        const maxComparableSuggestedCount = Math.min(extraHistoryCount, suggestedSequence.length);
        for (let idx = 0; idx < maxComparableSuggestedCount; idx++) {
          if (historySteps[opening.steps.length + idx] !== suggestedSequence[idx]) {
            break;
          }
          effectiveMatchedDepth += 1;
        }
        effectiveStepLength += suggestedSequence.length;
      }

      const isCompleteMatch = effectiveMatchedDepth === effectiveStepLength;

      if (effectiveMatchedDepth > bestMatchDepth) {
        bestMatchDepth = effectiveMatchedDepth;
        bestMatchBaseDepth = baseMatchedDepth;
        bestMatch = opening;
        bestMatchIsComplete = isCompleteMatch;
        bestMatchStepLength = effectiveStepLength;
        return;
      }

      if (effectiveMatchedDepth === bestMatchDepth) {
        if (isCompleteMatch && !bestMatchIsComplete) {
          bestMatch = opening;
          bestMatchBaseDepth = baseMatchedDepth;
          bestMatchIsComplete = true;
          bestMatchStepLength = effectiveStepLength;
          return;
        }

        if (isCompleteMatch === bestMatchIsComplete && effectiveStepLength < bestMatchStepLength) {
          bestMatch = opening;
          bestMatchBaseDepth = baseMatchedDepth;
          bestMatchIsComplete = isCompleteMatch;
          bestMatchStepLength = effectiveStepLength;
        }
      }
    });

    return {
      opening: bestMatch,
      baseMatchedDepth: bestMatchBaseDepth
    };
  }

  static formatOpeningDebugText(
    opening: IParsedOpening,
    matchedDepth: number,
    historyDepth: number,
    historySteps: string[],
    uiText: IOpeningDebugTextDictionary,
    naPlaceholder: string
  ): string {
    if (!opening || !opening.raw) {
      return '';
    }
    const normalizedHistorySteps = historySteps || [];

    const openingLine = opening.raw.long_algebraic_notation || naPlaceholder;
    const suggestedName = opening.raw.suggested_best_response_name || naPlaceholder;
    const suggestedDisplayName =
      suggestedName !== naPlaceholder && ChessBoardOpeningUtils.shouldPrefixSuggestedOpeningName(opening.name, suggestedName)
        ? `${opening.name}: ${suggestedName}`
        : suggestedName;
    const suggestedStep = opening.raw.suggested_best_response_notation_step || naPlaceholder;
    const description = opening.raw.short_description || naPlaceholder;
    const displayedOpeningName = ChessBoardOpeningUtils.getDisplayedOpeningName(opening, normalizedHistorySteps);
    const suggestedSequence = ChessBoardOpeningUtils.extractNotationSteps(suggestedStep);
    const suggestedResponseMove = suggestedSequence[0] || naPlaceholder;
    const hasStartedSuggestedLine =
      suggestedSequence.length > 0 &&
      normalizedHistorySteps.length > opening.steps.length &&
      normalizedHistorySteps[opening.steps.length] === suggestedSequence[0];
    const shouldProjectSuggestedLine = matchedDepth === opening.steps.length && hasStartedSuggestedLine;

    const fullProjectedLineSteps = shouldProjectSuggestedLine
      ? [...opening.steps, ...suggestedSequence]
      : [...opening.steps];

    let effectiveMatchedDepth = matchedDepth;
    if (shouldProjectSuggestedLine) {
      const extraHistoryCount = Math.max(normalizedHistorySteps.length - opening.steps.length, 0);
      const maxComparableSuggestedCount = Math.min(extraHistoryCount, suggestedSequence.length);
      for (let idx = 0; idx < maxComparableSuggestedCount; idx++) {
        if (normalizedHistorySteps[opening.steps.length + idx] !== suggestedSequence[idx]) {
          break;
        }
        effectiveMatchedDepth += 1;
      }
    }

    const effectiveLineDepth = fullProjectedLineSteps.length;
    const openingLineWithExtension =
      shouldProjectSuggestedLine && suggestedStep !== naPlaceholder
        ? `${openingLine} ${suggestedStep}`
        : openingLine;

    const noMovePlaceholder = '—';
    const lineContinuation = effectiveMatchedDepth < effectiveLineDepth
      ? fullProjectedLineSteps[effectiveMatchedDepth]
      : noMovePlaceholder;
    const nextSide = historyDepth % 2 === 0 ? uiText.status.white : uiText.status.black;
    const responseSide = nextSide === uiText.status.white ? uiText.status.black : uiText.status.white;
    let bookRecommendationNow = noMovePlaceholder;
    if (lineContinuation !== noMovePlaceholder) {
      bookRecommendationNow = lineContinuation;
    } else if (!shouldProjectSuggestedLine && suggestedResponseMove !== naPlaceholder) {
      bookRecommendationNow = suggestedResponseMove;
    }

    const debugLines = [
      `${uiText.message.openingPrefix}: ${displayedOpeningName}`,
      `${uiText.message.matchedStepsPrefix}: ${effectiveMatchedDepth}/${Math.max(effectiveLineDepth, historyDepth)}`,
      `${uiText.message.linePrefix}: ${openingLineWithExtension}`,
      `${uiText.message.bookRecommendationPrefix} (${nextSide} ${uiText.message.bookRecommendationNowSuffix}): ${bookRecommendationNow}`
    ];

    if (lineContinuation !== noMovePlaceholder && suggestedStep !== naPlaceholder && !shouldProjectSuggestedLine) {
      debugLines.push(
        `${uiText.message.bookRecommendationPrefix} (${responseSide} ${uiText.message.bookRecommendationAfterSuffix}): ${suggestedDisplayName} (${suggestedStep})`
      );
    }

    debugLines.push(`${uiText.message.notesPrefix}: ${description}`);
    return debugLines.join('\n');
  }
}
