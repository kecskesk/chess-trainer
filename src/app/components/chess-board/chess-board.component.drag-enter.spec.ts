import { ChessBoardComponent } from './chess-board.component';
import { ChessBoardStateService } from '../../services/chess-board-state.service';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../../model/enums/chess-pieces.enum';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ChessBoardComponent template drag-enter integration - mate detection', () => {
  let fixture: ComponentFixture<ChessBoardComponent>;
  let component: ChessBoardComponent;
  let chessBoardStateService: ChessBoardStateService;

  const clearBoard = (): void => {
    for (let row = 0; row <= 7; row++) {
      for (let col = 0; col <= 7; col++) {
        chessBoardStateService.field[row][col] = [];
      }
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChessBoardComponent, DragDropModule],
      providers: [ChessBoardStateService, provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ChessBoardComponent);
    component = fixture.componentInstance;
    chessBoardStateService = TestBed.inject(ChessBoardStateService);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('applies mate-one-danger class on target square when cdkDropListEntered fires for a blunder move', () => {
    clearBoard();
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[6][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[6][6] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Pawn } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[5][6] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.field[3][3] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Bishop } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    fixture.detectChanges();

    const targetSquare = fixture.debugElement.query(By.css('#field60'));
    targetSquare.triggerEventHandler('cdkDropListEntered', {
      item: { dropContainer: { id: 'field70' } },
      container: { id: 'field60' }
    } as any);
    fixture.detectChanges();

    expect(component.isMateInOneBlunderTarget(6, 0)).toBeTrue();
    expect((targetSquare.nativeElement as HTMLElement).classList.contains('mate-one-danger')).toBeTrue();
  });

  it('applies mate-one class on target square when cdkDropListEntered fires for a winning mate move', () => {
    clearBoard();
    chessBoardStateService.field[0][0] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][2] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[2][1] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Queen } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;

    fixture.detectChanges();

    const targetSquare = fixture.debugElement.query(By.css('#field11'));
    targetSquare.triggerEventHandler('cdkDropListEntered', {
      item: { dropContainer: { id: 'field21' } },
      container: { id: 'field11' }
    } as any);
    fixture.detectChanges();

    expect(component.isMateInOneTarget(1, 1)).toBeTrue();
    expect((targetSquare.nativeElement as HTMLElement).classList.contains('mate-one')).toBeTrue();
  });
});

describe('ChessBoardComponent template drag-enter integration - UI buttons', () => {
  let fixture: ComponentFixture<ChessBoardComponent>;
  let component: ChessBoardComponent;
  let chessBoardStateService: ChessBoardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChessBoardComponent, DragDropModule],
      providers: [ChessBoardStateService, provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ChessBoardComponent);
    component = fixture.componentInstance;
    chessBoardStateService = TestBed.inject(ChessBoardStateService);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('buttons receive time-btn--selected class based on activeTool and flip state (integration)', () => {
    component.showThreats(false);
    expect(component.activeTool).toBe('threats-mine');

    component.showProtected(false);
    expect(component.activeTool).toBe('protected-mine');

    component.toggleBoardFlip();
    expect(component.isBoardFlipped).toBeTrue();
  });

  it('shows claim draw button only when draw can be claimed', () => {
    expect(component.canClaimDraw()).toBeFalse();

    chessBoardStateService.field[7][4] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[7][0] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.field[0][4] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.field[0][7] = [{ color: ChessColorsEnum.Black, piece: ChessPiecesEnum.Rook } as any];
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
    chessBoardStateService.boardHelper.history = {};
    for (let i = 1; i <= 100; i++) {
      chessBoardStateService.boardHelper.history[`${i}`] = 'Ng1-f3';
    }

    expect(component.canClaimDraw()).toBeTrue();
  });

  it('shows accept/decline buttons for pending draw offer', () => {
    fixture.detectChanges();

    let offerDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('offer draw'));
    expect(offerDrawButton).toBeDefined();

    offerDrawButton.triggerEventHandler('click', {});
    fixture.detectChanges();

    offerDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('offer draw'));
    const acceptDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('accept draw'));
    const declineDrawButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find(btn => (btn.nativeElement as HTMLButtonElement).textContent.toLowerCase().includes('decline draw'));

    expect(offerDrawButton).toBeUndefined();
    expect(acceptDrawButton).toBeDefined();
    expect(declineDrawButton).toBeDefined();
  });

  it('renders flipped mapping and remapped arrow styles through template bindings', () => {
    chessBoardStateService.field[7][7] = [{ color: ChessColorsEnum.White, piece: ChessPiecesEnum.King } as any];
    chessBoardStateService.boardHelper.arrows = {
      a: {
        top: '25%',
        left: '25%',
        color: 'red',
        length: '20%',
        thickness: '2px',
        rotate: '30deg'
      } as any
    };
    component.isBoardFlipped = true;

    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#field77'))).toBeTruthy();

    const arrowEl = fixture.debugElement.query(By.css('.arrowPointer')).nativeElement as HTMLElement;
    expect(arrowEl.style.top).toBe('75%');
    expect(arrowEl.style.left).toBe('75%');
    expect(arrowEl.style.transform).toContain('rotate(210deg)');
  });

  it('populates drop lists after view init and tears down on destroy', fakeAsync(() => {
    const stopClockSpy = spyOn<any>(component, 'stopClock').and.callThrough();
    fixture.detectChanges();
    tick(0);
    expect(component.dropLists.length).toBeGreaterThan(0);
    fixture.destroy();
    expect(stopClockSpy).toHaveBeenCalled();
  }));
});

describe('ChessBoardComponent template drag-enter integration - theming', () => {
  let fixture: ComponentFixture<ChessBoardComponent>;
  let component: ChessBoardComponent;
  let chessBoardStateService: ChessBoardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChessBoardComponent, DragDropModule],
      providers: [ChessBoardStateService, provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ChessBoardComponent);
    component = fixture.componentInstance;
    chessBoardStateService = TestBed.inject(ChessBoardStateService);
    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.White;
  });

  it('applies animated ambient class for white, black, and pending draw states', () => {
    expect(component.getAmbientThemeClass()).toBe('ambient-math--white-turn');

    chessBoardStateService.boardHelper.colorTurn = ChessColorsEnum.Black;
    expect(component.getAmbientThemeClass()).toBe('ambient-math--black-turn');

    component.offerDraw();
    expect(component.getAmbientThemeClass()).toBe('ambient-math--draw-pending');
  });
});
