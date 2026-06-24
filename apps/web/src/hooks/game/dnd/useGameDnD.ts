import React from "react";
import {
  useSensor,
  useSensors,
  MouseSensor,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import { useGameStore } from "@/store/gameStore";
import { useDragStore } from "@/store/dragStore";
import { useSelectionStore } from "@/store/selectionStore";
import type { CardId, ViewerRole, ZoneId } from "@/types";
import {
  computeBattlefieldGroupGhostCards,
  computeDragEndPlan,
  computeDragMoveUiState,
  computeSameHandEdgePreviewIndex,
  shouldUseSameHandDropFallback,
} from "./model";
import { commitDragFrameStoreUpdate } from "./commit";
import {
  clampCanonicalBattlefieldGroupDelta,
  clampNormalizedToCanonicalBattlefieldBounds,
} from "@/lib/positions";
import { ZONE } from "@/constants/zones";
import { resolveSelectedCardIds } from "@/models/game/selection/selectionModel";
import {
  filterPendingDropVisualClaims,
  shouldRetainPendingDropVisualClaim,
  type PendingDropVisualClaim,
} from "@/lib/dndVisualOwnership";
import {
  debugLog,
  isDebugEnabled,
  summarizeDndCardGeometry,
  summarizeDragOverlayCardElement,
  summarizeCardElement,
  summarizeDragOverlayElement,
  summarizeGhostElement,
  summarizeRect,
  summarizeRectPointerRelation,
  summarizeZoneElement,
  type DebugFlagKey,
} from "@/lib/debug";
import {
  PrimedTouchSensor,
  TOUCH_CONTEXT_MENU_LONG_PRESS_MS,
  TOUCH_DRAG_PRIME_DELAY_MS,
} from "./primedTouchSensor";

const FACE_DOWN_DEBUG_KEY: DebugFlagKey = "faceDownDrag";
const BATTLEFIELD_DND_DEBUG_KEY: DebugFlagKey = "battlefieldDnd";

const DEFAULT_DRAG_TRANSFORM_ORIGIN = "50% 50%";

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const getEventCoordinates = (event: Event) => {
  const eventLike = event as Event & {
    clientX?: unknown;
    clientY?: unknown;
  };
  if (
    typeof eventLike.clientX === "number" &&
    typeof eventLike.clientY === "number"
  ) {
    return { x: eventLike.clientX, y: eventLike.clientY };
  }
  if (typeof MouseEvent !== "undefined" && event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return null;
};

const computeDragTransformOrigin = (
  event: Event,
  rect: { left: number; top: number; width: number; height: number } | null
) => {
  const anchor = computeDragAnchor(event, rect);
  if (!anchor) return DEFAULT_DRAG_TRANSFORM_ORIGIN;
  return `${anchor.x * 100}% ${anchor.y * 100}%`;
};

const computeDragAnchor = (
  event: Event,
  rect: { left: number; top: number; width: number; height: number } | null
) => {
  const coordinates = getEventCoordinates(event);
  if (!coordinates || !rect?.width || !rect.height) {
    return null;
  }
  return {
    x: clampPercent(((coordinates.x - rect.left) / rect.width) * 100) / 100,
    y: clampPercent(((coordinates.y - rect.top) / rect.height) * 100) / 100,
  };
};

const getCurrentPointerScreen = (params: {
  activatorEvent: Event;
  delta: { x: number; y: number };
}) => {
  const start = getEventCoordinates(params.activatorEvent);
  if (!start) return null;
  return {
    x: start.x + params.delta.x,
    y: start.y + params.delta.y,
  };
};

const escapeSelectorValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const pendingDropClaimKey = (claim: PendingDropVisualClaim) =>
  `${claim.cardId}:${claim.sourceZoneId}:${claim.targetZoneId}`;
const PENDING_DROP_SOURCE_STYLE_ID = "__drawspell-pending-drop-source-style";

const isPendingDropSourceStillRendered = (claim: PendingDropVisualClaim) => {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      `[data-zone-id="${escapeSelectorValue(claim.sourceZoneId)}"] [data-card-id="${escapeSelectorValue(claim.cardId)}"]`
    )
  );
};

const isPendingDropTargetRendered = (claim: PendingDropVisualClaim) => {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      `[data-zone-id="${escapeSelectorValue(claim.targetZoneId)}"] [data-card-id="${escapeSelectorValue(claim.cardId)}"]`
    )
  );
};

const getPendingDropSourceElements = (claim: PendingDropVisualClaim) => {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll(
      `[data-zone-id="${escapeSelectorValue(claim.sourceZoneId)}"] [data-card-id="${escapeSelectorValue(claim.cardId)}"]`
    )
  ).filter((node): node is HTMLElement => node instanceof HTMLElement);
};

const suppressPendingDropSourceElements = (
  claims: PendingDropVisualClaim[]
) => {
  if (typeof document !== "undefined") {
    let styleNode = document.getElementById(PENDING_DROP_SOURCE_STYLE_ID);
    if (!styleNode) {
      styleNode = document.createElement("style");
      styleNode.id = PENDING_DROP_SOURCE_STYLE_ID;
      document.head.appendChild(styleNode);
    }
    styleNode.textContent = claims
      .map(
        (claim) =>
          `[data-zone-id="${escapeSelectorValue(claim.sourceZoneId)}"] [data-card-id="${escapeSelectorValue(claim.cardId)}"]{opacity:0!important;}`
      )
      .join("\n");
  }
  claims.forEach((claim) => {
    getPendingDropSourceElements(claim).forEach((node) => {
      node.dataset.dndSourceSuppressed = "true";
      node.classList.add("opacity-0");
    });
  });
};

