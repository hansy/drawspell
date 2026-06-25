import type { Card, CardId, PlayerId, ViewerRole, Zone, ZoneId, ZoneType } from "@/types";

import { ZONE } from "@/constants/zones";
import { canMoveCard } from "@/rules/permissions";
import {
  computeBattlefieldPlacement,
  getEffectiveCardSize,
  type RectLike,
} from "@/lib/dndBattlefield";
import {
  clampCanonicalBattlefieldGroupDelta,
  clampNormalizedToCanonicalBattlefieldBounds,
  fromNormalizedPosition,
  mirrorNormalizedY,
  toNormalizedPosition,
} from "@/lib/positions";

export type GhostCardState = {
  zoneId: ZoneId;
  position: { x: number; y: number };
  tapped?: boolean;
  size?: { width: number; height: number };
};

export type GroupGhostCardState = {
  cardId: CardId;
  zoneId: ZoneId;
  position: { x: number; y: number };
  tapped: boolean;
  size: { width: number; height: number };
};

export type DragMoveUiState = {
  ghostCard: GhostCardState | null;
  overCardScale: number;
  debug?: {
    activeRect?: RectLike | null;
    centerScreen: { x: number; y: number };
    pointerScreen?: { x: number; y: number } | null;
    movementScreen?: { x: number; y: number } | null;
    dragAnchor?: { x: number; y: number } | null;
    pointerProjection:
      | {
          accepted: boolean;
          distance: number;
          tolerance: number;
        }
      | null;
    isTapped: boolean;
    zoneScale: number;
    viewScale: number;
    overRect: RectLike;
    placement: ReturnType<typeof computeBattlefieldPlacement>;
  };
};

export const computeDragMoveUiState = (params: {
  myPlayerId: PlayerId;
  viewerRole?: ViewerRole;
  cards: Record<CardId, Card>;
  zones: Record<ZoneId, Zone>;
  activeCardId?: CardId;
  activeRect?: RectLike | null;
  pointerScreen?: { x: number; y: number } | null;
  movementScreen?: { x: number; y: number } | null;
  dragAnchor?: { x: number; y: number } | null;
  activeTapped?: boolean;
  over:
    | null
    | {
        id: ZoneId;
      type?: ZoneType;
      rect: RectLike;
      scale?: number;
      cardScale?: number;
      cardBaseHeight?: number;
      cardBaseWidth?: number;
      mirrorY?: boolean;
    };
}): DragMoveUiState => {
  if (!params.over) return { ghostCard: null, overCardScale: 1 };

  if (params.over.type !== ZONE.BATTLEFIELD) {
    return { ghostCard: null, overCardScale: 1 };
  }

  const activeCard = params.activeCardId
    ? params.cards[params.activeCardId]
    : undefined;
  if (!activeCard) return { ghostCard: null, overCardScale: 1 };

  const targetZone = params.zones[params.over.id];
  const fromZone = params.zones[activeCard.zoneId];
  if (!targetZone || !fromZone) {
    return { ghostCard: null, overCardScale: 1 };
  }

  const permission = canMoveCard({
    actorId: params.myPlayerId,
    role: params.viewerRole,
    card: activeCard,
    fromZone,
    toZone: targetZone,
  });
  if (!permission.allowed) {
    return { ghostCard: null, overCardScale: 1 };
  }

  const zoneScale = params.over.scale || 1;
  const viewScale = params.over.cardScale || 1;
  const mirrorY = Boolean(params.over.mirrorY);
  const isTapped = Boolean(params.activeTapped ?? activeCard.tapped);
  const overCardScale = viewScale;

  if (!params.activeRect) {
    return { ghostCard: null, overCardScale };
  }

  const centerScreen = {
    x: params.activeRect.left + params.activeRect.width / 2,
    y: params.activeRect.top + params.activeRect.height / 2,
  };
  const pointerProjection = resolvePointerProjection({
    activeRect: params.activeRect,
    pointerScreen: params.pointerScreen,
    dragAnchor: params.dragAnchor,
  });

  const placement = computeBattlefieldPlacement({
    centerScreen,
    pointerScreen: pointerProjection.pointerScreen,
    movementScreen: params.movementScreen ?? undefined,
    dragAnchor: pointerProjection.dragAnchor,
    isTapped,
    mirrorY,
    overRect: params.over.rect,
    viewScale,
    zoneScale,
    baseCardHeight: params.over.cardBaseHeight,
    baseCardWidth: params.over.cardBaseWidth,
  });
  const liveCenterScreen = {
    x: params.over.rect.left + placement.livePosition.x * zoneScale,
    y: params.over.rect.top + placement.livePosition.y * zoneScale,
  };

  return {
    ghostCard: {
      zoneId: targetZone.id,
      position: placement.ghostPosition,
      tapped: isTapped,
      size: { width: placement.cardWidth, height: placement.cardHeight },
    },
    overCardScale,
    debug: {
      activeRect: params.activeRect,
      centerScreen: liveCenterScreen,
      pointerScreen: pointerProjection.pointerScreen ?? null,
      movementScreen: params.movementScreen ?? null,
      dragAnchor: pointerProjection.dragAnchor ?? null,
      pointerProjection: pointerProjection.reliability,
      isTapped,
      zoneScale,
      viewScale,
      overRect: params.over.rect,
      placement,
    },
  };
};

