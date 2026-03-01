import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChessPieceDto } from '../../model/chess-piece.dto';

@Component({
  selector: 'app-chess-piece',
  templateUrl: './chess-piece.component.html',
  styleUrls: ['./chess-piece.component.less'],
  standalone: true,
  imports: [CommonModule]
})
export class ChessPieceComponent {
  @Input()
  piece: ChessPieceDto;

  @Input()
  pieceStyle: 'font-awesome' | 'sprite-1' | 'ascii' = 'font-awesome';

  private static readonly SPRITE1_PIECE_ORDER: Record<string, number> = {
    king: 0,
    queen: 1,
    bishop: 2,
    knight: 3,
    rook: 4,
    pawn: 5
  };

  get isFontAwesome(): boolean {
    return this.pieceStyle === 'font-awesome';
  }

  get isSprite(): boolean {
    return this.pieceStyle === 'sprite-1';
  }

  get isAscii(): boolean {
    return this.pieceStyle === 'ascii';
  }

  get spriteClassName(): string {
    return 'piece-sprite--sheet1';
  }

  get spriteStyle(): { [key: string]: string } {
    const pieceType = this.piece && this.piece.piece ? this.piece.piece : '';
    const spriteColumns = 6;
    const colIndex = ChessPieceComponent.SPRITE1_PIECE_ORDER[pieceType] ?? 0;
    const rowIndex = this.piece?.color === 'black' ? 1 : 0;
    const xPercent = (colIndex * 100) / (spriteColumns - 1);
    const yPercent = rowIndex * 100;
    return {
      'background-position': `${xPercent}% ${yPercent}%`
    };
  }

  get asciiClassName(): string {
    return this.piece?.color === 'black' ? 'ascii-piece ascii-piece--black' : 'ascii-piece ascii-piece--white';
  }

  get asciiSymbol(): string {
    const isBlack = this.piece?.color === 'black';
    switch (this.piece?.piece) {
      case 'king':
        return isBlack ? '\u265A' : '\u2654';
      case 'queen':
        return isBlack ? '\u265B' : '\u2655';
      case 'rook':
        return isBlack ? '\u265C' : '\u2656';
      case 'bishop':
        return isBlack ? '\u265D' : '\u2657';
      case 'knight':
        return isBlack ? '\u265E' : '\u2658';
      case 'pawn':
        return isBlack ? '\u265F' : '\u2659';
      default:
        return '';
    }
  }
}
