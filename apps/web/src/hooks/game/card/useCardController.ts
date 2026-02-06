import React from "react";
import { useDraggable } from "@dnd-kit/core";

import { useGameStore } from "@/store/gameStore";
import { ZONE } from "@/constants/zones";

import { useCardPreview } from "@/components/game/card/CardPreviewProvider";
import {
  canViewerSeeCardIdentity,
  canViewerSeeLibraryCardByReveal,
  canViewerSeeLibraryTopCard,
} from "@/lib/reveal";
import { getFlipRotation } from "@/lib/cardDisplay";
import { useSelectionStore } from "@/store/selectionStore";
import { useDragStore } from "@/store/dragStore";
import {
  canToggleCardPreviewLock,
  computeCardContainerStyle,
  getCardHoverPreviewPolicy,
  shouldDisableHoverAnimation,
} from "@/models/game/card/cardModel";
import { resolveSelectedCardIds } from "@/models/game/selection/selectionModel";

import type { CardProps, CardViewProps } from "@/components/game/card/types";

const PREVIEW_LOCK_LONG_PRESS_MS = 400;
const PREVIEW_LOCK_MOVE_TOLERANCE_PX = 8;
const TOUCH_TWO_FINGER_HOLD_MS = 500;
const TOUCH_MOVE_TOLERANCE_PX = 10;
const TOUCH_PREVIEW_TAP_MOVE_TOLERANCE_PX = 6;

type TouchPointState = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  target: HTMLDivElement;
  moved: boolean;
};

export type CardController = {
  ref: (node: HTMLElement | null) => void;
  draggableProps: Record<string, unknown>;
  cardViewProps: CardViewProps;
};

