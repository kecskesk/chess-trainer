import { Injectable } from '@angular/core';
import { ChessPieceDto } from '../model/chess-piece.dto';

@Injectable()
export class GlobalVariablesService {
  public static DEBUG_OBJECT: any = {};
  public static CHESS_FIELD: any = {};
  debugObj = {
    debugText: '',
    possibles: [],
    hits: [],
    colorTurn: 'white',
    history: [],
    canPromote: null,
    justDidEnPassant: null,
    justDidCastle: null
  };
  field = [
    [[new ChessPieceDto('black', 'rook')], [new ChessPieceDto('black', 'knight')], [new ChessPieceDto('black', 'bishop')], [new ChessPieceDto('black', 'queen')], [new ChessPieceDto('black', 'king')], [new ChessPieceDto('black', 'bishop')], [new ChessPieceDto('black', 'knight')], [new ChessPieceDto('black', 'rook')]],
    [[new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')], [new ChessPieceDto('black', 'pawn')]],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[], [], [], [], [], [], [], []],
    [[new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')], [new ChessPieceDto('white', 'pawn')]],
    [[new ChessPieceDto('white', 'rook')], [new ChessPieceDto('white', 'knight')], [new ChessPieceDto('white', 'bishop')], [new ChessPieceDto('white', 'queen')], [new ChessPieceDto('white', 'king')], [new ChessPieceDto('white', 'bishop')], [new ChessPieceDto('white', 'knight')], [new ChessPieceDto('white', 'rook')]]
  ];

  constructor() {
    GlobalVariablesService.CHESS_FIELD = this.field;
    GlobalVariablesService.DEBUG_OBJECT = this.debugObj;
  }

  static translateNotation(targetRow: number, targetCol: number, srcRow: number, srcCol: number,
                    piece: string, hit: boolean, check: boolean, match: boolean, ep: boolean, castleData: string): string {
    let pieceNotation = GlobalVariablesService.translatePieceNotation(piece);
    // A = 0 - H = 7
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + targetCol);
    const letterCharSrc = String.fromCharCode('a'.charCodeAt(0) + srcCol);
    // Flip table count bottom-up
    const numberChar = (8 - targetRow);
    const numberCharSrc = (8 - srcRow);
    if (castleData) {
      return castleData;
    }
    return `${pieceNotation}${letterCharSrc}${numberCharSrc}${hit ? 'x' : ''}` +
      `${letterChar}${numberChar}${check ? '+' : ''}${match ? '#' : ''}${ep ? ' e.p.' : ''}`;
  }

  static translatePieceNotation(piece: string): string {
    switch(piece) {
      case 'pawn': return '';
      case 'bishop': return 'B';
      case 'king': return 'K';
      case 'queen': return 'Q';
      case 'rook': return 'R';
      case 'knight': return 'N';
    }
  }
}
