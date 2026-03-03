import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ChessConstants } from '../constants/chess.constants';
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { CctCategoryEnum } from '../model/enums/cct-category.enum';
import { ICctRecommendation, ICctRecommendationScored } from '../model/interfaces/cct-recommendation.interface';
import { IOpeningAssetItem } from '../model/interfaces/opening-asset-item.interface';
import { IParsedOpening } from '../model/interfaces/parsed-opening.interface';
import { ChessRulesService } from '../services/chess-rules.service';
import { ChessBoardStateService } from './chess-board-state.service';
import { ChessBoardCctUtils } from '../utils/chess-board-cct.utils';
import { ChessBoardLogicUtils } from '../utils/chess-board-logic.utils';
import { UiTextLoaderService } from './ui-text-loader.service';
import { ChessBoardHelperDto } from '../model/chess-board-helper.dto';

interface IOpeningUiText {
  message: {
    openingLabel: string;
    matchedSteps: string;
    bookRecommendationWhite: string;
    bookRecommendationBlack: string;
    lineLabel: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ChessBoardCctService {
  private openings: IParsedOpening[] = [];
  private activeOpening: IParsedOpening | null = null;
  private activeOpeningHistoryKey = '';
  private cctRecommendationsCacheKey = '';
  private cctRecommendationsCache: Record<CctCategoryEnum, ICctRecommendation[]> = {
    [CctCategoryEnum.Captures]: [],
    [CctCategoryEnum.Checks]: [],
    [CctCategoryEnum.Threats]: []
  };

  constructor(private http: HttpClient) {}

  ensureCctRecommendations(
    board: ChessPieceDto[][][],
    forColor: ChessColorsEnum,
    _historyLength: number
  ): Record<CctCategoryEnum, ICctRecommendation[]> {
    if (!board || !forColor) {
      this.resetCctRecommendationsCache();
      return this.cctRecommendationsCache;
    }

    const clonedBoard = ChessBoardLogicUtils.cloneField(board);
    const positionKey = this.getPositionKey(clonedBoard, forColor);
    if (positionKey === this.cctRecommendationsCacheKey) {
      return this.cctRecommendationsCache;
    }

    const enemyColor = forColor === ChessColorsEnum.White ? ChessColorsEnum.Black : ChessColorsEnum.White;
    const captures: ICctRecommendationScored[] = [], checks: ICctRecommendationScored[] = [], threats: ICctRecommendationScored[] = [];

    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = clonedBoard[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0] && sourceCell[0].color === forColor)) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        for (let targetRow = ChessConstants.MIN_INDEX; targetRow <= ChessConstants.MAX_INDEX; targetRow++) {
          for (let targetCol = ChessConstants.MIN_INDEX; targetCol <= ChessConstants.MAX_INDEX; targetCol++) {
            if (srcRow === targetRow && srcCol === targetCol) {
              continue;
            }

            const targetCell = clonedBoard[targetRow][targetCol];
            const canMove = this.canPieceMove(clonedBoard, forColor, targetRow, targetCol, targetCell, srcRow, srcCol, sourcePiece);
            if (!canMove) {
              continue;
            }

            const afterMove = ChessBoardLogicUtils.simulateMove(clonedBoard, srcRow, srcCol, targetRow, targetCol);
            if (ChessBoardLogicUtils.isKingInCheck(afterMove, forColor)) {
              continue;
            }

            const isCapture = !!(targetCell && targetCell[0] && targetCell[0].color === enemyColor);
            const isCheck = ChessBoardLogicUtils.isKingInCheck(afterMove, enemyColor);
            const threatenedPieces = ChessBoardCctUtils.getThreatenedEnemyPiecesByMovedPiece(
              afterMove,
              targetRow,
              targetCol,
              forColor,
              enemyColor,
              (tRow, tCol, tCell, sRow, sCol, sPiece, attackerColor) =>
                this.withBoardContext(afterMove, attackerColor, () =>
                  ChessRulesService.canStepThere(tRow, tCol, tCell, sRow, sCol, new ChessPieceDto(sPiece.color, sPiece.piece))
                )
            );

            const move = ChessBoardCctUtils.formatCctMove(sourcePiece.piece, srcRow, srcCol, targetRow, targetCol, isCapture, isCheck);
            const from = ChessBoardCctUtils.toAlgebraicSquare(srcRow, srcCol);
            const to = ChessBoardCctUtils.toAlgebraicSquare(targetRow, targetCol);

            if (isCapture && targetCell && targetCell[0]) {
              const capturedPieceValue = ChessRulesService.valueOfPiece(targetCell[0].piece);
              const attackerValue = ChessRulesService.valueOfPiece(sourcePiece.piece);
              captures.push({
                move,
                tooltip: `${from} → ${to}: captures ${ChessBoardCctUtils.pieceName(targetCell[0].piece)}`,
                score: (capturedPieceValue * 10) - attackerValue
              });
            }

            if (isCheck) {
              checks.push({
                move,
                tooltip: `${from} → ${to}: check${isCapture ? ' with capture' : ''}`,
                score: (isCapture ? 50 : 0) + threatenedPieces.length
              });
            }

            if (!isCapture && !isCheck && threatenedPieces.length > 0) {
              const threatTargets = threatenedPieces.map(piece => ChessBoardCctUtils.pieceName(piece));
              const threatScore = threatenedPieces
                .map(piece => ChessRulesService.valueOfPiece(piece))
                .reduce((acc, value) => acc + value, 0);
              threats.push({
                move,
                tooltip: `${from} → ${to}: threatens ${threatTargets.join(', ')}`,
                score: threatScore
              });
            }
          }
        }
      }
    }

    this.cctRecommendationsCache = {
      [CctCategoryEnum.Captures]: ChessBoardCctUtils.pickTopRecommendations(captures),
      [CctCategoryEnum.Checks]: ChessBoardCctUtils.pickTopRecommendations(checks),
      [CctCategoryEnum.Threats]: ChessBoardCctUtils.pickTopRecommendations(threats)
    };
    this.cctRecommendationsCacheKey = positionKey;
    return this.cctRecommendationsCache;
  }

  loadOpeningsFromAssets(
    locale: string,
    openingsLoadedCallback: (loaded: boolean) => void,
    updateCallback: () => void
  ): { openingsLoaded: boolean, openings: IParsedOpening[], activeOpening: IParsedOpening | null } {
    const openingFiles = ['openings1.json', 'openings2.json', 'openings3.json'];
    const effectiveLocale = locale || UiTextLoaderService.DEFAULT_LOCALE;
    let remainingFiles = openingFiles.length;

    const localOpenings: IParsedOpening[] = [];
    let localOpeningsLoaded = false;

    const checkComplete = () => {
      if (remainingFiles > 0) {
        return;
      }
      localOpeningsLoaded = true;
      this.openings = localOpenings;
      openingsLoadedCallback(localOpeningsLoaded);
      updateCallback();
    };

    openingFiles.forEach((fileName) => {
      this.getOpeningAsset$(fileName, effectiveLocale).subscribe({
        next: (items) => {
          const parsedItems = this.parseOpeningsPayload(items);
          if (parsedItems.length > 0) {
            localOpenings.push(...parsedItems);
          }
        },
        complete: () => {
          remainingFiles -= 1;
          checkComplete();
        }
      });
    });

    return { openingsLoaded: localOpeningsLoaded, openings: this.openings, activeOpening: this.activeOpening };
  }

  updateRecognizedOpeningForCurrentHistory(
    historySteps: string[],
    uiText: IOpeningUiText,
    naPlaceholder: string
  ): { activeOpening: IParsedOpening | null, debugText: string } {
    if (this.openings.length < 1) {
      this.activeOpening = null;
      return { activeOpening: null, debugText: '' };
    }

    const normalizedSteps = historySteps
      .map(step => this.normalizeNotationToken(step))
      .filter(step => step.length > 0);

    const bestMatchResult = this.findBestOpeningMatch(this.openings, normalizedSteps);
    this.activeOpening = bestMatchResult.opening;
    const historyKey = normalizedSteps.join('|');
    const debugKey = `${historyKey}::${this.activeOpening ? this.activeOpening.name : 'none'}`;
    
    let debugText = '';
    if (this.activeOpening && debugKey !== this.activeOpeningHistoryKey) {
      this.activeOpeningHistoryKey = debugKey;
      debugText = this.formatOpeningDebugText(
        this.activeOpening,
        bestMatchResult.baseMatchedDepth,
        normalizedSteps.length,
        uiText,
        naPlaceholder
      );
    }
    
    return { activeOpening: this.activeOpening, debugText };
  }

  formatOpeningDebugText(
    opening: IParsedOpening,
    matchedDepth: number,
    historyDepth: number,
    uiText: IOpeningUiText,
    naPlaceholder: string
  ): string {
    if (!opening) {
      return '';
    }

    const parts: string[] = [];
    parts.push(`${uiText.message.openingLabel}: ${opening.name}`);
    
    if (matchedDepth < historyDepth) {
      const nextStep = opening.steps[matchedDepth];
      if (nextStep) {
        parts.push(`${uiText.message.matchedSteps}: ${matchedDepth}/${opening.steps.length}`);
        const whiteMove = matchedDepth % 2 === 0;
        const response = whiteMove 
          ? opening.raw?.suggested_best_response_name 
          : opening.raw?.suggested_best_response_notation_step;
        
        if (response) {
          const label = whiteMove ? uiText.message.bookRecommendationWhite : uiText.message.bookRecommendationBlack;
          parts.push(`${label}: ${response}`);
        }
      }
    } else {
      parts.push(`${uiText.message.lineLabel}: ${opening.raw?.long_algebraic_notation || naPlaceholder}`);
    }

    return parts.join('\n');
  }

  private getPositionKey(board: ChessPieceDto[][][], turn: ChessColorsEnum): string {
    return ChessBoardLogicUtils.getPositionKey(board, turn, {});
  }

  private withBoardContext<T>(board: ChessPieceDto[][][], turn: ChessColorsEnum, callback: () => T): T {
    const previousField = ChessBoardStateService.CHESS_FIELD;
    const previousHelper = ChessBoardStateService.BOARD_HELPER;
    try {
      ChessBoardStateService.CHESS_FIELD = board;
      const helper = {
        ...(previousHelper || {}),
        colorTurn: turn,
        history: previousHelper?.history || {},
        justDidCastle: null
      } as ChessBoardHelperDto;
      ChessBoardStateService.BOARD_HELPER = helper;
      return callback();
    } finally {
      ChessBoardStateService.CHESS_FIELD = previousField;
      ChessBoardStateService.BOARD_HELPER = previousHelper;
    }
  }

  private canPieceMove(
    board: ChessPieceDto[][][],
    turn: ChessColorsEnum,
    targetRow: number,
    targetCol: number,
    targetCell: ChessPieceDto[],
    srcRow: number,
    srcCol: number,
    sourcePiece: ChessPieceDto
  ): boolean {
    return this.withBoardContext(board, turn, () =>
      ChessRulesService.canStepThere(
        targetRow,
        targetCol,
        targetCell,
        srcRow,
        srcCol,
        new ChessPieceDto(sourcePiece.color, sourcePiece.piece)
      )
    );
  }

  private resetCctRecommendationsCache(): void {
    this.cctRecommendationsCache = {
      [CctCategoryEnum.Captures]: [],
      [CctCategoryEnum.Checks]: [],
      [CctCategoryEnum.Threats]: []
    };
    this.cctRecommendationsCacheKey = '';
  }

  private getOpeningAsset$(fileName: string, locale: string): Observable<IOpeningAssetItem[]> {
    const fallbackPath = `assets/openings/${fileName}`;
    if (locale === UiTextLoaderService.DEFAULT_LOCALE) {
      return this.http.get<IOpeningAssetItem[]>(fallbackPath).pipe(
        catchError(() => of([]))
      );
    }

    const localizedPath = `assets/openings/${locale}/${fileName}`;
    return this.http.get<IOpeningAssetItem[]>(localizedPath).pipe(
      catchError(() => this.http.get<IOpeningAssetItem[]>(fallbackPath).pipe(
        catchError(() => of([]))
      ))
    );
  }

  private parseOpeningsPayload(items: IOpeningAssetItem[]): IParsedOpening[] {
    if (!items || !Array.isArray(items)) {
      return [];
    }

    return items
      .filter(item => item && item.name && item.long_algebraic_notation)
      .map(item => {
        const steps = this.normalizeOpeningNotation(item.long_algebraic_notation);
        return {
          name: item.name,
          steps,
          raw: item
        };
      });
  }

  private normalizeOpeningNotation(notation: string): string[] {
    if (!notation) {
      return [];
    }
    return notation
      .replace(/\d+\.\s*/g, '')
      .split(/\s+/)
      .filter(step => step.length > 0);
  }

  private normalizeNotationToken(token: string): string {
    if (!token) {
      return '';
    }
    return token.replace(/\d+\./, '').trim();
  }

  private findBestOpeningMatch(
    openings: IParsedOpening[],
    historySteps: string[]
  ): { opening: IParsedOpening | null, baseMatchedDepth: number } {
    let bestMatch: IParsedOpening | null = null;
    let bestMatchDepth = 0;
    let bestIsComplete = false;

    for (const opening of openings) {
      let matchedDepth = 0;
      for (let i = 0; i < historySteps.length && i < opening.steps.length; i++) {
        if (this.normalizeNotationToken(historySteps[i]) === this.normalizeNotationToken(opening.steps[i])) {
          matchedDepth++;
        } else {
          break;
        }
      }

      const isComplete = matchedDepth === opening.steps.length && matchedDepth === historySteps.length;
      const isPartial = matchedDepth > 0;

      if (!isPartial) {
        continue;
      }

      if (isComplete) {
        const isShorterCompleteLine =
          matchedDepth === bestMatchDepth &&
          bestMatch !== null &&
          opening.steps.length < bestMatch.steps.length;
        if (!bestIsComplete || matchedDepth > bestMatchDepth || isShorterCompleteLine) {
          bestMatch = opening;
          bestMatchDepth = matchedDepth;
          bestIsComplete = true;
        }
      } else {
        const isShorterPartialLine =
          matchedDepth === bestMatchDepth &&
          bestMatch !== null &&
          opening.steps.length < bestMatch.steps.length;
        if (!bestIsComplete && (matchedDepth > bestMatchDepth || isShorterPartialLine)) {
          bestMatch = opening;
          bestMatchDepth = matchedDepth;
        }
      }
    }

    return { opening: bestMatch, baseMatchedDepth: bestMatchDepth };
  }
}

