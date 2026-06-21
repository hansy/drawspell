import type { Card, PlayerId } from '@/types';

import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from '@/lib/constants';
import {
  fromNormalizedPosition,
  getCanonicalBattlefieldPlacementGridSteps,
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
  const placementSteps = getCanonicalBattlefieldPlacementGridSteps({
    zoneWidth: params.zoneWidth,
    zoneHeight: params.zoneHeight,
    viewScale: params.viewScale,
    baseCardHeight: params.baseCardHeight,
    baseCardWidth: params.baseCardWidth,
  });
  const gridStepX = params.zoneWidth * placementSteps.stepX;
  const gridStepY = params.zoneHeight * placementSteps.stepY;

  return {
    gridStepX,
    gridStepY,
    originOffsetX: positiveModulo(0, gridStepX),
    originOffsetY: positiveModulo(0, gridStepY),
  };
};
