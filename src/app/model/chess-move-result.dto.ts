export class ChessMoveResultDto {
  constructor(public canDrop: boolean,
              public canHit: boolean,
              public canCheck: boolean,
              public targetEmpty: boolean) {}
}
