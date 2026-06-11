import type { Card, PlayerId } from '@/types';

import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from '@/lib/constants';
import {
  fromNormalizedPosition,
  getCanonicalBattlefieldGridSteps,
  getCanonicalCardPixelSize,
  getCardPixelSize,
  LEGACY_BATTLEFIELD_HEIGHT,
  LEGACY_BATTLEFIELD_WIDTH,
  mirrorNormalizedY,
} from '@/lib/positions';

export type BattlefieldCardLayout = {
  left: number;
  top: number;
  highlightColor?: string;
  disableDrag: boolean;
};

export type BattlefieldGridProjection = {
  gridStepX: number;
  gridStepY: number;
  originOffsetX: number;
  originOffsetY: number;
};

const positiveModulo = (value: number, divisor: number) => {
  if (!divisor) return 0;
  return ((value % divisor) + divisor) % divisor;
};

export const computeBattlefieldCardLayout = (params: {
  card: Card;
  zoneOwnerId: PlayerId;
  viewerPlayerId: PlayerId;
  zoneWidth: number;
  zoneHeight: number;
  mirrorBattlefieldY: boolean;
  playerColors: Record<string, string>;
  baseCardHeight?: number;
  baseCardWidth?: number;
}): BattlefieldCardLayout => {
  const { card, zoneOwnerId, viewerPlayerId, mirrorBattlefieldY, playerColors } = params;

  const viewPosition = mirrorBattlefieldY ? mirrorNormalizedY(card.position) : card.position;
  const { x, y } = fromNormalizedPosition(
    viewPosition,
    params.zoneWidth || 1,
    params.zoneHeight || 1
  );

  const baseHeight = params.baseCardHeight ?? BASE_CARD_HEIGHT;
  const baseWidth = params.baseCardWidth ?? baseHeight * CARD_ASPECT_RATIO;
  const left = x - baseWidth / 2;
  const top = y - baseHeight / 2;

  const highlightColor = card.ownerId !== zoneOwnerId ? playerColors[card.ownerId] : undefined;
  const canDrag = card.controllerId === viewerPlayerId || card.ownerId === viewerPlayerId;
  const disableDrag = !canDrag;

  return { left, top, highlightColor, disableDrag };
};

export const computeBattlefieldGridProjection = (params: {
  zoneWidth: number;
  zoneHeight: number;
  viewScale: number;
  isTapped?: boolean;
  baseCardHeight?: number;
  baseCardWidth?: number;
}): BattlefieldGridProjection => {
  const canonicalSteps = getCanonicalBattlefieldGridSteps({
    isTapped: params.isTapped,
  });
  const gridStepX = params.zoneWidth * canonicalSteps.stepX;
  const gridStepY = params.zoneHeight * canonicalSteps.stepY;
  const {
    cardWidth: canonicalCardWidth,
    cardHeight: canonicalCardHeight,
  } = getCanonicalCardPixelSize({
    isTapped: params.isTapped,
  });
  const { cardWidth, cardHeight } = getCardPixelSize({
    viewScale: params.viewScale,
    isTapped: params.isTapped,
    baseCardHeight: params.baseCardHeight,
    baseCardWidth: params.baseCardWidth,
  });

  return {
    gridStepX,
    gridStepY,
    originOffsetX: positiveModulo(
      (canonicalCardWidth / 2 / LEGACY_BATTLEFIELD_WIDTH) * params.zoneWidth -
        cardWidth / 2,
      gridStepX
    ),
    originOffsetY: positiveModulo(
      (canonicalCardHeight / 2 / LEGACY_BATTLEFIELD_HEIGHT) * params.zoneHeight -
        cardHeight / 2,
      gridStepY
    ),
  };
};
