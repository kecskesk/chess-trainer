import { AfterViewInit, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ChessPieceDto } from 'src/app/model/chess-piece.dto';
import { GlobalVariablesService } from '../../services/global-variables.service';
import { ChessRulesService } from '../../services/chess-rules.service';

@Component({
  selector: 'app-chess-board',
  templateUrl: './chess-board.component.html',
  styleUrls: ['./chess-board.component.less']
})
export class ChessBoardComponent implements AfterViewInit {
  @ViewChild('chessField') chessField: ElementRef;
  @ViewChildren(CdkDropList) dropListElements: QueryList<CdkDropList>;

  dropLists: CdkDropList[] = undefined;

  constructor(public globalVariablesService: GlobalVariablesService) {}

  ngAfterViewInit(): void {
    if (this.dropListElements) {
      setTimeout(() => {
        this.dropLists = this.dropListElements.toArray();
      }, 0);
    }
  }

  canDrop(drag: CdkDrag<ChessPieceDto[]>, drop: CdkDropList<ChessPieceDto[]>): boolean {
    return ChessRulesService.canStepThere(drag.dropContainer.id, drop.id, drop.data);
  }

  onDrop(event: CdkDragDrop<ChessPieceDto[]>): void {
    // Reset drops and hits
    this.globalVariablesService.debugObj.debugText = '';
    this.globalVariablesService.debugObj.possibles = [];
    this.globalVariablesService.debugObj.hits = [];
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data,
        event.previousIndex,
        event.currentIndex);
    } else {
      // Remove target on hit before moving the item in the container
      if (event.container && event.container.data && event.container.data[0]) {
        const targetId = event.container.id;
        const targetLocSplit = targetId.split('field');
        const targetRow = Number(targetLocSplit[1][0]);
        const targetCell = Number(targetLocSplit[1][1]);

        this.globalVariablesService.field[targetRow][targetCell].splice(0,1);
      }
      transferArrayItem(event.previousContainer.data,
        event.container.data,
        event.previousIndex, event.currentIndex);
    }
  }

  isTarget(id: string): boolean {
    return this.globalVariablesService.debugObj.possibles && this.globalVariablesService.debugObj.possibles.includes(id);
  }

  isHit(id: string): boolean {
    return this.globalVariablesService.debugObj.hits && this.globalVariablesService.debugObj.hits.includes(id);
  }

  translate(idxX: number, idxY: number): string {
    // A = 0 - H = 7
    const letterChar = String.fromCharCode('a'.charCodeAt(0) + idxY);
    // Flip table count bottom-up
    const numberChar = (8 - idxX);
    return `${letterChar}${numberChar}`
  }
}