export const useCardController = (props: CardProps): CardController => {
  const {
    card,
    style: propStyle,
    className,
    onContextMenu,
    faceDown,
    scale = 1,
    preferArtCrop,
    rotateLabel,
    disableDrag,
    isDragging: propIsDragging,
    disableInteractions,
    disableHoverAnimation: propDisableHoverAnimation,
    highlightColor,
    isSelected: propIsSelected,
  } = props;

  const { showPreview, hidePreview, toggleLock, lockPreview } = useCardPreview();
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging: internalIsDragging,
  } = useDraggable({
    id: card.id,
    data: {
      cardId: card.id,
      zoneId: card.zoneId,
      ownerId: card.ownerId,
      tapped: card.tapped,
      cardScale: scale,
    },
    disabled: disableDrag,
  });

  const isDragging = propIsDragging ?? internalIsDragging;
  const interactionsDisabled =
    Boolean(disableInteractions) ||
    Boolean(propIsDragging) ||
    internalIsDragging;
  const zone = useGameStore((state) => state.zones[card.zoneId]);
  const zoneType = zone?.type;
  const zoneOwnerId = zone?.ownerId;
  const zoneCardIds = zone?.cardIds ?? [];
  const myPlayerId = useGameStore((state) => state.myPlayerId);
  const viewerRole = useGameStore((state) => state.viewerRole);
  const tapCard = useGameStore((state) => state.tapCard);
  const useArtCrop = preferArtCrop ?? false;
  const isSelected = useSelectionStore(
    (state) =>
      state.selectionZoneId === card.zoneId &&
      state.selectedCardIds.includes(card.id)
  );
  const toggleCardSelection = useSelectionStore((state) => state.toggleCard);
  const selectOnly = useSelectionStore((state) => state.selectOnly);

  const isZoneTopCard =
    zoneCardIds.length > 0 && zoneCardIds[zoneCardIds.length - 1] === card.id;
  const libraryTopReveal = useGameStore(
    (state) => state.players[zoneOwnerId ?? card.ownerId]?.libraryTopReveal
  );
  const canSeeLibraryTop =
    zoneType === ZONE.LIBRARY &&
    isZoneTopCard &&
    (canViewerSeeLibraryCardByReveal(card, myPlayerId, viewerRole) ||
      canViewerSeeLibraryTopCard({
        viewerId: myPlayerId,
        ownerId: zoneOwnerId ?? card.ownerId,
        mode: libraryTopReveal,
      }));
  const canPeek = React.useMemo(
    () =>
      canViewerSeeCardIdentity(card, zoneType, myPlayerId, viewerRole) ||
      Boolean(canSeeLibraryTop),
    [card, zoneType, myPlayerId, viewerRole, canSeeLibraryTop]
  );

  const style = React.useMemo<React.CSSProperties>(
    () =>
      computeCardContainerStyle({
        propStyle,
        scale,
        tapped: card.tapped,
        rotation: card.rotation,
        isDragging,
      }),
    [propStyle, scale, card.tapped, card.rotation, isDragging]
  );

  const imageTransform = React.useMemo(() => {
    const flipRotation = getFlipRotation(card);
    return flipRotation ? `rotate(${flipRotation}deg)` : undefined;
  }, [card, card.scryfall?.layout, card.currentFaceIndex]);

  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lockPressTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lockPressStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const touchPointsRef = React.useRef<Map<number, TouchPointState>>(new Map());
  const primaryTouchPointerIdRef = React.useRef<number | null>(null);
  const touchHadMultiTouchRef = React.useRef(false);
  const touchContextMenuTriggeredRef = React.useRef(false);
  const twoFingerHoldTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const twoFingerHoldPointerIdsRef = React.useRef<[number, number] | null>(null);

  const clearLockPress = React.useCallback(() => {
    if (lockPressTimeoutRef.current) {
      clearTimeout(lockPressTimeoutRef.current);
      lockPressTimeoutRef.current = null;
    }
    lockPressStartRef.current = null;
  }, []);

  const clearTwoFingerHoldTimeout = React.useCallback(() => {
    if (twoFingerHoldTimeoutRef.current) {
      clearTimeout(twoFingerHoldTimeoutRef.current);
      twoFingerHoldTimeoutRef.current = null;
    }
  }, []);

  const cancelTwoFingerHold = React.useCallback(() => {
    clearTwoFingerHoldTimeout();
    twoFingerHoldPointerIdsRef.current = null;
  }, [clearTwoFingerHoldTimeout]);

  const resetTouchGesture = React.useCallback(() => {
    cancelTwoFingerHold();
    touchPointsRef.current.clear();
    primaryTouchPointerIdRef.current = null;
    touchHadMultiTouchRef.current = false;
    touchContextMenuTriggeredRef.current = false;
  }, [cancelTwoFingerHold]);

  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactionsDisabled) return;
      const policy = getCardHoverPreviewPolicy({
        zoneType,
        canPeek,
        faceDown,
        isDragging: interactionsDisabled,
        isZoneTopCard,
        allowLibraryTopPreview: canSeeLibraryTop,
      });
      if (policy.kind === "none") return;

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }

      const target = e.currentTarget;
      if (policy.kind === "immediate") {
        showPreview(card, target);
        return;
      }
      hoverTimeoutRef.current = setTimeout(() => {
        showPreview(card, target);
        hoverTimeoutRef.current = null;
      }, policy.delayMs);
    },
    [
      interactionsDisabled,
      canPeek,
      card,
      faceDown,
      showPreview,
      zoneType,
      isZoneTopCard,
      canSeeLibraryTop,
    ]
  );

  const handleMouseLeave = React.useCallback(
    () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      hidePreview(card.id);
    },
    [hidePreview, card.id]
  );

  const handleLockPressStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (interactionsDisabled) return;
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      if (
        e.defaultPrevented ||
        e.shiftKey ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      if (
        !canToggleCardPreviewLock({
          zoneType,
          canPeek,
          faceDown,
          isDragging: interactionsDisabled,
        })
      ) {
        return;
      }

      const target = e.currentTarget;
      lockPressStartRef.current = { x: e.clientX, y: e.clientY };
      if (lockPressTimeoutRef.current) {
        clearTimeout(lockPressTimeoutRef.current);
      }
      lockPressTimeoutRef.current = setTimeout(() => {
        lockPressTimeoutRef.current = null;
        lockPressStartRef.current = null;
        toggleLock(card, target);
      }, PREVIEW_LOCK_LONG_PRESS_MS);
    },
    [zoneType, interactionsDisabled, card, toggleLock, faceDown, canPeek]
  );

  const handleDoubleClick = React.useCallback(() => {
    if (viewerRole === "spectator") return;
    if (interactionsDisabled) return;
    if (zoneType !== ZONE.BATTLEFIELD) return;
    const actorId = myPlayerId;
    const selection = useSelectionStore.getState();
    const state = useGameStore.getState();
    const groupIds = resolveSelectedCardIds({
      seedCardId: card.id,
      cardsById: state.cards,
      selection,
      minCount: 2,
      fallbackToSeed: true,
    });
    if (groupIds.length > 1) {
      const targetTapped = !card.tapped;
      groupIds.forEach((id) => {
        const targetCard = state.cards[id];
        if (!targetCard) return;
        if (targetCard.zoneId !== card.zoneId) return;
        if (targetCard.controllerId !== actorId) return;
        if (targetCard.tapped === targetTapped) return;
        tapCard(targetCard.id, actorId);
      });
      return;
    }
    if (card.controllerId !== actorId) return;
    tapCard(card.id, actorId);
  }, [
    interactionsDisabled,
    zoneType,
    card.id,
    card.zoneId,
    card.controllerId,
    card.tapped,
    myPlayerId,
    tapCard,
    viewerRole,
  ]);

  const openTouchContextMenu = React.useCallback(
    (pointA: TouchPointState, pointB: TouchPointState) => {
      if (!onContextMenu) return;
      const clientX = (pointA.x + pointB.x) / 2;
      const clientY = (pointA.y + pointB.y) / 2;
      onContextMenu({
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX,
        clientY,
        currentTarget: pointA.target,
        target: pointA.target,
      } as unknown as React.MouseEvent);
    },
    [onContextMenu]
  );

  const beginTwoFingerHold = React.useCallback(() => {
    if (!onContextMenu) return;
    if (interactionsDisabled) return;
    const points = Array.from(touchPointsRef.current.entries());
    if (points.length !== 2) return;
    const pointerIds: [number, number] = [points[0][0], points[1][0]];
    twoFingerHoldPointerIdsRef.current = pointerIds;
    clearTwoFingerHoldTimeout();
    twoFingerHoldTimeoutRef.current = setTimeout(() => {
      const trackedIds = twoFingerHoldPointerIdsRef.current;
      if (!trackedIds) return;
      const pointA = touchPointsRef.current.get(trackedIds[0]);
      const pointB = touchPointsRef.current.get(trackedIds[1]);
      if (!pointA || !pointB) return;
      if (pointA.moved || pointB.moved) return;
      touchContextMenuTriggeredRef.current = true;
      clearTwoFingerHoldTimeout();
      twoFingerHoldPointerIdsRef.current = null;
      openTouchContextMenu(pointA, pointB);
    }, TOUCH_TWO_FINGER_HOLD_MS);
  }, [
    clearTwoFingerHoldTimeout,
    interactionsDisabled,
    onContextMenu,
    openTouchContextMenu,
  ]);

  const handleTouchPressStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      if (interactionsDisabled) return;
      if (event.button !== 0) return;
      if (
        event.defaultPrevented ||
        event.shiftKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      touchPointsRef.current.set(event.pointerId, {
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        target: event.currentTarget,
        moved: false,
      });

      const pointCount = touchPointsRef.current.size;
      if (pointCount === 1) {
        primaryTouchPointerIdRef.current = event.pointerId;
        touchHadMultiTouchRef.current = false;
        touchContextMenuTriggeredRef.current = false;
      } else {
        touchHadMultiTouchRef.current = true;
      }

      if (pointCount === 2) {
        beginTwoFingerHold();
        return;
      }
      if (pointCount > 2) {
        cancelTwoFingerHold();
      }
    },
    [beginTwoFingerHold, cancelTwoFingerHold, interactionsDisabled]
  );

  const handleTouchPressMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const point = touchPointsRef.current.get(event.pointerId);
      if (!point) return;
      point.x = event.clientX;
      point.y = event.clientY;
      if (!point.moved) {
        const dx = event.clientX - point.startX;
        const dy = event.clientY - point.startY;
        if (Math.hypot(dx, dy) > TOUCH_MOVE_TOLERANCE_PX) {
          point.moved = true;
        }
      }
      const trackedIds = twoFingerHoldPointerIdsRef.current;
      if (trackedIds) {
        const pointA = touchPointsRef.current.get(trackedIds[0]);
        const pointB = touchPointsRef.current.get(trackedIds[1]);
        if (!pointA || !pointB || pointA.moved || pointB.moved) {
          cancelTwoFingerHold();
        }
      }
    },
    [cancelTwoFingerHold]
  );

  const handleTouchPressFinish = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const point = touchPointsRef.current.get(event.pointerId);
      if (!point) return;

      point.x = event.clientX;
      point.y = event.clientY;
      const movement = Math.hypot(point.x - point.startX, point.y - point.startY);
      const wasPrimaryTouch = primaryTouchPointerIdRef.current === event.pointerId;

      touchPointsRef.current.delete(event.pointerId);
      if (touchPointsRef.current.size < 2) {
        cancelTwoFingerHold();
      }

      const previewPolicy = getCardHoverPreviewPolicy({
        zoneType,
        canPeek,
        faceDown,
        isDragging: interactionsDisabled,
        isZoneTopCard,
        allowLibraryTopPreview: canSeeLibraryTop,
      });
      const shouldShowPreview = Boolean(
        wasPrimaryTouch &&
          !touchHadMultiTouchRef.current &&
          !touchContextMenuTriggeredRef.current &&
          movement <= TOUCH_PREVIEW_TAP_MOVE_TOLERANCE_PX &&
          !interactionsDisabled &&
          previewPolicy.kind !== "none"
      );
      if (touchPointsRef.current.size === 0) {
        primaryTouchPointerIdRef.current = null;
        touchHadMultiTouchRef.current = false;
        touchContextMenuTriggeredRef.current = false;
      }

      if (!shouldShowPreview) return;
      if (useDragStore.getState().activeCardId === card.id) return;
      lockPreview(card, point.target);
    },
    [
      cancelTwoFingerHold,
      canPeek,
      canSeeLibraryTop,
      card,
      faceDown,
      interactionsDisabled,
      isZoneTopCard,
      lockPreview,
      zoneType,
    ]
  );

  const handleTouchPressCancel = React.useCallback(() => {
    resetTouchGesture();
  }, [resetTouchGesture]);

  const handleLockPressMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!lockPressTimeoutRef.current || !lockPressStartRef.current) return;
      const dx = e.clientX - lockPressStartRef.current.x;
      const dy = e.clientY - lockPressStartRef.current.y;
      if (Math.hypot(dx, dy) > PREVIEW_LOCK_MOVE_TOLERANCE_PX) {
        clearLockPress();
      }
    },
    [clearLockPress]
  );

  const handleLockPressEnd = React.useCallback(() => {
    clearLockPress();
  }, [clearLockPress]);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (viewerRole === "spectator") return;
      if (interactionsDisabled) return;
      if (e.button !== 0) return;
      if (zoneType !== ZONE.BATTLEFIELD) return;
      if (zoneOwnerId !== myPlayerId) return;

      if (e.shiftKey) {
        toggleCardSelection(card.id, card.zoneId);
        return;
      }

      if (!isSelected) {
        selectOnly(card.id, card.zoneId);
      }
    },
    [
      card.id,
      card.zoneId,
      isSelected,
      myPlayerId,
      selectOnly,
      toggleCardSelection,
      zoneOwnerId,
      zoneType,
      interactionsDisabled,
      viewerRole,
    ]
  );

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      clearLockPress();
      resetTouchGesture();
      hidePreview(card.id);
    };
  }, [card.id, clearLockPress, hidePreview, resetTouchGesture]);

  const disableHoverAnimation =
    Boolean(propDisableHoverAnimation) ||
    shouldDisableHoverAnimation({
      zoneType,
      ownerId: card.ownerId,
      viewerId: myPlayerId,
    }) ||
    interactionsDisabled;

  return {
    ref: setNodeRef,
    cardViewProps: {
      card,
      style,
      className,
      onContextMenu,
      faceDown,
      isDragging,
      onDoubleClick: handleDoubleClick,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        handleLockPressMove(event);
        handleTouchPressMove(event);
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        handleLockPressEnd();
        handleTouchPressFinish(event);
      },
      onPointerCancel: () => {
        handleLockPressEnd();
        handleTouchPressCancel();
      },
      onPointerLeave: () => {
        handleLockPressEnd();
        handleTouchPressCancel();
      },
      imageTransform,
      preferArtCrop: useArtCrop,
      rotateLabel,
      highlightColor,
      isSelected: propIsSelected,
      disableHoverAnimation,
      showCommanderBadge: card.isCommander && zoneType === ZONE.BATTLEFIELD,
    },
    draggableProps: {
      ...listeners,
      ...attributes,
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        handlePointerDown(event);
        handleLockPressStart(event);
        handleTouchPressStart(event);
        listeners?.onPointerDown?.(event);
      },
    },
  };
};
