/* istanbul ignore file */
import { ChessPieceDto } from '../model/chess-piece.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessConstants } from '../constants/chess.constants';
import { ChessBoardCctUtils } from './chess-board-cct.utils';
import { ChessRulesService } from '../services/chess-rules.service';
import { ChessBoardComponentUtils } from './chess-board-component.utils';
import { IVisualizationArrow } from '../model/interfaces/visualization-arrow.interface';
import { ChessBoardEvalConstants } from '../constants/chess.constants';
import { StockfishService } from '../services/stockfish.service';

export interface ISuggestionEvaluationResult {
  pawnsByUci: Map<string, number>;
  textByUci: Map<string, string>;
}

export interface IBuildDisplayToUciMapParams {
  topMovesUci: string[];
  topMovesDisplay: string[];
  cctMoves: string[];
  resolveMoveToUci: (move: string) => string | null;
}

export interface IResolveMoveToUciParams {
  move: string;
  board: ChessPieceDto[][][];
  turnColor: ChessColorsEnum;
  parseSquareToCoords?: (square: string) => { row: number; col: number } | null;
}

export interface IEvaluateUciMovesParams {
  runToken: number;
  getCurrentRunToken: () => number;
  fen: string;
  uniqueUciMoves: string[];
  suggestedMovesDepth: number;
  analysisClampPawns: number;
}

export interface IParsedSuggestedMove {
  piece: ChessPiecesEnum;
  targetRow: number;
  targetCol: number;
}

