import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from './constants';
import {
  clampNormalizedToCanonicalBattlefieldBounds,
  fromNormalizedPosition,
  mirrorNormalizedY,
  snapNormalizedToCanonicalBattlefieldGrid,
  toNormalizedPosition,
} from './positions';

export type RectLike = Pick<
  DOMRect,
  'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'
>;

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

export const computeBattlefieldPlacement = (params: {
  centerScreen?: { x: number; y: number };
  pointerScreen?: { x: number; y: number };
  dragAnchor?: { x: number; y: number };
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

  const unsnappedPos = {
    x: (centerScreen.x - params.overRect.left) / safeScale,
    y: (centerScreen.y - params.overRect.top) / safeScale,
  };
  const unsnappedCanonicalNormalized = toNormalizedPosition(
    unsnappedPos,
    zoneWidth,
    zoneHeight
  );
  const baseCanonical = params.mirrorY
    ? mirrorNormalizedY(unsnappedCanonicalNormalized)
    : unsnappedCanonicalNormalized;
  const previewCanonical = clampNormalizedToCanonicalBattlefieldBounds(
    baseCanonical,
    { isTapped: params.isTapped }
  );
  const snappedCanonical = snapNormalizedToCanonicalBattlefieldGrid(
    baseCanonical,
    { isTapped: params.isTapped }
  );

  const ghostNormalized = params.mirrorY
    ? mirrorNormalizedY(snappedCanonical)
    : snappedCanonical;
  const ghostPosition = fromNormalizedPosition(ghostNormalized, zoneWidth, zoneHeight);

  return {
    cardWidth,
    cardHeight,
    zoneWidth,
    zoneHeight,
    previewCanonical,
    snappedCanonical,
    ghostPosition,
  };
};
