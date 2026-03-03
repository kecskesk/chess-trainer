import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';

@Component({
  selector: 'app-chess-board-position-key',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-position-key.component.html',
  styleUrls: ['./chess-board-position-key.component.less']
})
export class ChessBoardPositionKeyComponent {
  @Input() uiText: typeof UiText = UiText;
  @Input() boardHelper: { debugText?: string } | null = null;
  @Input() isDebugPanelOpen = false;
  @Input() debugPositionKey = '';
  @Output() debugPanelToggle = new EventEmitter<boolean>();

  onToggle(event: Event): void {
    const detailsElement = event && event.target ? event.target as HTMLDetailsElement : null;
    this.debugPanelToggle.emit(!!(detailsElement && detailsElement.open));
  }
}