export class ChessBoardSuggestionFacade {
  static buildSuggestedMovePreviewArrows(
    board: ChessPieceDto[][][],
    turnColor: ChessColorsEnum,
    parsedMove: IParsedSuggestedMove
  ): IVisualizationArrow[] {
    const arrows: IVisualizationArrow[] = [];
    const targetCell = board[parsedMove.targetRow][parsedMove.targetCol];
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0])) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        if (sourcePiece.color !== turnColor || sourcePiece.piece !== parsedMove.piece) {
          continue;
        }
        const isValidMove = ChessRulesService.validateMove(
          parsedMove.targetRow,
          parsedMove.targetCol,
          targetCell,
          srcRow,
          srcCol
        ).isValid;
        if (!isValidMove) {
          continue;
        }
        arrows.push({
          fromRow: 8 - srcRow,
          fromCol: srcCol + 1,
          toRow: 8 - parsedMove.targetRow,
          toCol: parsedMove.targetCol + 1,
          color: 'yellow',
          intensity: 0.45
        });
      }
    }
    return arrows;
  }

  static classifySuggestionLoss(loss: number): string {
    if (loss <= 0.10) {
      return 'history-quality--genius';
    }
    if (loss <= 0.30) {
      return 'history-quality--great';
    }
    if (loss <= 0.60) {
      return 'history-quality--good';
    }
    if (loss <= 1.20) {
      return 'history-quality--small-error';
    }
    if (loss <= 2.50) {
      return 'history-quality--mistake';
    }
    return 'history-quality--blunder';
  }

  static formatEngineSuggestions(
    uciMoves: string[],
    board: ChessPieceDto[][][],
    suggestedMovesCount: number
  ): string[] {
    if (!uciMoves || uciMoves.length < 1) {
      return [];
    }
    return uciMoves
      .map(move => this.formatUciMoveForDisplay(move, board))
      .filter(move => !!move)
      .slice(0, suggestedMovesCount);
  }

  static formatUciMoveForDisplay(
    uciMove: string,
    board: ChessPieceDto[][][],
  ): string {
    const normalized = (uciMove || '').trim();
    const moveMatch = normalized.match(/^([a-h][1-8])([a-h][1-8])[qrbn]?$/);
    if (!moveMatch) {
      return '';
    }
    const fromSquare = this.parseSquareToCoords(moveMatch[1]);
    const toSquare = this.parseSquareToCoords(moveMatch[2]);
    if (!fromSquare || !toSquare) {
      return '';
    }

    const sourceCell = board[fromSquare.row][fromSquare.col];
    if (!(sourceCell && sourceCell[0])) {
      return moveMatch[2];
    }
    const sourcePiece = sourceCell[0];
    const targetCell = board[toSquare.row][toSquare.col];
    const isCapture =
      !!(targetCell && targetCell[0] && targetCell[0].color !== sourcePiece.color) ||
      (sourcePiece.piece === ChessPiecesEnum.Pawn && fromSquare.col !== toSquare.col);
    const toAlgebraic = moveMatch[2];

    if (sourcePiece.piece === ChessPiecesEnum.Pawn) {
      if (isCapture) {
        const fromFile = moveMatch[1].charAt(0);
        return `${fromFile}x${toAlgebraic}`;
      }
      return toAlgebraic;
    }

    const pieceNotation = ChessBoardCctUtils.pieceNotation(sourcePiece.piece);
    return `${pieceNotation}${isCapture ? 'x' : ''}${toAlgebraic}`;
  }

  static parseSquareToCoords(square: string): { row: number; col: number } | null {
    const normalized = (square || '').trim().toLowerCase();
    const squareMatch = normalized.match(/^([a-h])([1-8])$/);
    if (!squareMatch) {
      return null;
    }
    const file = squareMatch[1];
    const rank = Number(squareMatch[2]);
    const col = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = ChessConstants.BOARD_SIZE - rank;
    if (col < ChessConstants.MIN_INDEX || col > ChessConstants.MAX_INDEX ||
      row < ChessConstants.MIN_INDEX || row > ChessConstants.MAX_INDEX) {
      return null;
    }
    return { row, col };
  }

  static resolveMoveToUci(params: IResolveMoveToUciParams): string | null {
    const { move, board, turnColor } = params;
    const normalized = (move || '').trim().replace(/^\.\.\./, '').replace(/[+#?!]/g, '');
    const targetMatch = normalized.match(/([a-h][1-8])$/);
    if (!targetMatch) {
      return null;
    }
    const targetSquare = targetMatch[1];
    const targetCoords = this.parseSquareToCoords(targetSquare);
    if (!targetCoords) {
      return null;
    }
    const targetCell = board[targetCoords.row][targetCoords.col];

    const pieceChar = normalized.charAt(0);
    let pieceType = ChessPiecesEnum.Pawn;
    if (pieceChar === 'K') {
      pieceType = ChessPiecesEnum.King;
    } else if (pieceChar === 'Q') {
      pieceType = ChessPiecesEnum.Queen;
    } else if (pieceChar === 'R') {
      pieceType = ChessPiecesEnum.Rook;
    } else if (pieceChar === 'B') {
      pieceType = ChessPiecesEnum.Bishop;
    } else if (pieceChar === 'N') {
      pieceType = ChessPiecesEnum.Knight;
    }

    const pawnCaptureFileMatch = normalized.match(/^([a-h])x[a-h][1-8]$/);
    const pawnCaptureFile = pawnCaptureFileMatch ? pawnCaptureFileMatch[1] : '';
    const candidates: string[] = [];
    for (let srcRow = ChessConstants.MIN_INDEX; srcRow <= ChessConstants.MAX_INDEX; srcRow++) {
      for (let srcCol = ChessConstants.MIN_INDEX; srcCol <= ChessConstants.MAX_INDEX; srcCol++) {
        const sourceCell = board[srcRow][srcCol];
        if (!(sourceCell && sourceCell[0])) {
          continue;
        }
        const sourcePiece = sourceCell[0];
        if (sourcePiece.color !== turnColor || sourcePiece.piece !== pieceType) {
          continue;
        }
        if (pieceType === ChessPiecesEnum.Pawn && pawnCaptureFile) {
          const sourceFile = String.fromCharCode('a'.charCodeAt(0) + srcCol);
          if (sourceFile !== pawnCaptureFile) {
            continue;
          }
        }

        const isValid = ChessRulesService.validateMove(
          targetCoords.row,
          targetCoords.col,
          targetCell,
          srcRow,
          srcCol
        ).isValid;
        if (!isValid) {
          continue;
        }

        const fromSquare = ChessBoardCctUtils.toAlgebraicSquare(srcRow, srcCol);
        let promotionSuffix = '';
        if (
          pieceType === ChessPiecesEnum.Pawn &&
          ((sourcePiece.color === ChessColorsEnum.White && targetCoords.row === 0) ||
           (sourcePiece.color === ChessColorsEnum.Black && targetCoords.row === ChessConstants.MAX_INDEX))
        ) {
          promotionSuffix = 'q';
        }
        candidates.push(`${fromSquare}${targetSquare}${promotionSuffix}`);
      }
    }

    if (candidates.length < 1) {
      return null;
    }
    return candidates[0];
  }

  static buildDisplayToUciMap(params: IBuildDisplayToUciMapParams): Map<string, string> {
    const { topMovesUci, topMovesDisplay, cctMoves, resolveMoveToUci } = params;
    const displayToUci = new Map<string, string>();
    topMovesDisplay.forEach((move, index) => {
      const uciMove = (topMovesUci[index] || '').trim().toLowerCase();
      if (move && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uciMove) && !displayToUci.has(move)) {
        displayToUci.set(move, uciMove);
      }
    });

    cctMoves.forEach(move => {
      if (!move || displayToUci.has(move)) {
        return;
      }
      const resolved = resolveMoveToUci(move);
      if (resolved) {
        displayToUci.set(move, resolved);
      }
    });

    return displayToUci;
  }

  static async evaluateUciMovesForQuality(params: IEvaluateUciMovesParams): Promise<ISuggestionEvaluationResult> {
    const {
      runToken,
      getCurrentRunToken,
      fen,
      uniqueUciMoves,
      suggestedMovesDepth,
      analysisClampPawns
    } = params;
    const evalByUci = new Map<string, number>();
    const evalTextByUci = new Map<string, string>();
    if (!StockfishService) {
      return { pawnsByUci: evalByUci, textByUci: evalTextByUci };
    }

    for (const uciMove of uniqueUciMoves) {
      if (runToken !== getCurrentRunToken()) {
        return { pawnsByUci: evalByUci, textByUci: evalTextByUci };
      }
      try {
        const evaluation = typeof StockfishService.evaluateFenAfterMoves === 'function'
          ? await StockfishService.evaluateFenAfterMoves(fen, [uciMove], { depth: suggestedMovesDepth })
          : await StockfishService.evaluateFen(fen, { depth: suggestedMovesDepth });
        if (evaluation && evaluation !== ChessBoardEvalConstants.PENDING_EVALUATION_PLACEHOLDER && evaluation !== ChessBoardEvalConstants.EVALUATION_ERROR_PLACEHOLDER &&
          evaluation !== ChessBoardEvalConstants.NA_PLACEHOLDER) {
          evalTextByUci.set(uciMove, evaluation);
        }
        const pawns = ChessBoardComponentUtils.parseEvaluationPawns(
          evaluation,
          analysisClampPawns
        );
        if (pawns !== null) {
          evalByUci.set(uciMove, pawns);
        }
      } catch {
        // Ignore individual move failures and continue with available scores.
      }
    }
    return { pawnsByUci: evalByUci, textByUci: evalTextByUci };
  }
}
