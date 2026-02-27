import { GlobalVariablesService } from './global-variables.service';
import { ChessPiecesEnum } from '../model/chess.pieces';

describe('GlobalVariablesService notation helpers', () => {
  it('translates piece notation correctly', () => {
    expect(GlobalVariablesService.translatePieceNotation(ChessPiecesEnum.Knight)).toBe('N');
    expect(GlobalVariablesService.translatePieceNotation(ChessPiecesEnum.Pawn)).toBe('');
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
