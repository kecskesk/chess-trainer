import { IVisualizationArrow } from '../model/interfaces/visualization-arrow.interface';
import { UiText } from './ui-text.constants';

/**
 * Core chess domain constants reused across rules, board parsing, and notation.
 */
export class ChessConstants {
  /** Number of ranks/files on a standard chess board. */
  static readonly BOARD_SIZE = 8;
  /** Inclusive lower board index (0-based). */
  static readonly MIN_INDEX = 0;
  /** Inclusive upper board index (0-based). */
  static readonly MAX_INDEX = 7;
  /** Total squares on a standard board. */
  static readonly BOARD_SQUARES = 64;

  /** Convenience row indices for board iteration. */
  static readonly ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
  /** Convenience column indices for board iteration. */
  static readonly COLS = [0, 1, 2, 3, 4, 5, 6, 7];
  /** Rank labels by board row index. */
  static readonly RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
  /** File labels by board column index. */
  static readonly FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  /** Material values for heuristic scoring. */
  static readonly PIECE_VALUES = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0
  };

  /** Initial king square for white. */
  static readonly WHITE_KING_START = { row: 7, col: 4 };
  /** Initial king square for black. */
  static readonly BLACK_KING_START = { row: 0, col: 4 };
  /** Initial pawn rank for white. */
  static readonly WHITE_PAWN_ROW = 6;
  /** Initial pawn rank for black. */
  static readonly BLACK_PAWN_ROW = 1;

  /** Castling destination/source columns by side and color. */
  static readonly CASTLING = {
    'white-kingside': { king: 6, rook: 7, rookSource: 7 },
    'white-queenside': { king: 2, rook: 0, rookSource: 0 },
    'black-kingside': { king: 6, rook: 7, rookSource: 7 },
    'black-queenside': { king: 2, rook: 0, rookSource: 0 }
  };

  /** Board row where en-passant capture can occur for each side. */
  static readonly EN_PASSANT_ROW = {
    white: 3,
    black: 4
  };

  /** Board row where capturing pawn lands on en-passant. */
  static readonly EN_PASSANT_CAPTURE_ROW = {
    white: 2,
    black: 5
  };

  /** Promotion destination row for each side. */
  static readonly PROMOTION_ROW = {
    white: 0,
    black: 7
  };
}

/**
 * Rendering and geometry constants for board arrows/visualization overlays.
 */
export class VisualizationConstants {
  /** Minimum arrow thickness in pixels. */
  static readonly ARROW_MIN_THICKNESS = 2;
  /** Maximum arrow thickness in pixels. */
  static readonly ARROW_MAX_THICKNESS = 8;
  /** Minimum rendered arrow length measured in board squares. */
  static readonly ARROW_MIN_LENGTH_SQUARES = 0.26;
  /** Loop safety cap when stepping through paths. */
  static readonly MAX_PATH_ITERATIONS = 8;
  /** Allowed arrow color tokens from visualization API. */
  static readonly SUPPORTED_ARROW_COLORS: Array<IVisualizationArrow['color']> = ['red', 'green', 'yellow', 'gold', 'cyan', 'blue'];
}

/**
 * UI/runtime constants specific to the board component.
 */
export class ChessBoardUiConstants {
  /** Prefix used by drop-list ids: format is `fieldRC`, e.g. `field34`. */
  static readonly FIELD_ID_PREFIX = 'field';
  /** Minimum id length for `fieldRC` (5 chars + row + col). */
  static readonly FIELD_ID_MIN_LENGTH = 7;
  /** Character index of row digit inside `fieldRC`. */
  static readonly FIELD_ID_ROW_INDEX = 5;
  /** Character index of column digit inside `fieldRC`. */
  static readonly FIELD_ID_COL_INDEX = 6;

  /** Default selected time-control preset label at startup. */
  static readonly DEFAULT_CLOCK_PRESET_LABEL = '5+0';
  /** Clock update cadence in milliseconds. */
  static readonly CLOCK_TICK_INTERVAL_MS = 200;
  /** Local storage key for debug panel open/closed state. */
  static readonly DEBUG_PANEL_STORAGE_KEY = 'chess-trainer.debug-panel-open';
  /** Serialized flag for opened state in local storage. */
  static readonly STORAGE_OPEN = '1';
  /** Serialized flag for closed state in local storage. */
  static readonly STORAGE_CLOSED = '0';

  /** Supported time-control presets shown in the UI. */
  static readonly CLOCK_PRESETS: { label: string; baseMinutes: number; incrementSeconds: number }[] = [
    { label: '1+0', baseMinutes: 1, incrementSeconds: 0 },
    { label: '3+2', baseMinutes: 3, incrementSeconds: 2 },
    { label: '5+0', baseMinutes: 5, incrementSeconds: 0 },
    { label: '10+0', baseMinutes: 10, incrementSeconds: 0 }
  ];
}

/**
 * Reusable user-facing messages for board status/debug/draw outcomes.
 */
export class ChessBoardMessageConstants {
  /** Debug message when move input is blocked due to finished game. */
  static get GAME_OVER_NO_MOVES(): string { return UiText.message.gameOverNoMoves; }
  /** Debug message prompting user to reset after game end. */
  static get GAME_OVER_START_NEW(): string { return UiText.message.gameOverStartNew; }
  /** Debug message when selecting an empty board square. */
  static get NO_PIECE_ON_SQUARE(): string { return UiText.message.noPieceOnSquare; }

  /** Draw text and PGN reason labels by draw scenario. */
  static get DRAW_BY_AGREEMENT_TEXT(): string { return UiText.message.drawByAgreementText; }
  static get DRAW_BY_AGREEMENT_TITLE(): string { return UiText.message.drawByAgreementTitle; }
  static get DRAW_BY_THREEFOLD_TEXT(): string { return UiText.message.drawByThreefoldText; }
  static get DRAW_BY_THREEFOLD_TITLE(): string { return UiText.message.drawByThreefoldTitle; }
  static get DRAW_BY_FIFTY_MOVE_TEXT(): string { return UiText.message.drawByFiftyMoveText; }
  static get DRAW_BY_FIFTY_MOVE_TITLE(): string { return UiText.message.drawByFiftyMoveTitle; }
  static get DRAW_BY_STALEMATE_TEXT(): string { return UiText.message.drawByStalemateText; }
  static get DRAW_BY_STALEMATE_TITLE(): string { return UiText.message.drawByStalemateTitle; }
  static get DRAW_BY_INSUFFICIENT_TEXT(): string { return UiText.message.drawByInsufficientText; }
  static get DRAW_BY_INSUFFICIENT_TITLE(): string { return UiText.message.drawByInsufficientTitle; }
  static get DRAW_BY_FIVEFOLD_TEXT(): string { return UiText.message.drawByFivefoldText; }
  static get DRAW_BY_FIVEFOLD_TITLE(): string { return UiText.message.drawByFivefoldTitle; }
  static get DRAW_BY_SEVENTYFIVE_TEXT(): string { return UiText.message.drawBySeventyFiveText; }
  static get DRAW_BY_SEVENTYFIVE_TITLE(): string { return UiText.message.drawBySeventyFiveTitle; }

  /** Builds turn guidance message (e.g. "It is White's move."). */
  static turnMessage(color: string): string {
    return UiText.message.turnMessageTemplate.replace('{color}', color);
  }

  /** Builds message shown when selected piece has zero legal moves. */
  static noLegalTargetsMessage(piece: string): string {
    return UiText.message.noLegalTargetsTemplate.replace('{piece}', piece);
  }
}
