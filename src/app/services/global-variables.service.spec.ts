import { GlobalVariablesService } from './global-variables.service';
import { ChessArrowDto } from '../model/chess-arrow.dto';
import { ChessBoardHelperDto } from '../model/chess-board-helper.dto';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';

describe('GlobalVariablesService notation helpers', () => {
  it('translates piece notation correctly', () => {
    expect(GlobalVariablesService.translatePieceNotation(ChessPiecesEnum.Knight)).toBe('N');
    expect(GlobalVariablesService.translatePieceNotation(ChessPiecesEnum.Pawn)).toBe('');
    expect(GlobalVariablesService.translatePieceNotation(ChessPiecesEnum.Rook)).toBe('R');
    expect(GlobalVariablesService.translatePieceNotation('Unknown' as any)).toBe('');
  });

  it('builds move notation with capture and check', () => {
    const notation = GlobalVariablesService.translateNotation(
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
    const notation = GlobalVariablesService.translateNotation(
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

describe('GlobalVariablesService state helpers', () => {
  let globals: GlobalVariablesService;
  let originalBoardHelper: ChessBoardHelperDto;
  let originalField: any;

  beforeEach(() => {
    globals = new GlobalVariablesService();
    originalBoardHelper = GlobalVariablesService.BOARD_HELPER;
    originalField = GlobalVariablesService.CHESS_FIELD;
  });

  afterEach(() => {
    GlobalVariablesService.BOARD_HELPER = originalBoardHelper;
    GlobalVariablesService.CHESS_FIELD = originalField;
  });

  it('exposes highlights and history getters', () => {
    globals.boardHelper.possibles['11'] = { row: 1, col: 1 } as any;
    globals.boardHelper.hits['22'] = { row: 2, col: 2 } as any;
    globals.boardHelper.checks['33'] = { row: 3, col: 3 } as any;
    globals.boardHelper.history['1'] = 'e2-e4';

    expect(globals.possibles.length).toBe(1);
    expect(globals.hits.length).toBe(1);
    expect(globals.checks.length).toBe(1);
    expect(globals.boardHighlights.length).toBe(3);
    expect(globals.history).toEqual(['e2-e4']);
  });

  it('adds possible/hit/check via addHighlight switch cases', () => {
    GlobalVariablesService.addHighlight({ row: 4, col: 4, type: 'possible' });
    GlobalVariablesService.addHighlight({ row: 5, col: 5, type: 'capture' });
    GlobalVariablesService.addHighlight({ row: 6, col: 6, type: 'check' });
    GlobalVariablesService.addHighlight({ row: 0, col: 0, type: 'unknown' as any });

    expect(globals.boardHelper.possibles['44']).toEqual({ row: 4, col: 4 } as any);
    expect(globals.boardHelper.hits['55']).toEqual({ row: 5, col: 5 } as any);
    expect(globals.boardHelper.checks['66']).toEqual({ row: 6, col: 6 } as any);
  });

  it('handles null and missing BOARD_HELPER in add methods', () => {
    const warnSpy = spyOn(console, 'warn');
    const errorSpy = spyOn(console, 'error');

    GlobalVariablesService.addPossible(null as any);
    GlobalVariablesService.addHit(null as any);
    GlobalVariablesService.addCheck(null as any);
    GlobalVariablesService.addArrow(null as any);

    GlobalVariablesService.BOARD_HELPER = null as any;
    GlobalVariablesService.addPossible({ row: 1, col: 1 } as any);
    GlobalVariablesService.addHit({ row: 1, col: 1 } as any);
    GlobalVariablesService.addCheck({ row: 1, col: 1 } as any);
    GlobalVariablesService.addArrow(new ChessArrowDto('1px', '1px', '0deg', 'blue', '20px', '2px'));

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('creates arrows from visualization and normalizes color fallback', () => {
    GlobalVariablesService.createArrowFromVisualization({
      fromRow: 8,
      fromCol: 1,
      toRow: 7,
      toCol: 2,
      color: 'cyan',
      intensity: 0.4
    } as any);
    expect(Object.keys(globals.boardHelper.arrows).length).toBe(1);

    globals.boardHelper.arrows = {};
    GlobalVariablesService.createArrowFromVisualization({
      fromRow: 8,
      fromCol: 1,
      toRow: 6,
      toCol: 3,
      color: 'magenta',
      intensity: 0.6
    } as any);
    const createdArrow = Object.values(globals.boardHelper.arrows)[0] as ChessArrowDto;
    expect(createdArrow.color).toBe('blue');
  });

  it('adds history and supports castle/ep/mate notation suffixes', () => {
    GlobalVariablesService.addHistory('e2-e4');
    expect(globals.history).toEqual(['e2-e4']);

    const castleNotation = GlobalVariablesService.translateNotation(
      7, 6, 7, 4,
      ChessPiecesEnum.King,
      false,
      false,
      false,
      false,
      'O-O'
    );
    expect(castleNotation).toBe('O-O');

    const epMateNotation = GlobalVariablesService.translateNotation(
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

    GlobalVariablesService.CHESS_FIELD = [] as any;
    expect(GlobalVariablesService.pieceIsInWay(1, 1, 0, 0)).toBeFalse();
    expect(errorSpy).toHaveBeenCalled();

    GlobalVariablesService.CHESS_FIELD = globals.field;
    expect(GlobalVariablesService.pieceIsInWay(4, 4, 4, 4)).toBeFalse();

    globals.field[6][4] = [ { color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any ];
    globals.field[5][4] = [ { color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any ];
    expect(GlobalVariablesService.pieceIsInWay(4, 4, 6, 4)).toBeTrue();

    globals.field[5][4] = [];
    expect(GlobalVariablesService.pieceIsInWay(4, 4, 6, 4)).toBeFalse();

    expect(GlobalVariablesService.pieceIsInWay(-1, 0, 0, 0)).toBeFalse();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