const resolvePointerProjection = (params: {
  activeRect: RectLike;
  pointerScreen?: { x: number; y: number } | null;
  dragAnchor?: { x: number; y: number } | null;
}): {
  pointerScreen?: { x: number; y: number };
  dragAnchor?: { x: number; y: number };
  reliability:
    | {
        accepted: boolean;
        distance: number;
        tolerance: number;
      }
    | null;
} => {
  if (!params.pointerScreen || !params.dragAnchor) {
    return { reliability: null };
  }

  const projectedAnchor = {
    x: params.activeRect.left + params.activeRect.width * params.dragAnchor.x,
    y: params.activeRect.top + params.activeRect.height * params.dragAnchor.y,
  };
  const distance = Math.hypot(
    projectedAnchor.x - params.pointerScreen.x,
    projectedAnchor.y - params.pointerScreen.y
  );
  const tolerance = Math.max(
    240,
    params.activeRect.width * 2,
    params.activeRect.height * 2
  );
  const accepted = distance <= tolerance;

  return {
    pointerScreen: accepted ? params.pointerScreen : undefined,
    dragAnchor: accepted ? params.dragAnchor : undefined,
    reliability: { accepted, distance, tolerance },
  };
};

export const computeBattlefieldGroupGhostCards = (params: {
  groupCardIds: CardId[];
  activeCardId: CardId;
  startPositions: Record<CardId, { x: number; y: number } | undefined>;
  cards: Record<CardId, Pick<Card, "id" | "tapped"> | undefined>;
  targetZoneId: ZoneId;
  activeGhostPosition: { x: number; y: number };
  zoneWidth: number;
  zoneHeight: number;
  mirrorY: boolean;
  viewScale: number;
  baseCardHeight?: number;
  baseCardWidth?: number;
}): GroupGhostCardState[] => {
  if (!params.zoneWidth || !params.zoneHeight) return [];

  const activeStart = params.startPositions[params.activeCardId];
  if (!activeStart) return [];

  const activeGhostView = toNormalizedPosition(
    params.activeGhostPosition,
    params.zoneWidth,
    params.zoneHeight
  );
  const activeGhostCanonical = params.mirrorY
    ? mirrorNormalizedY(activeGhostView)
    : activeGhostView;

  const delta = {
    x: activeGhostCanonical.x - activeStart.x,
    y: activeGhostCanonical.y - activeStart.y,
  };
  const clampedDelta = clampCanonicalBattlefieldGroupDelta({
    movingIds: params.groupCardIds,
    startPositions: params.startPositions,
    delta,
    isTapped: (id) => params.cards[id]?.tapped,
  });

  return params.groupCardIds
    .map((id) => {
      const card = params.cards[id];
      const startPos = params.startPositions[id];
      if (!card || !startPos) return null;

      const candidate = {
        x: startPos.x + clampedDelta.x,
        y: startPos.y + clampedDelta.y,
      };
      const visualSize = getEffectiveCardSize({
        viewScale: params.viewScale,
        isTapped: card.tapped,
        baseCardHeight: params.baseCardHeight,
        baseCardWidth: params.baseCardWidth,
      });
      const target = clampNormalizedToCanonicalBattlefieldBounds(candidate, {
        isTapped: card.tapped,
      });
      const viewNormalized = params.mirrorY ? mirrorNormalizedY(target) : target;
      const position = fromNormalizedPosition(
        viewNormalized,
        params.zoneWidth,
        params.zoneHeight
      );

      return {
        cardId: card.id,
        zoneId: params.targetZoneId,
        position,
        tapped: card.tapped,
        size: { width: visualSize.cardWidth, height: visualSize.cardHeight },
      };
    })
    .filter((value): value is GroupGhostCardState => Boolean(value));
};

