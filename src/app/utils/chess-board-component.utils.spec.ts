import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../model/enums/chess-pieces.enum';
import { ChessBoardComponentUtils } from './chess-board-component.utils';

describe('ChessBoardComponentUtils', () => {
  it('moves pieces between cells and handles guard branches', () => {
    const source = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    const target: any[] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Pawn }];

    ChessBoardComponentUtils.movePieceBetweenCells(null as any, target);
    expect(target.length).toBe(1);

    ChessBoardComponentUtils.movePieceBetweenCells(source, target);
    expect(source.length).toBe(0);
    expect(target.length).toBe(1);
    expect(target[0].color).toBe(ChessColorsEnum.White);
  });

  it('parses field ids with valid and invalid formats', () => {
    expect(ChessBoardComponentUtils.parseFieldId('field34')).toEqual({ row: 3, col: 4 });
    expect(ChessBoardComponentUtils.parseFieldId('bad')).toBeNull();
    expect(ChessBoardComponentUtils.parseFieldId('fieldx0')).toBeNull();
    expect(ChessBoardComponentUtils.parseFieldId('field99')).toBeNull();
  });

  it('maps display board positions and piece-color preview cells', () => {
    expect(ChessBoardComponentUtils.getDisplayBoardPosition(0, 0, false)).toEqual({ row: 0, col: 0 });
    expect(ChessBoardComponentUtils.getDisplayBoardPosition(0, 0, true)).toEqual({ row: 7, col: 7 });

    const rows = [0, 1];
    const cols = [0, 1];
    expect(ChessBoardComponentUtils.getPieceColorPreviewCell(0, 0, rows, cols)[0].piece).toBe(ChessPiecesEnum.Rook);
    expect(ChessBoardComponentUtils.getPieceColorPreviewCell(0, 1, rows, cols)[0].piece).toBe(ChessPiecesEnum.Bishop);
    expect(ChessBoardComponentUtils.getPieceColorPreviewCell(1, 0, rows, cols)[0].piece).toBe(ChessPiecesEnum.Pawn);
    expect(ChessBoardComponentUtils.getPieceColorPreviewCell(1, 1, rows, cols)[0].piece).toBe(ChessPiecesEnum.Knight);
    expect(ChessBoardComponentUtils.getPieceColorPreviewCell(7, 7, rows, cols)).toEqual([]);
  });

  it('parses evaluation text and computes move quality labels', () => {
    expect(ChessBoardComponentUtils.parseEvaluationPawns('', '...', 'err', 'n/a', 10)).toBeNull();
    expect(ChessBoardComponentUtils.parseEvaluationPawns('...', '...', 'err', 'n/a', 10)).toBeNull();
    expect(ChessBoardComponentUtils.parseEvaluationPawns('err', '...', 'err', 'n/a', 10)).toBeNull();
    expect(ChessBoardComponentUtils.parseEvaluationPawns('n/a', '...', 'err', 'n/a', 10)).toBeNull();
    expect(ChessBoardComponentUtils.parseEvaluationPawns('#3', '...', 'err', 'n/a', 10)).toBe(10);
    expect(ChessBoardComponentUtils.parseEvaluationPawns('#-2', '...', 'err', 'n/a', 10)).toBe(-10);
    expect(ChessBoardComponentUtils.parseEvaluationPawns('+1.2', '...', 'err', 'n/a', 10)).toBe(1.2);
    expect(ChessBoardComponentUtils.parseEvaluationPawns('bad', '...', 'err', 'n/a', 10)).toBeNull();

    expect(ChessBoardComponentUtils.getMoveQuality(0, 0, 1)).toBeNull();
    expect(ChessBoardComponentUtils.getMoveQuality(1, null, 1)).toBeNull();
    expect(ChessBoardComponentUtils.getMoveQuality(1, 1, null)).toBeNull();
    expect(ChessBoardComponentUtils.getMoveQuality(2, 0, 3)?.label).toBe('genius');
    expect(ChessBoardComponentUtils.getMoveQuality(2, 0, 1)?.label).toBe('great');
    expect(ChessBoardComponentUtils.getMoveQuality(2, 0, 0.75)?.label).toBe('good');
    expect(ChessBoardComponentUtils.getMoveQuality(2, 3, 0)?.label).toBe('blunder');
    expect(ChessBoardComponentUtils.getMoveQuality(2, 2, 0.5)?.label).toBe('mistake');
    expect(ChessBoardComponentUtils.getMoveQuality(2, 1, 0.25)?.label).toBe('small error');
    expect(ChessBoardComponentUtils.getMoveQuality(2, 1, 1.1)?.label).toBe('best');
  });
});
