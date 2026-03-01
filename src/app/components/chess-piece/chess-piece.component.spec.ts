import { ChessPieceComponent } from './chess-piece.component';
import { ChessPieceDto } from '../../model/chess-piece.dto';
import { ChessColorsEnum } from '../../model/enums/chess-colors.enum';
import { ChessPiecesEnum } from '../../model/enums/chess-pieces.enum';

describe('ChessPieceComponent', () => {
  let component: ChessPieceComponent;

  beforeEach(() => {
    component = new ChessPieceComponent();
  });

  it('reports style flags', () => {
    component.pieceStyle = 'font-awesome';
    expect(component.isFontAwesome).toBeTrue();
    expect(component.isSprite).toBeFalse();
    expect(component.isAscii).toBeFalse();

    component.pieceStyle = 'sprite-1';
    expect(component.isFontAwesome).toBeFalse();
    expect(component.isSprite).toBeTrue();
    expect(component.isAscii).toBeFalse();

    component.pieceStyle = 'ascii';
    expect(component.isFontAwesome).toBeFalse();
    expect(component.isSprite).toBeFalse();
    expect(component.isAscii).toBeTrue();
  });

  it('returns sprite class and computed sprite positions', () => {
    component.piece = undefined as any;
    expect(component.spriteStyle['background-position']).toBe('0% 0%');

    component.piece = new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King);
    expect(component.spriteClassName).toBe('piece-sprite--sheet1');
    expect(component.spriteStyle['background-position']).toBe('0% 0%');

    component.piece = new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn);
    expect(component.spriteStyle['background-position']).toBe('100% 100%');

    component.piece = { color: ChessColorsEnum.White, piece: 'unknown' as ChessPiecesEnum } as ChessPieceDto;
    expect(component.spriteStyle['background-position']).toBe('0% 0%');
  });

  it('returns ascii class and all symbols', () => {
    component.piece = new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.King);
    expect(component.asciiClassName).toBe('ascii-piece ascii-piece--white');
    expect(component.asciiSymbol).toBe('\u2654');

    component.piece = new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.King);
    expect(component.asciiClassName).toBe('ascii-piece ascii-piece--black');
    expect(component.asciiSymbol).toBe('\u265A');

    component.piece = new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Queen);
    expect(component.asciiSymbol).toBe('\u2655');
    component.piece = new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Queen);
    expect(component.asciiSymbol).toBe('\u265B');

    component.piece = new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Rook);
    expect(component.asciiSymbol).toBe('\u2656');
    component.piece = new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Rook);
    expect(component.asciiSymbol).toBe('\u265C');

    component.piece = new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Bishop);
    expect(component.asciiSymbol).toBe('\u2657');
    component.piece = new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Bishop);
    expect(component.asciiSymbol).toBe('\u265D');

    component.piece = new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Knight);
    expect(component.asciiSymbol).toBe('\u2658');
    component.piece = new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Knight);
    expect(component.asciiSymbol).toBe('\u265E');

    component.piece = new ChessPieceDto(ChessColorsEnum.White, ChessPiecesEnum.Pawn);
    expect(component.asciiSymbol).toBe('\u2659');
    component.piece = new ChessPieceDto(ChessColorsEnum.Black, ChessPiecesEnum.Pawn);
    expect(component.asciiSymbol).toBe('\u265F');

    component.piece = { color: ChessColorsEnum.White, piece: 'unknown' as ChessPiecesEnum } as ChessPieceDto;
    expect(component.asciiSymbol).toBe('');
  });
});
