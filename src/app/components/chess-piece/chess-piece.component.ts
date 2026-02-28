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
}


