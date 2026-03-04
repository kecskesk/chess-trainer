import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiText } from '../../constants/ui-text.constants';

@Component({
  selector: 'app-chess-board-language-tools',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board-language-tools.component.html',
  styleUrls: ['./chess-board-language-tools.component.less']
})
export class ChessBoardLanguageToolsComponent {
  readonly uiText = UiText;
  @Input() selectedLocale = 'en_US';
  @Input() isLanguageSwitching = false;
  @Output() localeChange = new EventEmitter<string>();

  onLocaleClick(locale: string): void {
    this.localeChange.emit(locale);
  }
}
