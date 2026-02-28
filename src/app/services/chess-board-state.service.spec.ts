import { ChessBoardStateService } from './chess-board-state.service';
import { ChessArrowDto } from '../model/chess-arrow.dto';
import { ChessBoardHelperDto } from '../model/chess-board-helper.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

describe('ChessBoardStateService notation helpers', () => {
  it('translates piece notation correctly', () => {
    expect(ChessBoardStateService.translatePieceNotation(ChessPiecesEnum.Knight)).toBe('N');
    expect(ChessBoardStateService.translatePieceNotation(ChessPiecesEnum.Pawn)).toBe('');
    expect(ChessBoardStateService.translatePieceNotation(ChessPiecesEnum.Rook)).toBe('R');
    expect(ChessBoardStateService.translatePieceNotation('Unknown' as any)).toBe('');
  });

  it('builds move notation with capture and check', () => {
    const notation = ChessBoardStateService.translateNotation(
      4,
      4,
      6,
      4,
      ChessPiecesEnum.Knight,
      true,
      true,
      false,
      false,
      null
    );

    expect(notation).toBe('Ne2xe4+');
  });

  it('builds move notation with hyphen for non-captures', () => {
    const notation = ChessBoardStateService.translateNotation(
      4,
      4,
      6,
      4,
      ChessPiecesEnum.Pawn,
      false,
      false,
      false,
      false,
      null
    );

    expect(notation).toBe('e2-e4');
  });
});
describe('ChessBoardStateService state helpers', () => {
  let chessBoardStateService: ChessBoardStateService;
  let originalBoardHelper: ChessBoardHelperDto;
  let originalField: any;

  beforeEach(() => {
    chessBoardStateService = new ChessBoardStateService();
    originalBoardHelper = ChessBoardStateService.BOARD_HELPER;
    originalField = ChessBoardStateService.CHESS_FIELD;
  });

  afterEach(() => {
    ChessBoardStateService.BOARD_HELPER = originalBoardHelper;
    ChessBoardStateService.CHESS_FIELD = originalField;
  });

  it('exposes highlights and history getters', () => {
    chessBoardStateService.boardHelper.possibles['11'] = { row: 1, col: 1 } as any;
    chessBoardStateService.boardHelper.hits['22'] = { row: 2, col: 2 } as any;
    chessBoardStateService.boardHelper.checks['33'] = { row: 3, col: 3 } as any;
    chessBoardStateService.boardHelper.history['1'] = 'e2-e4';

    expect(chessBoardStateService.possibles.length).toBe(1);
    expect(chessBoardStateService.hits.length).toBe(1);
    expect(chessBoardStateService.checks.length).toBe(1);
    expect(chessBoardStateService.boardHighlights.length).toBe(3);
    expect(chessBoardStateService.history).toEqual(['e2-e4']);
  });

  it('adds possible/hit/check via addHighlight switch cases', () => {
    ChessBoardStateService.addHighlight({ row: 4, col: 4, type: 'possible' });
    ChessBoardStateService.addHighlight({ row: 5, col: 5, type: 'capture' });
    ChessBoardStateService.addHighlight({ row: 6, col: 6, type: 'check' });
    ChessBoardStateService.addHighlight({ row: 0, col: 0, type: 'unknown' as any });

    expect(chessBoardStateService.boardHelper.possibles['44']).toEqual({ row: 4, col: 4 } as any);
    expect(chessBoardStateService.boardHelper.hits['55']).toEqual({ row: 5, col: 5 } as any);
    expect(chessBoardStateService.boardHelper.checks['66']).toEqual({ row: 6, col: 6 } as any);
  });

  it('handles null and missing BOARD_HELPER in add methods', () => {
    const warnSpy = spyOn(console, 'warn');
    const errorSpy = spyOn(console, 'error');

    ChessBoardStateService.addPossible(null as any);
    ChessBoardStateService.addHit(null as any);
    ChessBoardStateService.addCheck(null as any);
    ChessBoardStateService.addArrow(null as any);

    ChessBoardStateService.BOARD_HELPER = null as any;
    ChessBoardStateService.addPossible({ row: 1, col: 1 } as any);
    ChessBoardStateService.addHit({ row: 1, col: 1 } as any);
    ChessBoardStateService.addCheck({ row: 1, col: 1 } as any);
    ChessBoardStateService.addArrow(new ChessArrowDto('1px', '1px', '0deg', 'blue', '20px', '2px'));

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('creates arrows from visualization and normalizes color fallback', () => {
    ChessBoardStateService.createArrowFromVisualization({
      fromRow: 8,
      fromCol: 1,
      toRow: 7,
      toCol: 2,
      color: 'cyan',
      intensity: 0.4
    } as any);
    expect(Object.keys(chessBoardStateService.boardHelper.arrows).length).toBe(1);

    chessBoardStateService.boardHelper.arrows = {};
    ChessBoardStateService.createArrowFromVisualization({
      fromRow: 8,
      fromCol: 1,
      toRow: 6,
      toCol: 3,
      color: 'magenta',
      intensity: 0.6
    } as any);
    const createdArrow = Object.values(chessBoardStateService.boardHelper.arrows)[0] as ChessArrowDto;
    expect(createdArrow.color).toBe('blue');
  });

  it('adds history and supports castle/ep/mate notation suffixes', () => {
    ChessBoardStateService.addHistory('e2-e4');
    expect(chessBoardStateService.history).toEqual(['e2-e4']);

    const castleNotation = ChessBoardStateService.translateNotation(
      7, 6, 7, 4,
      ChessPiecesEnum.King,
      false,
      false,
      false,
      false,
      'O-O'
    );
    expect(castleNotation).toBe('O-O');

    const epMateNotation = ChessBoardStateService.translateNotation(
      2, 4, 3, 3,
      ChessPiecesEnum.Pawn,
      true,
      false,
      true,
      true,
      null
    );
    expect(epMateNotation).toContain('#');
    expect(epMateNotation).toContain(' e.p.');
  });

  it('evaluates pieceIsInWay across core branches', () => {
    const errorSpy = spyOn(console, 'error');
    const warnSpy = spyOn(console, 'warn');

    ChessBoardStateService.CHESS_FIELD = [] as any;
    expect(ChessBoardStateService.pieceIsInWay(1, 1, 0, 0)).toBeFalse();
    expect(errorSpy).toHaveBeenCalled();

    ChessBoardStateService.CHESS_FIELD = chessBoardStateService.field;
    expect(ChessBoardStateService.pieceIsInWay(4, 4, 4, 4)).toBeFalse();

    chessBoardStateService.field[6][4] = [ { color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any ];
    chessBoardStateService.field[5][4] = [ { color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any ];
    expect(ChessBoardStateService.pieceIsInWay(4, 4, 6, 4)).toBeTrue();

    chessBoardStateService.field[5][4] = [];
    expect(ChessBoardStateService.pieceIsInWay(4, 4, 6, 4)).toBeFalse();

    expect(ChessBoardStateService.pieceIsInWay(-1, 0, 0, 0)).toBeFalse();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

