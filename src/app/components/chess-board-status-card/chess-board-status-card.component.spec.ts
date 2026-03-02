import { ChessBoardStatusCardComponent } from './chess-board-status-card.component';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';

describe('ChessBoardStatusCardComponent', () => {
  let component: ChessBoardStatusCardComponent;

  beforeEach(() => {
    component = new ChessBoardStatusCardComponent();
  });

  it('emits selected color for resign confirmation', () => {
    const emitSpy = spyOn(component.openResignConfirm, 'emit');

    component.openResignConfirm.emit(ChessColorsEnum.White);

    expect(emitSpy).toHaveBeenCalledWith(ChessColorsEnum.White);
  });

  it('builds status title across active, checkmate, draw and empty states', () => {
    component.boardState = null;
    expect(component.statusTitle).toBe('');

    component.boardState = {
      colorTurn: ChessColorsEnum.White,
      gameOver: false,
      checkmateColor: null
    };
    expect(component.statusTitle).toBe(`${ChessColorsEnum.White} ${component.uiText.status.toMoveSuffix}`);

    component.boardState = {
      colorTurn: ChessColorsEnum.Black,
      gameOver: true,
      checkmateColor: ChessColorsEnum.White
    };
    expect(component.statusTitle).toContain(component.uiText.status.checkmatePrefix);
    expect(component.statusTitle).toContain(component.uiText.status.black);
    expect(component.statusTitle).toContain(component.uiText.message.checkmateWinner);

    component.boardState = {
      colorTurn: ChessColorsEnum.White,
      gameOver: true,
      checkmateColor: ChessColorsEnum.Black
    };
    expect(component.statusTitle).toContain(component.uiText.status.white);

    component.boardState = {
      colorTurn: ChessColorsEnum.White,
      gameOver: true,
      checkmateColor: null
    };
    expect(component.statusTitle).toBe(component.uiText.status.drawFallback);
  });

  it('formats resign confirm title for both colors', () => {
    component.resignConfirmColor = ChessColorsEnum.White;
    expect(component.resignConfirmTitle).toContain(component.uiText.status.white);

    component.resignConfirmColor = ChessColorsEnum.Black;
    expect(component.resignConfirmTitle).toContain(component.uiText.status.black);
  });
});
