import { Component, Input } from '@angular/core';
import { ChessPieceDto } from '../../model/chess-piece.dto';

@Component({
  selector: 'app-chess-piece',
  templateUrl: './chess-piece.component.html',
  styleUrls: ['./chess-piece.component.less']
})
export class ChessPieceComponent {
  @Input()
  piece: ChessPieceDto;
}