const releasePendingDropSourceElements = (
  claims: PendingDropVisualClaim[]
) => {
  claims.forEach((claim) => {
    getPendingDropSourceElements(claim).forEach((node) => {
      delete node.dataset.dndSourceSuppressed;
      node.classList.remove("opacity-0");
    });
  });
  if (typeof document !== "undefined") {
    const retainedClaims = useDragStore
      .getState()
      .pendingDropVisualClaims.filter(
        (claim) =>
          !claims.some(
            (released) =>
              pendingDropClaimKey(released) === pendingDropClaimKey(claim)
          )
      );
    const styleNode = document.getElementById(PENDING_DROP_SOURCE_STYLE_ID);
    if (styleNode) {
      styleNode.textContent = retainedClaims
        .map(
          (claim) =>
            `[data-zone-id="${escapeSelectorValue(claim.sourceZoneId)}"] [data-card-id="${escapeSelectorValue(claim.cardId)}"]{opacity:0!important;}`
        )
        .join("\n");
      if (!styleNode.textContent) {
        styleNode.remove();
      }
    }
  }
};

const getCardElementRect = (cardId: string) => {
  if (typeof document === "undefined") return null;
  const node = document.querySelector(
    `[data-card-id="${escapeSelectorValue(cardId)}"]`
  );
  if (!(node instanceof HTMLElement)) return null;
  return node.getBoundingClientRect();
};

const getDraggableSourceElementRect = (cardId: string) => {
  if (typeof document === "undefined") return null;
  const handSortableNode = document.querySelector(
    `[data-dnd-hand-sortable-card-id="${escapeSelectorValue(cardId)}"]`
  );
  if (handSortableNode instanceof HTMLElement) {
    return handSortableNode.getBoundingClientRect();
  }
  return getCardElementRect(cardId);
};

const getZoneElementRect = (zoneId: string) => {
  if (typeof document === "undefined") return null;
  const node = document.querySelector(
    `[data-zone-id="${escapeSelectorValue(zoneId)}"]`
  );
  if (!(node instanceof HTMLElement)) return null;
  return node.getBoundingClientRect();
};

const summarizeRectLike = (
  rect:
    | { left: number; top: number; right: number; bottom: number; width: number; height: number }
    | null
    | undefined
) => (rect ? summarizeRect(rect) : null);

const pointDelta = (
  from: { x: number; y: number } | null | undefined,
  to: { x: number; y: number } | null | undefined
) => {
  if (!from || !to) return null;
  const delta = {
    x: to.x - from.x,
    y: to.y - from.y,
  };
  return {
    ...delta,
    distance: Math.hypot(delta.x, delta.y),
  };
};

const localBattlefieldPointToScreen = (
  point: { x: number; y: number } | null | undefined,
  overRect: { left: number; top: number } | null | undefined,
  zoneScale: number
) => {
  if (!point || !overRect) return null;
  return {
    x: overRect.left + point.x * zoneScale,
    y: overRect.top + point.y * zoneScale,
  };
};

const queueDebugFrame = (
  event: string,
  getPayload: () => Record<string, unknown>
) => {
  if (!isDebugEnabled(BATTLEFIELD_DND_DEBUG_KEY)) return;
  if (typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    debugLog(BATTLEFIELD_DND_DEBUG_KEY, event, getPayload());
  });
};

const queueDebugTimeout = (
  event: string,
  getPayload: () => Record<string, unknown>,
  delayMs = 250
) => {
  if (!isDebugEnabled(BATTLEFIELD_DND_DEBUG_KEY)) return;
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    debugLog(BATTLEFIELD_DND_DEBUG_KEY, event, getPayload());
  }, delayMs);
};

