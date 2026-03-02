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
});