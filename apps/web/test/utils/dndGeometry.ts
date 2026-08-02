import { getCanonicalBattlefieldPlacementGridSteps } from "../../src/lib/positions";

export type Point = { x: number; y: number };

export const zoneRect = {
  left: 0,
  top: 0,
  right: 1000,
  bottom: 600,
  width: 1000,
  height: 600,
};

export const measuredCardSizing = {
  baseCardHeight: 135,
  baseCardWidth: 90,
};

type CardSize =
  | { width: number; height: number }
  | { cardWidth: number; cardHeight: number };

const readCardSize = (cardSize: CardSize) =>
  "width" in cardSize
    ? { width: cardSize.width, height: cardSize.height }
    : { width: cardSize.cardWidth, height: cardSize.cardHeight };

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const liveDraggedCenter = (params: {
  pointerScreen: Point;
  dragAnchor: Point;
  cardSize: CardSize;
  zoneScale?: number;
}) => {
  const zoneScale = params.zoneScale ?? 1;
  const cardSize = readCardSize(params.cardSize);
  return {
    x: params.pointerScreen.x + (0.5 - params.dragAnchor.x) * cardSize.width * zoneScale,
    y: params.pointerScreen.y + (0.5 - params.dragAnchor.y) * cardSize.height * zoneScale,
  };
};

export const placementGridPixels = (viewScale = 1) => {
  const steps = getCanonicalBattlefieldPlacementGridSteps({
    zoneWidth: zoneRect.width,
    zoneHeight: zoneRect.height,
    viewScale,
    ...measuredCardSizing,
  });
  return {
    x: steps.stepX * zoneRect.width,
    y: steps.stepY * zoneRect.height,
  };
};

export const gridAlignedCenter = (params: {
  grid: Point;
  cardSize: CardSize;
  xIndex: number;
  yIndex: number;
}) => {
  const cardSize = readCardSize(params.cardSize);
  return {
    x: params.grid.x * params.xIndex + cardSize.width / 2,
    y: params.grid.y * params.yIndex + cardSize.height / 2,
  };
};