const getInitialBattlefieldGroupGhostCards = (params: {
  cardIds: CardId[];
  cards: ReturnType<typeof useGameStore.getState>["cards"];
  zoneId: ZoneId;
}) => {
  if (typeof document === "undefined") return null;
  const zoneNode = document.querySelector(
    `[data-zone-id="${escapeSelectorValue(params.zoneId)}"]`
  );
  if (!(zoneNode instanceof HTMLElement)) return null;

  const zoneRect = zoneNode.getBoundingClientRect();
  const ghostCards = params.cardIds
    .map((cardId) => {
      const card = params.cards[cardId];
      const cardNode = zoneNode.querySelector(
        `[data-card-id="${escapeSelectorValue(cardId)}"]`
      );
      if (!card || !(cardNode instanceof HTMLElement)) return null;
      const cardRect = cardNode.getBoundingClientRect();
      return {
        cardId,
        zoneId: params.zoneId,
        position: {
          x: cardRect.left - zoneRect.left + cardRect.width / 2,
          y: cardRect.top - zoneRect.top + cardRect.height / 2,
        },
        tapped: card.tapped,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  return ghostCards.length === params.cardIds.length ? ghostCards : null;
};

export const useGameDnD = (params: { viewerRole?: ViewerRole } = {}) => {
  const moveCard = useGameStore((state) => state.moveCard);
  const reorderZoneCards = useGameStore((state) => state.reorderZoneCards);
  const setGhostCards = useDragStore((state) => state.setGhostCards);
  const setActiveCardId = useDragStore((state) => state.setActiveCardId);
  const setHandDragPreview = useDragStore((state) => state.setHandDragPreview);
  const setActiveCardScale = useDragStore((state) => state.setActiveCardScale);
  const setActiveCardTransformOrigin = useDragStore(
    (state) => state.setActiveCardTransformOrigin
  );
  const setActiveCardDragAnchor = useDragStore(
    (state) => state.setActiveCardDragAnchor
  );
  const setActiveCardSourceSize = useDragStore(
    (state) => state.setActiveCardSourceSize
  );
  const setPendingDropVisualClaims = useDragStore(
    (state) => state.setPendingDropVisualClaims
  );
  const clearPendingDropVisualClaims = useDragStore(
    (state) => state.clearPendingDropVisualClaims
  );
  const setIsGroupDragging = useDragStore((state) => state.setIsGroupDragging);
  const setOverCardScale = useDragStore((state) => state.setOverCardScale);
  const myPlayerId = useGameStore((state) => state.myPlayerId);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const isSpectator = params.viewerRole === "spectator";

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(PrimedTouchSensor, {
      primeDelayMs: TOUCH_DRAG_PRIME_DELAY_MS,
      contextMenuDelayMs: TOUCH_CONTEXT_MENU_LONG_PRESS_MS,
    })
  );

  const dragSeq = React.useRef(0);
  const currentDragSeq = React.useRef<number | null>(null);
  const loggedMissingGhostRef = React.useRef(false);
  const dragSelectionRef = React.useRef<{
    activeCardId: CardId;
    groupCardIds: CardId[];
    startPositions: Record<CardId, { x: number; y: number }>;
    startZoneId: ZoneId;
  } | null>(null);
  const dragAnchorRef = React.useRef<{ x: number; y: number } | null>(null);
  const lastSingleBattlefieldPreviewRef = React.useRef<{
    cardId: CardId;
    toZoneId: ZoneId;
    position: { x: number; y: number };
  } | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    if (isSpectator) return;
    currentDragSeq.current = ++dragSeq.current;
    dragSelectionRef.current = null;
    dragAnchorRef.current = null;
    lastSingleBattlefieldPreviewRef.current = null;
    loggedMissingGhostRef.current = false;

    releasePendingDropSourceElements(
      useDragStore.getState().pendingDropVisualClaims
    );
    setGhostCards(null);
    setHandDragPreview(null);
    clearPendingDropVisualClaims();
    setActiveCardTransformOrigin(DEFAULT_DRAG_TRANSFORM_ORIGIN);
    setActiveCardDragAnchor(null);
    setActiveCardSourceSize(null);
    setIsGroupDragging(false);
    if (event.active.data.current?.cardId) {
      const cardId = event.active.data.current.cardId as CardId;
      setActiveCardId(cardId);
      const cardScale =
        typeof event.active.data.current.cardScale === "number"
          ? event.active.data.current.cardScale
          : 1;
      setActiveCardScale(cardScale);
      const visibleSourceRect = getCardElementRect(cardId);
      const activeInitialRect =
        visibleSourceRect ?? event.active.rect.current.initial ?? null;
      const draggableSourceRect =
        getDraggableSourceElementRect(cardId) ??
        event.active.rect.current.initial ??
        visibleSourceRect;
      const activatorPointer = getEventCoordinates(event.activatorEvent);
      dragAnchorRef.current = computeDragAnchor(
        event.activatorEvent,
        activeInitialRect
      );
      setActiveCardDragAnchor(dragAnchorRef.current);
      setActiveCardSourceSize(
        visibleSourceRect
          ? {
              width: visibleSourceRect.width,
              height: visibleSourceRect.height,
              offsetX: draggableSourceRect
                ? visibleSourceRect.left - draggableSourceRect.left
                : 0,
              offsetY: draggableSourceRect
                ? visibleSourceRect.top - draggableSourceRect.top
                : 0,
            }
          : null
      );
      setActiveCardTransformOrigin(
        computeDragTransformOrigin(
          event.activatorEvent,
          activeInitialRect
        )
      );

      const state = useGameStore.getState();
      const activeCard = state.cards[cardId];
      if (!activeCard) return;
      const activeZone = state.zones[activeCard.zoneId];
      debugLog(BATTLEFIELD_DND_DEBUG_KEY, "drag-start", {
        seq: currentDragSeq.current,
        cardId,
        activatorPointer,
        dragAnchor: dragAnchorRef.current,
        activeRectInitial: summarizeRectLike(event.active.rect.current.initial),
        activeInitialPointerRelation: summarizeRectPointerRelation(
          summarizeRectLike(activeInitialRect),
          activatorPointer,
          dragAnchorRef.current
        ),
        activeRectTranslated: summarizeRectLike(event.active.rect.current.translated),
        activeData: {
          zoneId: event.active.data.current?.zoneId,
          cardScale: event.active.data.current?.cardScale,
          tapped: event.active.data.current?.tapped,
        },
        cardScale,
        sourceGeometry: {
          visibleSourceRect: summarizeRectLike(visibleSourceRect),
          draggableSourceRect: summarizeRectLike(draggableSourceRect),
          sourceOffset:
            visibleSourceRect && draggableSourceRect
              ? {
                  x: visibleSourceRect.left - draggableSourceRect.left,
                  y: visibleSourceRect.top - draggableSourceRect.top,
                }
              : null,
        },
        sourceZone: activeZone
          ? {
              id: activeZone.id,
              type: activeZone.type,
              ownerId: activeZone.ownerId,
            }
          : null,
        cardState: {
          zoneId: activeCard.zoneId,
          position: activeCard.position,
          tapped: activeCard.tapped,
          rotation: activeCard.rotation,
          faceDown: activeCard.faceDown,
        },
        cardElement: summarizeCardElement(cardId),
        zoneElement: summarizeZoneElement(activeCard.zoneId),
        dndGeometry: summarizeDndCardGeometry(cardId, {
          pointer: activatorPointer,
          dragAnchor: dragAnchorRef.current,
        }),
      });
      if (activeCard.faceDown) {
        debugLog(FACE_DOWN_DEBUG_KEY, "drag-start", {
          cardId,
          zoneId: activeCard.zoneId,
          position: activeCard.position,
          tapped: activeCard.tapped,
        });
      }

      const selectionState = useSelectionStore.getState();
      const groupIds = resolveSelectedCardIds({
        seedCardId: cardId,
        cardsById: state.cards,
        selection: selectionState,
        minCount: 2,
        fallbackToSeed: true,
      });

      if (groupIds.length > 1) {
        setIsGroupDragging(true);
        const startPositions: Record<CardId, { x: number; y: number }> = {};
        groupIds.forEach((id) => {
          const card = state.cards[id];
          if (card) startPositions[id] = card.position;
        });
        dragSelectionRef.current = {
          activeCardId: cardId,
          groupCardIds: groupIds,
          startPositions,
          startZoneId: activeCard.zoneId,
        };
        const startZone = state.zones[activeCard.zoneId];
        if (startZone?.type === ZONE.BATTLEFIELD) {
          setGhostCards(
            getInitialBattlefieldGroupGhostCards({
              cardIds: groupIds,
              cards: state.cards,
              zoneId: activeCard.zoneId,
            })
          );
        }
      }
    }
  };

  const handleDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      handleDragMoveImpl(event);
    },
    [
      isSpectator,
      myPlayerId,
      params.viewerRole,
      setGhostCards,
      setHandDragPreview,
      setOverCardScale,
    ]
  );

  const handleDragMoveImpl = (event: DragMoveEvent) => {
    if (isSpectator) {
      setGhostCards(null);
      setOverCardScale(1);
      return;
    }
    if (currentDragSeq.current == null) {
      return;
    }

    const state = useGameStore.getState();
    const { active, over } = event;

    const activeCardId = active.data.current?.cardId as CardId | undefined;
    const activeCard = activeCardId ? state.cards[activeCardId] : undefined;
    const pointerScreen = getCurrentPointerScreen({
      activatorEvent: event.activatorEvent,
      delta: event.delta,
    });
    const activeSourceZone = activeCard ? state.zones[activeCard.zoneId] : null;
    const handPreviewTargetIndex = computeSameHandEdgePreviewIndex({
      sourceZone: activeSourceZone,
      sourceHandRect:
        activeSourceZone?.type === ZONE.HAND
          ? getZoneElementRect(activeSourceZone.id)
          : null,
      pointerScreen,
      cardCount: activeSourceZone?.cardIds.length ?? 0,
    });
    setHandDragPreview(
      activeCardId && activeSourceZone?.type === ZONE.HAND && handPreviewTargetIndex !== null
        ? {
            cardId: activeCardId,
            zoneId: activeSourceZone.id,
            targetIndex: handPreviewTargetIndex,
          }
        : null
    );

    const result = computeDragMoveUiState({
      myPlayerId,
      viewerRole: params.viewerRole,
      cards: state.cards,
      zones: state.zones,
      activeCardId,
      activeRect: active.rect.current?.translated,
      pointerScreen,
      movementScreen: event.delta,
      dragAnchor: dragAnchorRef.current,
      activeTapped: Boolean(active.data.current?.tapped),
      over: over
        ? {
            id: over.id as ZoneId,
            type: over.data.current?.type,
            rect: over.rect,
            scale: over.data.current?.scale,
            cardScale: over.data.current?.cardScale,
            cardBaseHeight: over.data.current?.cardBaseHeight,
            cardBaseWidth: over.data.current?.cardBaseWidth,
            mirrorY: Boolean(over.data.current?.mirrorY),
          }
        : null,
    });
    const placementRelations = result.debug
      ? (() => {
          const zoneScale = result.debug.zoneScale || 1;
          const ghostScreenCenter = localBattlefieldPointToScreen(
            result.debug.placement.ghostPosition,
            result.debug.overRect,
            zoneScale
          );
          const snappedScreenCenter = localBattlefieldPointToScreen(
            result.debug.placement.snappedPosition,
            result.debug.overRect,
            zoneScale
          );
          const livePositionScreenCenter = localBattlefieldPointToScreen(
            result.debug.placement.livePosition,
            result.debug.overRect,
            zoneScale
          );
          const liveDraggedCenterScreen = result.debug.centerScreen;

          return {
            liveDraggedCenterScreen,
            livePositionScreenCenter,
            ghostScreenCenter,
            snappedScreenCenter,
            ghostRelativeToLiveDragged: pointDelta(
              liveDraggedCenterScreen,
              ghostScreenCenter
            ),
            ghostRelativeToLivePosition: pointDelta(
              livePositionScreenCenter,
              ghostScreenCenter
            ),
            snappedRelativeToGhost: pointDelta(
              ghostScreenCenter,
              snappedScreenCenter
            ),
            snappedRelativeToLiveDragged: pointDelta(
              liveDraggedCenterScreen,
              snappedScreenCenter
            ),
          };
        })()
      : null;
    debugLog(BATTLEFIELD_DND_DEBUG_KEY, "drag-move-compute", {
      seq: currentDragSeq.current,
      cardId: activeCardId,
      pointerScreen,
      delta: event.delta,
      activeRectTranslated: summarizeRectLike(active.rect.current?.translated),
      activeTranslatedPointerRelation: summarizeRectPointerRelation(
        summarizeRectLike(active.rect.current?.translated),
        pointerScreen,
        dragAnchorRef.current
      ),
      activeRectInitial: summarizeRectLike(active.rect.current?.initial),
      activeInitialPointerRelation: summarizeRectPointerRelation(
        summarizeRectLike(active.rect.current?.initial),
        pointerScreen,
        dragAnchorRef.current
      ),
      over: over
        ? {
            id: over.id,
            type: over.data.current?.type,
            rect: summarizeRectLike(over.rect),
            scale: over.data.current?.scale,
            cardScale: over.data.current?.cardScale,
            cardBaseHeight: over.data.current?.cardBaseHeight,
            cardBaseWidth: over.data.current?.cardBaseWidth,
            mirrorY: Boolean(over.data.current?.mirrorY),
          }
        : null,
      cardState: activeCard
        ? {
            zoneId: activeCard.zoneId,
            position: activeCard.position,
            tapped: activeCard.tapped,
            rotation: activeCard.rotation,
            faceDown: activeCard.faceDown,
          }
        : null,
      cardElement: activeCardId ? summarizeCardElement(activeCardId) : null,
      dragOverlayElement: activeCardId
        ? summarizeDragOverlayElement(activeCardId)
        : null,
      dragOverlayCardElement: activeCardId
        ? summarizeDragOverlayCardElement(activeCardId)
        : null,
      ghostElementBeforeRender: activeCardId ? summarizeGhostElement(activeCardId) : null,
      dndGeometry: activeCardId
        ? summarizeDndCardGeometry(activeCardId, {
            pointer: pointerScreen,
            dragAnchor: dragAnchorRef.current,
          })
        : null,
      ghostCard: result.ghostCard,
      placementRelations,
      placement: result.debug
        ? {
            centerScreen: result.debug.centerScreen,
            pointerScreen: result.debug.pointerScreen,
            movementScreen: result.debug.movementScreen,
            dragAnchor: result.debug.dragAnchor,
            isTapped: result.debug.isTapped,
            zoneScale: result.debug.zoneScale,
            viewScale: result.debug.viewScale,
            overRect: summarizeRectLike(result.debug.overRect),
            cardWidth: result.debug.placement.cardWidth,
            cardHeight: result.debug.placement.cardHeight,
            zoneWidth: result.debug.placement.zoneWidth,
            zoneHeight: result.debug.placement.zoneHeight,
            livePosition: result.debug.placement.livePosition,
            liveCanonical: result.debug.placement.liveCanonical,
            leadScreen: result.debug.placement.leadScreen,
            previewCanonical: result.debug.placement.previewCanonical,
            snappedCanonical: result.debug.placement.snappedCanonical,
            ghostPosition: result.debug.placement.ghostPosition,
            snappedPosition: result.debug.placement.snappedPosition,
          }
        : null,
    });

    if (
      activeCard?.faceDown &&
      !result.ghostCard &&
      !loggedMissingGhostRef.current
    ) {
      loggedMissingGhostRef.current = true;
      debugLog(FACE_DOWN_DEBUG_KEY, "missing-ghost", {
        cardId: activeCardId,
        overZoneId: over?.id,
        overType: over?.data.current?.type,
        hasActiveRect: Boolean(active.rect.current?.translated),
        isDebugEnabled: isDebugEnabled(FACE_DOWN_DEBUG_KEY),
      });
    }

    const group = dragSelectionRef.current;
    const isGroupDragging = Boolean(group && group.groupCardIds.length > 1);
    setOverCardScale(result.overCardScale);

    if (!isGroupDragging) {
      if (result.ghostCard && activeCardId) {
        const ghostCard = result.ghostCard;
        lastSingleBattlefieldPreviewRef.current = result.debug
          ? {
              cardId: activeCardId,
              toZoneId: ghostCard.zoneId,
              position: result.debug.placement.snappedCanonical,
            }
          : null;
        commitDragFrameStoreUpdate(() => {
          setGhostCards([
            {
              cardId: activeCardId,
              zoneId: ghostCard.zoneId,
              position: ghostCard.position,
              tapped: ghostCard.tapped,
              size: ghostCard.size,
            },
          ]);
        });
        queueDebugFrame("drag-move-ghost-rendered", () => ({
          seq: currentDragSeq.current,
          cardId: activeCardId,
          ghostState: useDragStore.getState().ghostCards?.find(
            (ghost) => ghost.cardId === activeCardId
          ),
          ghostElement: summarizeGhostElement(activeCardId),
          dragOverlayElement: summarizeDragOverlayElement(activeCardId),
          dragOverlayCardElement: summarizeDragOverlayCardElement(activeCardId),
          cardElement: summarizeCardElement(activeCardId),
          dndGeometry: summarizeDndCardGeometry(activeCardId, {
            pointer: pointerScreen,
            dragAnchor: dragAnchorRef.current,
          }),
        }));
      } else {
        lastSingleBattlefieldPreviewRef.current = null;
        commitDragFrameStoreUpdate(() => setGhostCards(null));
      }
      return;
    }

    if (
      !group ||
      !result.ghostCard ||
      !over ||
      over.data.current?.type !== ZONE.BATTLEFIELD
    ) {
      commitDragFrameStoreUpdate(() => setGhostCards(null));
      return;
    }

    const targetZone = state.zones[over.id as ZoneId];
    if (!targetZone) {
      commitDragFrameStoreUpdate(() => setGhostCards(null));
      return;
    }

    const zoneScale = over.data.current?.scale ?? 1;
    const zoneWidth = (over.rect.width || 0) / (zoneScale || 1);
    const zoneHeight = (over.rect.height || 0) / (zoneScale || 1);
    if (!zoneWidth || !zoneHeight) {
      setGhostCards(null);
      return;
    }

    const mirrorY = Boolean(over.data.current?.mirrorY);
    const viewScale = over.data.current?.cardScale ?? 1;
    const baseCardHeight = over.data.current?.cardBaseHeight;
    const baseCardWidth = over.data.current?.cardBaseWidth;

    const ghostCards = computeBattlefieldGroupGhostCards({
      groupCardIds: group.groupCardIds,
      activeCardId: group.activeCardId,
      startPositions: group.startPositions,
      cards: state.cards,
      targetZoneId: targetZone.id,
      activeGhostPosition: result.ghostCard.position,
      zoneWidth,
      zoneHeight,
      mirrorY,
      viewScale,
      baseCardHeight,
      baseCardWidth,
    });

    commitDragFrameStoreUpdate(() =>
      setGhostCards(ghostCards.length > 0 ? ghostCards : null)
    );
    queueDebugFrame("drag-move-group-ghost-rendered", () => ({
      seq: currentDragSeq.current,
      ghostCards: useDragStore.getState().ghostCards,
      activeDndGeometry: activeCardId
        ? summarizeDndCardGeometry(activeCardId, {
            pointer: pointerScreen,
            dragAnchor: dragAnchorRef.current,
          })
        : null,
      ghostElements: ghostCards.map((ghost) => ({
        cardId: ghost.cardId,
        element: summarizeGhostElement(ghost.cardId),
      })),
    }));
  };

  const cleanupDragState = React.useCallback(() => {
    setGhostCards(null);
    setActiveCardId(null);
    setActiveCardScale(1);
    setActiveCardTransformOrigin(DEFAULT_DRAG_TRANSFORM_ORIGIN);
    setActiveCardDragAnchor(null);
    setActiveCardSourceSize(null);
    setHandDragPreview(null);
    setIsGroupDragging(false);
    setOverCardScale(1);
    currentDragSeq.current = null;
    dragSelectionRef.current = null;
    dragAnchorRef.current = null;
    lastSingleBattlefieldPreviewRef.current = null;
  }, [
    setActiveCardDragAnchor,
    setActiveCardId,
    setActiveCardScale,
    setActiveCardSourceSize,
    setActiveCardTransformOrigin,
    setGhostCards,
    setHandDragPreview,
    setIsGroupDragging,
    setOverCardScale,
  ]);

  const claimPendingDropVisualOwnership = React.useCallback(
    (claims: Array<{ cardId: CardId; sourceZoneId: ZoneId; targetZoneId: ZoneId }>) => {
      const uniqueClaims = Array.from(
        new Map(
          claims
            .filter((claim) => claim.sourceZoneId !== claim.targetZoneId)
            .map((claim) => [claim.cardId, claim])
        ).values()
      );
      if (uniqueClaims.length === 0) {
        releasePendingDropSourceElements(
          useDragStore.getState().pendingDropVisualClaims
        );
        clearPendingDropVisualClaims();
        return;
      }
      const dragSeqAtClaim = currentDragSeq.current;

      setPendingDropVisualClaims(uniqueClaims);
      suppressPendingDropSourceElements(uniqueClaims);
      debugLog(BATTLEFIELD_DND_DEBUG_KEY, "drop-visual-ownership-pending", {
        seq: dragSeqAtClaim,
        claims: uniqueClaims,
      });

      const claimedKeys = new Set(uniqueClaims.map(pendingDropClaimKey));
      const maxFrames = 30;
      const minFrames = 4;
      let frameCount = 0;

      const releaseWhenSourceUnmounts = () => {
        const currentClaims = useDragStore.getState().pendingDropVisualClaims;
        const ownedClaims = currentClaims.filter((claim) =>
          claimedKeys.has(pendingDropClaimKey(claim))
        );
        if (ownedClaims.length === 0) {
          return;
        }
        const otherClaims = currentClaims.filter(
          (claim) => !claimedKeys.has(pendingDropClaimKey(claim))
        );
        const retainedOwnedClaims =
          frameCount < maxFrames
            ? filterPendingDropVisualClaims(
                ownedClaims,
                (claim) =>
                  shouldRetainPendingDropVisualClaim({
                    sourceRendered: isPendingDropSourceStillRendered(claim),
                    targetRendered: isPendingDropTargetRendered(claim),
                    frameCount,
                    minFrames,
                  })
              )
            : [];
        useDragStore
          .getState()
          .setPendingDropVisualClaims([...otherClaims, ...retainedOwnedClaims]);
        releasePendingDropSourceElements(
          ownedClaims.filter(
            (claim) =>
              !retainedOwnedClaims.some(
                (retained) =>
                  pendingDropClaimKey(retained) === pendingDropClaimKey(claim)
              )
          )
        );
        suppressPendingDropSourceElements(retainedOwnedClaims);
        if (retainedOwnedClaims.length > 0) {
          frameCount += 1;
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(releaseWhenSourceUnmounts);
          } else {
            setTimeout(releaseWhenSourceUnmounts, 16);
          }
          return;
        }
        debugLog(BATTLEFIELD_DND_DEBUG_KEY, "drop-visual-ownership-released", {
          seq: dragSeqAtClaim,
          claims: uniqueClaims,
          releaseFrameCount: frameCount,
        });
      };

      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(releaseWhenSourceUnmounts);
      } else {
        setTimeout(releaseWhenSourceUnmounts, 16);
      }
    },
    [clearPendingDropVisualClaims, setPendingDropVisualClaims]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      if (isSpectator) return;

      const { active, over } = event;
      const finishedDragSeq = currentDragSeq.current;
      try {
        const cardId = active.data.current?.cardId as CardId | undefined;
        if (!cardId) return;
        const state = useGameStore.getState();
        const activeCard = state.cards[cardId];
        if (!activeCard) return;

        const pointerScreen = getCurrentPointerScreen({
          activatorEvent: event.activatorEvent,
          delta: event.delta,
        });
        const sourceZone = state.zones[activeCard.zoneId];
        const sourceHandRect =
          sourceZone?.type === ZONE.HAND ? getZoneElementRect(sourceZone.id) : null;
        const useSameHandFallback = shouldUseSameHandDropFallback({
          activeId: String(active.id),
          sourceZone,
          sourceHandRect,
          pointerScreen,
          over: over
            ? {
                id: String(over.id),
                zoneId: over.data.current?.zoneId as ZoneId | undefined,
              }
            : null,
        });
        if (!over && !useSameHandFallback) return;
        if (over && active.id === over.id && !useSameHandFallback) return;

        const toZoneId =
          (over?.data.current?.zoneId as ZoneId | undefined) ??
          (useSameHandFallback ? activeCard.zoneId : undefined);
        if (!toZoneId) return;

        const releasePreview = lastSingleBattlefieldPreviewRef.current;
        const targetHandRect =
          toZoneId === sourceZone?.id ? sourceHandRect : getZoneElementRect(toZoneId);
        const plan = computeDragEndPlan({
          myPlayerId,
          viewerRole: params.viewerRole,
          cards: state.cards,
          zones: state.zones,
          cardId,
          toZoneId,
          overCardId: over?.data.current?.cardId as CardId | undefined,
          activeRect: active.rect.current?.translated,
          pointerScreen,
          movementScreen: event.delta,
          dragAnchor: dragAnchorRef.current,
          overRect: over?.rect ?? targetHandRect,
          handZoneRect: targetHandRect,
          overScale: over?.data.current?.scale,
          overCardScale: over?.data.current?.cardScale,
          overCardBaseHeight: over?.data.current?.cardBaseHeight,
          overCardBaseWidth: over?.data.current?.cardBaseWidth,
          releasePreviewPosition:
            releasePreview &&
            releasePreview.cardId === cardId &&
            releasePreview.toZoneId === toZoneId
              ? releasePreview.position
              : null,
          mirrorY: Boolean(over?.data.current?.mirrorY),
          activeTapped: Boolean(active.data.current?.tapped),
        });
        debugLog(BATTLEFIELD_DND_DEBUG_KEY, "drag-end-plan", {
          seq: finishedDragSeq,
          cardId,
          pointerScreen,
          delta: event.delta,
          over: over
            ? {
                id: over.id,
                type: over.data.current?.type,
                rect: summarizeRectLike(over.rect),
                scale: over.data.current?.scale,
                cardScale: over.data.current?.cardScale,
                cardBaseHeight: over.data.current?.cardBaseHeight,
                cardBaseWidth: over.data.current?.cardBaseWidth,
                mirrorY: Boolean(over.data.current?.mirrorY),
              }
            : null,
          useSameHandFallback,
          activeRectTranslated: summarizeRectLike(active.rect.current?.translated),
          activeTranslatedPointerRelation: summarizeRectPointerRelation(
            summarizeRectLike(active.rect.current?.translated),
            pointerScreen,
            dragAnchorRef.current
          ),
          activeRectInitial: summarizeRectLike(active.rect.current?.initial),
          activeInitialPointerRelation: summarizeRectPointerRelation(
            summarizeRectLike(active.rect.current?.initial),
            pointerScreen,
            dragAnchorRef.current
          ),
          dragAnchor: dragAnchorRef.current,
          plan,
          cardStateBeforeMove: activeCard
            ? {
                zoneId: activeCard.zoneId,
                position: activeCard.position,
                tapped: activeCard.tapped,
                rotation: activeCard.rotation,
                faceDown: activeCard.faceDown,
              }
            : null,
          cardElementBeforeMove: summarizeCardElement(cardId),
          dragOverlayElementBeforeMove: summarizeDragOverlayElement(cardId),
          dragOverlayCardElementBeforeMove: summarizeDragOverlayCardElement(cardId),
          ghostElementBeforeClear: summarizeGhostElement(cardId),
          dndGeometryBeforeMove: summarizeDndCardGeometry(cardId, {
            pointer: pointerScreen,
            dragAnchor: dragAnchorRef.current,
          }),
        });
        if (activeCard?.faceDown) {
          debugLog(FACE_DOWN_DEBUG_KEY, "drag-end-plan", {
            cardId,
            plan,
            fromZoneId: activeCard.zoneId,
            faceDown: activeCard.faceDown,
          });
        }

        const group = dragSelectionRef.current;

        if (plan.kind === "reorderHand") {
          const zone = state.zones[plan.zoneId];
          if (!zone) return;
          const newOrder = arrayMove(zone.cardIds, plan.oldIndex, plan.newIndex);
          reorderZoneCards(plan.zoneId, newOrder, myPlayerId);
          return;
        }

        if (plan.kind === "moveCard") {
          if (group && group.groupCardIds.length > 1) {
            const targetZone = state.zones[plan.toZoneId];
            if (!targetZone) return;

            const activeStart = group.startPositions[group.activeCardId];
            if (!activeStart) return;

            if (targetZone.type === ZONE.BATTLEFIELD && plan.position) {
              const delta = {
                x: plan.position.x - activeStart.x,
                y: plan.position.y - activeStart.y,
              };
              const clampedDelta = clampCanonicalBattlefieldGroupDelta({
                movingIds: group.groupCardIds,
                startPositions: group.startPositions,
                delta,
                isTapped: (id) => state.cards[id]?.tapped,
              });

              const targetPositions: Record<CardId, { x: number; y: number }> = {};
              const movingIds: CardId[] = [];
              group.groupCardIds.forEach((id) => {
                const card = state.cards[id];
                if (!card) return;
                if (card.zoneId !== group.startZoneId) return;
                const startPos = group.startPositions[id];
                if (!startPos) return;

                const target = {
                  x: startPos.x + clampedDelta.x,
                  y: startPos.y + clampedDelta.y,
                };
                const resolvedTarget = clampNormalizedToCanonicalBattlefieldBounds(
                  target,
                  { isTapped: card.tapped }
                );
                targetPositions[id] = resolvedTarget;
                movingIds.push(id);
              });

              const groupCollision = {
                movingCardIds: movingIds,
                targetPositions,
              };
              claimPendingDropVisualOwnership(
                movingIds.map((id) => ({
                  cardId: id,
                  sourceZoneId: group.startZoneId,
                  targetZoneId: plan.toZoneId,
                }))
              );
              movingIds.forEach((id) => {
                const target = targetPositions[id];
                if (!target) return;
                moveCard(id, plan.toZoneId, target, myPlayerId, undefined, {
                  suppressLog: id !== group.activeCardId,
                  groupCollision,
                });
                queueDebugFrame("drag-end-landed", () => {
                  const landedCard = useGameStore.getState().cards[id];
                  return {
                    seq: finishedDragSeq,
                    cardId: id,
                    plannedPosition: target,
                    cardStateAfterMove: landedCard
                      ? {
                          zoneId: landedCard.zoneId,
                          position: landedCard.position,
                          tapped: landedCard.tapped,
                          rotation: landedCard.rotation,
                          faceDown: landedCard.faceDown,
                        }
                      : null,
                    cardElement: summarizeCardElement(id),
                    zoneElement: summarizeZoneElement(plan.toZoneId),
                  };
                });
              });
              if (targetZone.ownerId !== myPlayerId) {
                clearSelection();
              }
              return;
            }

          const movingIds = group.groupCardIds.filter((id) => {
            const card = state.cards[id];
            return card && card.zoneId === group.startZoneId;
          });
          claimPendingDropVisualOwnership(
            movingIds.map((id) => ({
              cardId: id,
              sourceZoneId: group.startZoneId,
              targetZoneId: plan.toZoneId,
            }))
          );
          movingIds.forEach((id) => {
            const card = state.cards[id];
            if (!card) return;
            moveCard(id, plan.toZoneId, plan.position, myPlayerId, undefined, {
              suppressLog: id !== group.activeCardId,
              skipCollision: true,
            });
            queueDebugFrame("drag-end-landed", () => {
              const landedCard = useGameStore.getState().cards[id];
              return {
                seq: finishedDragSeq,
                cardId: id,
                plannedPosition: plan.position,
                cardStateAfterMove: landedCard
                  ? {
                      zoneId: landedCard.zoneId,
                      position: landedCard.position,
                      tapped: landedCard.tapped,
                      rotation: landedCard.rotation,
                      faceDown: landedCard.faceDown,
                    }
                  : null,
                cardElement: summarizeCardElement(id),
                zoneElement: summarizeZoneElement(plan.toZoneId),
              };
            });
          });
          if (
            targetZone.type !== ZONE.BATTLEFIELD ||
            targetZone.ownerId !== myPlayerId
          ) {
            clearSelection();
          }
          return;
        }

        const targetZone = state.zones[plan.toZoneId];
        const activeCard = state.cards[plan.cardId];

        if (activeCard) {
          claimPendingDropVisualOwnership([
            {
              cardId: plan.cardId,
              sourceZoneId: activeCard.zoneId,
              targetZoneId: plan.toZoneId,
            },
          ]);
        }
        moveCard(
          plan.cardId,
          plan.toZoneId,
          plan.position,
          myPlayerId,
          undefined
        );
        queueDebugFrame("drag-end-landed", () => {
          const landedCard = useGameStore.getState().cards[plan.cardId];
          return {
            seq: finishedDragSeq,
            cardId: plan.cardId,
            plannedPosition: plan.position,
            cardStateAfterMove: landedCard
              ? {
                  zoneId: landedCard.zoneId,
                  position: landedCard.position,
                  tapped: landedCard.tapped,
                  rotation: landedCard.rotation,
                  faceDown: landedCard.faceDown,
                }
              : null,
            cardElement: summarizeCardElement(plan.cardId),
            zoneElement: summarizeZoneElement(plan.toZoneId),
          };
        });
        queueDebugTimeout("drag-end-landed-settled", () => {
          const landedCard = useGameStore.getState().cards[plan.cardId];
          return {
            seq: finishedDragSeq,
            cardId: plan.cardId,
            plannedPosition: plan.position,
            cardStateAfterMove: landedCard
              ? {
                  zoneId: landedCard.zoneId,
                  position: landedCard.position,
                  tapped: landedCard.tapped,
                  rotation: landedCard.rotation,
                  faceDown: landedCard.faceDown,
                }
              : null,
            cardElement: summarizeCardElement(plan.cardId),
            zoneElement: summarizeZoneElement(plan.toZoneId),
          };
        });
        if (
          targetZone &&
          activeCard &&
          (targetZone.type !== ZONE.BATTLEFIELD ||
            targetZone.ownerId !== myPlayerId)
        ) {
          const selectionState = useSelectionStore.getState();
          if (
            selectionState.selectionZoneId === activeCard.zoneId &&
            selectionState.selectedCardIds.includes(plan.cardId)
          ) {
            clearSelection();
          }
        }
        }
      } finally {
        cleanupDragState();
      }
    },
    [
      claimPendingDropVisualOwnership,
      cleanupDragState,
      clearSelection,
      isSpectator,
      moveCard,
      myPlayerId,
      params.viewerRole,
      reorderZoneCards,
    ]
  );

  return {
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
};
