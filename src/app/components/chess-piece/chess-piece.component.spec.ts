import { TestBed, async } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChessPieceComponent } from './chess-piece.component';

describe('ChessPieceComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule
      ],
      declarations: [
        ChessPieceComponent
      ],
    }).compileComponents();
  }));
});
