export type TouchContextMenuPressState = {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  target: HTMLDivElement;
  moved: boolean;
};