export type DragEndPlan =
  | { kind: "none" }
  | { kind: "reorderHand"; zoneId: ZoneId; oldIndex: number; newIndex: number }
  | {
      kind: "moveCard";
      cardId: CardId;
      toZoneId: ZoneId;
      position: { x: number; y: number } | undefined;
    };

export const isPointInsideRect = (
  point: { x: number; y: number },
  rect: RectLike
) =>
  point.x >= rect.left &&
  point.x <= rect.right &&
  point.y >= rect.top &&
  point.y <= rect.bottom;

export const isPointInsideRectVerticalBand = (
  point: { x: number; y: number },
  rect: Pick<RectLike, "top" | "bottom">
) => point.y >= rect.top && point.y <= rect.bottom;

export const getHandEdgeInset = (rect: Pick<RectLike, "width" | "height">) =>
  Math.max(24, Math.min(rect.width / 4, rect.height / 2));

export const computeSameHandEdgePreviewIndex = (params: {
  sourceZone: Pick<Zone, "type"> | null | undefined;
  sourceHandRect: RectLike | null | undefined;
  pointerScreen: { x: number; y: number } | null | undefined;
  cardCount: number;
}) => {
  if (params.sourceZone?.type !== ZONE.HAND) return null;
  if (!params.pointerScreen || !params.sourceHandRect) return null;
  if (params.cardCount <= 1) return null;
  if (!isPointInsideRectVerticalBand(params.pointerScreen, params.sourceHandRect)) {
    return null;
  }

  const edgeInset = getHandEdgeInset(params.sourceHandRect);
  if (params.pointerScreen.x <= params.sourceHandRect.left + edgeInset) {
    return 0;
  }
  if (params.pointerScreen.x >= params.sourceHandRect.right - edgeInset) {
    return params.cardCount - 1;
  }
  return null;
};

export const shouldUseSameHandDropFallback = (params: {
  activeId: string;
  sourceZone: Pick<Zone, "id" | "type"> | null | undefined;
  sourceHandRect: RectLike | null | undefined;
  pointerScreen: { x: number; y: number } | null | undefined;
  over:
    | null
    | undefined
    | {
        id: string;
        zoneId?: ZoneId;
      };
}) => {
  if (params.sourceZone?.type !== ZONE.HAND) return false;
  if (!params.pointerScreen || !params.sourceHandRect) return false;
  if (!isPointInsideRectVerticalBand(params.pointerScreen, params.sourceHandRect)) {
    return false;
  }
  if (!params.over) return true;
  if (params.over.id === params.activeId) return true;
  return params.over.zoneId === params.sourceZone.id;
};

