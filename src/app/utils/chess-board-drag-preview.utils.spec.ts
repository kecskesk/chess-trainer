import { ChessBoardDragPreviewUtils } from './chess-board-drag-preview.utils';
import { ChessColorsEnum } from '../model/enums/chess-colors.enum';
import { ChessBoardLogicUtils } from './chess-board-logic.utils';

describe('ChessBoardDragPreviewUtils', () => {
  const createBoard = () => Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => [] as any[]));

  it('skips mate target when attacker would be in check after move', () => {
    const board = createBoard();
    board[0][0] = [{ color: ChessColorsEnum.White }] as any;

    spyOn(ChessBoardLogicUtils, 'canPlayLegalMove').and.returnValue(true);
    spyOn(ChessBoardLogicUtils, 'simulateMove').and.returnValue(board as any);
    spyOn(ChessBoardLogicUtils, 'isKingInCheck').and.callFake((_: any, color: ChessColorsEnum) => color === ChessColorsEnum.White);
    const hasAnyLegalMoveSpy = spyOn(ChessBoardLogicUtils, 'hasAnyLegalMove').and.returnValue(true);

    const targets = ChessBoardDragPreviewUtils.collectMateInOneTargets(
      board as any,
      ChessColorsEnum.White,
      ChessColorsEnum.Black
    );

    expect(targets).toEqual({});
    expect(hasAnyLegalMoveSpy).not.toHaveBeenCalled();
  });

  it('returns empty preview payload for invalid move', () => {
    const preview = ChessBoardDragPreviewUtils.previewHoverMateInOne(
      createBoard() as any,
      0,
      0,
      1,
      1,
      false,
      ChessColorsEnum.White
    );

    expect(preview).toEqual({
      mateInOneTargets: {},
      mateInOneBlunderTargets: {},
      lastMatePreviewKey: ''
    });
  });
});
