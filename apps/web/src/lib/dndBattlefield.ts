import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from './constants';
import {
  clampNormalizedToCanonicalBattlefieldBounds,
  fromNormalizedPosition,
  getCanonicalBattlefieldPlacementGridSteps,
  mirrorNormalizedY,
  toNormalizedPosition,
} from './positions';

export type RectLike = Pick<
  DOMRect,
  'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'
>;

const snapCardEdgeToGrid = (params: {
  center: number;
  size: number;
  step: number;
}) => {
  if (!params.step) return params.center;

  const halfSize = params.size / 2;
  return (
    Math.round((params.center - halfSize) / params.step) * params.step +
    halfSize
  );
};

export const getEffectiveCardSize = (params: {
  viewScale: number;
  isTapped: boolean;
  baseCardHeight?: number;
  baseCardWidth?: number;
}) => {
  const baseCardHeight = params.baseCardHeight ?? BASE_CARD_HEIGHT;
  const baseCardWidth = params.baseCardWidth ?? baseCardHeight * CARD_ASPECT_RATIO;
  const cardWidth = (params.isTapped ? baseCardHeight : baseCardWidth) * params.viewScale;
  const cardHeight = (params.isTapped ? baseCardWidth : baseCardHeight) * params.viewScale;
  return { cardWidth, cardHeight };
};

export const computeAnchoredDragRect = (params: {
  pointerScreen: { x: number; y: number };
  dragAnchor: { x: number; y: number };
  width: number;
  height: number;
  scale?: number;
}) => {
  const scale = params.scale ?? 1;
  const width = params.width * scale;
  const height = params.height * scale;
  const left = params.pointerScreen.x - params.dragAnchor.x * width;
  const top = params.pointerScreen.y - params.dragAnchor.y * height;

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
};

export const computeAnchoredResizeOffset = (params: {
  dragAnchor: { x: number; y: number };
  sourceWidth: number;
  sourceHeight: number;
  sourceOffsetX?: number;
  sourceOffsetY?: number;
  targetWidth: number;
  targetHeight: number;
}) => ({
  x:
    (params.sourceOffsetX ?? 0) +
    params.dragAnchor.x * (params.sourceWidth - params.targetWidth),
  y:
    (params.sourceOffsetY ?? 0) +
    params.dragAnchor.y * (params.sourceHeight - params.targetHeight),
});

export const computeDragOverlayBaseScale = (params: {
  sourceWidth?: number;
  sourceHeight?: number;
  sourceScale?: number;
  baseCardWidth: number;
  baseCardHeight: number;
  isTapped: boolean;
}) => {
  const sourceScale =
    typeof params.sourceScale === "number" && params.sourceScale > 0
      ? params.sourceScale
      : 1;
  const normalizedSourceWidth = (params.sourceWidth ?? 0) / sourceScale;
  const normalizedSourceHeight = (params.sourceHeight ?? 0) / sourceScale;
  const targetWidth = params.isTapped
    ? params.baseCardHeight
    : params.baseCardWidth;
  const targetHeight = params.isTapped
    ? params.baseCardWidth
    : params.baseCardHeight;
  const scaleCandidates = [
    targetWidth > 0 ? normalizedSourceWidth / targetWidth : 0,
    targetHeight > 0 ? normalizedSourceHeight / targetHeight : 0,
  ].filter((value) => Number.isFinite(value) && value > 0);

  if (scaleCandidates.length === 0) return 1;

  return (
    scaleCandidates.reduce((sum, value) => sum + value, 0) /
    scaleCandidates.length
  );
};