export const computeDragEndPlan = (params: {
  myPlayerId: PlayerId;
  viewerRole?: ViewerRole;
  cards: Record<CardId, Card>;
  zones: Record<ZoneId, Zone>;
  cardId: CardId;
  toZoneId: ZoneId;
  overCardId?: CardId;
  activeRect?: RectLike | null;
  pointerScreen?: { x: number; y: number } | null;
  movementScreen?: { x: number; y: number } | null;
  dragAnchor?: { x: number; y: number } | null;
  overRect?: RectLike | null;
  handZoneRect?: RectLike | null;
  overScale?: number;
  overCardScale?: number;
  overCardBaseHeight?: number;
  overCardBaseWidth?: number;
  releasePreviewPosition?: { x: number; y: number } | null;
  mirrorY?: boolean;
  activeTapped?: boolean;
}): DragEndPlan => {
  const activeCard = params.cards[params.cardId];
  if (!activeCard) return { kind: "none" };

  const targetZone = params.zones[params.toZoneId];
  const fromZone = params.zones[activeCard.zoneId];
  if (!targetZone || !fromZone) return { kind: "none" };

  if (fromZone.id === targetZone.id && targetZone.type === ZONE.HAND) {
    const oldIndex = targetZone.cardIds.indexOf(params.cardId);
    if (oldIndex === -1) return { kind: "none" };

    const handEdgeRect = params.handZoneRect ?? params.overRect;
    if (params.pointerScreen && handEdgeRect) {
      const edgeInset = getHandEdgeInset(handEdgeRect);
      const leftEdge = handEdgeRect.left + edgeInset;
      const rightEdge = handEdgeRect.right - edgeInset;
      const newIndex =
        params.pointerScreen.x <= leftEdge
          ? 0
          : params.pointerScreen.x >= rightEdge
            ? targetZone.cardIds.length - 1
            : null;
      if (newIndex !== null) {
        if (newIndex === oldIndex) return { kind: "none" };
        return { kind: "reorderHand", zoneId: targetZone.id, oldIndex, newIndex };
      }
    }

    if (!params.overCardId || params.cardId === params.overCardId) {
      return { kind: "none" };
    }
    const newIndex = targetZone.cardIds.indexOf(params.overCardId);
    if (newIndex === -1) return { kind: "none" };
    return { kind: "reorderHand", zoneId: targetZone.id, oldIndex, newIndex };
  }

  const permission = canMoveCard({
    actorId: params.myPlayerId,
    role: params.viewerRole,
    card: activeCard,
    fromZone,
    toZone: targetZone,
  });
  if (!permission.allowed) return { kind: "none" };

  if (targetZone.type !== ZONE.BATTLEFIELD) {
    return {
      kind: "moveCard",
      cardId: params.cardId,
      toZoneId: targetZone.id,
      position: undefined,
    };
  }

  if (!params.activeRect || !params.overRect) return { kind: "none" };

  if (params.releasePreviewPosition) {
    return {
      kind: "moveCard",
      cardId: params.cardId,
      toZoneId: targetZone.id,
      position: params.releasePreviewPosition,
    };
  }

  const centerScreen = {
    x: params.activeRect.left + params.activeRect.width / 2,
    y: params.activeRect.top + params.activeRect.height / 2,
  };

  const zoneScale = params.overScale || 1;
  const viewScale = params.overCardScale || 1;
  const isTapped = Boolean(params.activeTapped ?? activeCard.tapped);
  const mirrorY = Boolean(params.mirrorY);
  const pointerProjection = resolvePointerProjection({
    activeRect: params.activeRect,
    pointerScreen: params.pointerScreen,
    dragAnchor: params.dragAnchor,
  });

  const placement = computeBattlefieldPlacement({
    centerScreen,
    pointerScreen: pointerProjection.pointerScreen,
    movementScreen: params.movementScreen ?? undefined,
    dragAnchor: pointerProjection.dragAnchor,
    isTapped,
    mirrorY,
    overRect: params.overRect,
    viewScale,
    zoneScale,
    baseCardHeight: params.overCardBaseHeight,
    baseCardWidth: params.overCardBaseWidth,
  });

  return {
    kind: "moveCard",
    cardId: params.cardId,
    toZoneId: targetZone.id,
    position: placement.snappedCanonical,
  };
};
