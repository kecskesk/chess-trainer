import { ChessBoardHelperDto } from './chess-board-helper.dto';
import { ChessMoveParamsDto } from './chess-move-params.dto';
import { ChessColorsEnum } from './enums/chess-colors.enum';

describe('Model DTO default parameter branches', () => {
  it('uses default values for optional ChessBoardHelperDto constructor params', () => {
    const helper = new ChessBoardHelperDto(
      '',
      {},
      {},
      {},
      {},
      {},
      ChessColorsEnum.White,
      null,
      null,
      null
    );

    expect(helper.gameOver).toBeFalse();
    expect(helper.checkmateColor).toBeNull();
  });

  it('uses default justLooking value in ChessMoveParamsDto constructor', () => {
    const moveParams = new ChessMoveParamsDto(
      4,
      4,
      6,
      4,
      ChessColorsEnum.White,
      {}
    );

    expect(moveParams.justLooking).toBeFalse();
  });
});
