import { IVisualizationArrow } from '../model/interfaces/visualization-arrow.interface';

export class ChessBoardOverlayFacade {
  static applyOverlayTool(params: {
    activeTool: string | null;
    key: string;
    clearOverlay: () => void;
    buildArrows: () => IVisualizationArrow[];
    addArrow: (arrow: IVisualizationArrow) => void;
    setActiveTool: (key: string | null) => void;
    setActiveWhenEmpty?: boolean;
  }): void {
    const {
      activeTool,
      key,
      clearOverlay,
      buildArrows,
      addArrow,
      setActiveTool,
      setActiveWhenEmpty = true
    } = params;

    if (activeTool === key) {
      clearOverlay();
      return;
    }

    clearOverlay();
    const arrows = buildArrows();
    arrows.forEach(addArrow);
    if (setActiveWhenEmpty || arrows.length > 0) {
      setActiveTool(key);
    }
  }
}

