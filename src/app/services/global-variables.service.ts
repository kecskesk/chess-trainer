import { Injectable } from '@angular/core';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { ChessPieceDto } from '../model/chess-piece.dto';

@Injectable()
export class GlobalVariablesService {
  public static DEBUG_OBJECT: any = {};
  public static CHESS_FIELD: any = {};
}
