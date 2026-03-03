import { fakeAsync, tick } from '@angular/core/testing';
import { ChessBoardGridComponent } from './chess-board-grid.component';
import { ChessBoardComponentUtils } from '../../utils/chess-board-component.utils';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';

describe('ChessBoardGridComponent', () => {
  let component: ChessBoardGridComponent;

  beforeEach(() => {
    component = new ChessBoardGridComponent();
    component.renderedBoardRows = [0, 1, 2, 3, 4, 5, 6, 7];
    component.renderedBoardCols = [0, 1, 2, 3, 4, 5, 6, 7];
    component.field = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => []));
    component.turnColor = ChessColorsEnum.White;
  });

  it('keeps default drop predicate returning false and guards ngAfterViewInit without query list', () => {
    expect(component.canDropPredicate({} as any, {} as any)).toBeFalse();
    (component as any).dropListElements = null;
    component.ngAfterViewInit();
    expect(component.dropLists).toEqual([]);
  });

  it('loads drop lists after view init', fakeAsync(() => {
    const mockedDropLists = [{ id: 'a' }, { id: 'b' }] as any[];
    (component as any).dropListElements = { toArray: () => mockedDropLists };
    component.ngAfterViewInit();
    tick(0);
    expect(component.dropLists).toEqual(mockedDropLists as any);
  }));

  it('returns preview cell colors when preview preset is piece-colors', () => {
    component.previewMode = true;
    component.previewPreset = 'piece-colors';
    const previewCell = [{ color: ChessColorsEnum.White }] as any[];
    spyOn(ChessBoardComponentUtils, 'getPieceColorPreviewCell').and.returnValue(previewCell as any);

    expect(component.getDisplayCell(0, 0)).toBe(previewCell as any);
  });

  it('returns board-backed display values and notations', () => {
    const pawn = { piece: 'p' } as any;
    component.field[6][4] = [pawn];
    expect(component.getDisplayCell(6, 4)).toEqual([pawn]);
    expect(component.getDisplayPiece(6, 4)).toBe(pawn);
    expect(component.getDisplayPiece(0, 0)).toBeNull();
    expect(component.getDisplayFieldId(7, 7)).toBe('field77');
    expect(component.getDisplayNotation(7, 7)).toBe('h1');
    expect(component.isDisplaySquareWhite(0, 0)).toBeTrue();
  });

  it('returns empty display cell when mapped board row is missing', () => {
    component.field = [];
    expect(component.getDisplayCell(0, 0)).toEqual([]);
  });

  it('maps highlight classes and arrow transforms', () => {
    component.mateInOneBlunderTargets = { '44': true };
    expect(component.getDisplaySquareHighlightClass(4, 4)).toBe('mate-one-danger');

    component.mateInOneBlunderTargets = {};
    component.mateInOneTargets = { '44': true };
    expect(component.getDisplaySquareHighlightClass(4, 4)).toBe('mate-one');

    component.mateInOneTargets = {};
    component.boardHighlights = [{ row: 4, col: 4, type: 'capture' } as any];
    expect(component.getDisplaySquareHighlightClass(4, 4)).toBe('killer');

    component.boardHighlights = [{ row: 4, col: 4, type: 'possible' } as any];
    expect(component.getDisplaySquareHighlightClass(4, 4)).toBe('shaded');

    component.boardHighlights = [];
    expect(component.getDisplaySquareHighlightClass(4, 4)).toBe('');

    component.isBoardFlipped = false;
    expect(component.getArrowTopForDisplay({ top: '10%', left: '20%', rotate: '45deg' } as any)).toBe('10%');
    expect(component.getArrowLeftForDisplay({ top: '10%', left: '20%', rotate: '45deg' } as any)).toBe('20%');
    expect(component.getArrowTransformForDisplay({ top: '10%', left: '20%', rotate: '45deg' } as any)).toContain('45deg');
    expect(component.getArrowTopForDisplay(null as any)).toBe('');
    expect(component.getArrowLeftForDisplay(null as any)).toBe('');
    expect(component.getArrowTransformForDisplay(null as any)).toContain('rotate()');
  });
});