export const computeBattlefieldPlacement = (params: {
  centerScreen?: { x: number; y: number };
  pointerScreen?: { x: number; y: number };
  dragAnchor?: { x: number; y: number };
  movementScreen?: { x: number; y: number };
  overRect: RectLike;
  zoneScale: number;
  viewScale: number;
  mirrorY: boolean;
  isTapped: boolean;
  baseCardHeight?: number;
  baseCardWidth?: number;
}) => {
  const safeScale = params.zoneScale || 1;
  const zoneWidth = (params.overRect.width || 0) / safeScale;
  const zoneHeight = (params.overRect.height || 0) / safeScale;

  const { cardWidth, cardHeight } = getEffectiveCardSize({
    isTapped: params.isTapped,
    viewScale: params.viewScale || 1,
    baseCardHeight: params.baseCardHeight,
    baseCardWidth: params.baseCardWidth,
  });
  const centerScreen =
    params.pointerScreen && params.dragAnchor
      ? {
          x:
            params.pointerScreen.x +
            (0.5 - params.dragAnchor.x) * cardWidth * safeScale,
          y:
            params.pointerScreen.y +
            (0.5 - params.dragAnchor.y) * cardHeight * safeScale,
        }
      : params.centerScreen ?? { x: 0, y: 0 };
  const leadScreen = { x: 0, y: 0 };
  const previewCenterScreen = {
    x: centerScreen.x + leadScreen.x,
    y: centerScreen.y + leadScreen.y,
  };

  const livePosition = {
    x: (centerScreen.x - params.overRect.left) / safeScale,
    y: (centerScreen.y - params.overRect.top) / safeScale,
  };
  const previewPosition = {
    x: (previewCenterScreen.x - params.overRect.left) / safeScale,
    y: (previewCenterScreen.y - params.overRect.top) / safeScale,
  };
  const placementGrid = getCanonicalBattlefieldPlacementGridSteps({
    zoneWidth,
    zoneHeight,
    viewScale: params.viewScale || 1,
    baseCardHeight: params.baseCardHeight,
    baseCardWidth: params.baseCardWidth,
  });
  const gridStepX = placementGrid.stepX * zoneWidth;
  const gridStepY = placementGrid.stepY * zoneHeight;
  const snappedViewPosition = {
    x: snapCardEdgeToGrid({
      center: previewPosition.x,
      size: cardWidth,
      step: gridStepX,
    }),
    y: snapCardEdgeToGrid({
      center: previewPosition.y,
      size: cardHeight,
      step: gridStepY,
    }),
  };
  const liveCanonicalNormalized = toNormalizedPosition(
    livePosition,
    zoneWidth,
    zoneHeight
  );
  const previewCanonicalNormalized = toNormalizedPosition(
    previewPosition,
    zoneWidth,
    zoneHeight
  );
  const snappedCanonicalNormalized = toNormalizedPosition(
    snappedViewPosition,
    zoneWidth,
    zoneHeight
  );
  const liveCanonical = params.mirrorY
    ? mirrorNormalizedY(liveCanonicalNormalized)
    : liveCanonicalNormalized;
  const baseCanonical = params.mirrorY
    ? mirrorNormalizedY(previewCanonicalNormalized)
    : previewCanonicalNormalized;
  const previewCanonical = clampNormalizedToCanonicalBattlefieldBounds(
    baseCanonical,
    { isTapped: params.isTapped }
  );
  const baseSnappedCanonical = params.mirrorY
    ? mirrorNormalizedY(snappedCanonicalNormalized)
    : snappedCanonicalNormalized;
  const snappedCanonical = clampNormalizedToCanonicalBattlefieldBounds(
    baseSnappedCanonical,
    { isTapped: params.isTapped }
  );

  const snappedNormalized = params.mirrorY
    ? mirrorNormalizedY(snappedCanonical)
    : snappedCanonical;
  const snappedPosition = fromNormalizedPosition(
    snappedNormalized,
    zoneWidth,
    zoneHeight
  );
  const ghostPosition = snappedPosition;

  return {
    cardWidth,
    cardHeight,
    zoneWidth,
    zoneHeight,
    livePosition,
    liveCanonical,
    leadScreen,
    previewCanonical,
    snappedCanonical,
    ghostPosition,
    snappedPosition,
  };
};
