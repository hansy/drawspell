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

const DESKTOP_PREVIEW_LOCK_MOVE_TOLERANCE_PX = 8;
const TOUCH_CONTEXT_MENU_LONG_PRESS_MS = 500;
const TOUCH_MOVE_TOLERANCE_PX = 10;
const TOUCH_PREVIEW_TAP_TOLERANCE_PX = 6;
const SUPPRESS_MOUSE_HOVER_AFTER_TOUCH_MS = 700;

type TouchPointState = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  target: HTMLDivElement;
  moved: boolean;
  consumed: boolean;
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

  const { showPreview, hidePreview, toggleLock, lockPreview, unlockPreview } =
    useCardPreview();
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
        viewerRole,
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
  const desktopPreviewPressRef = React.useRef<{
    x: number;
    y: number;
    target: HTMLDivElement;
  } | null>(null);
  const touchPointsRef = React.useRef<Map<number, TouchPointState>>(new Map());
  const touchHadMultiTouchRef = React.useRef(false);
  const contextMenuHoldTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const contextMenuHoldPointerIdRef = React.useRef<number | null>(null);
  const suppressMouseHoverPreviewUntilRef = React.useRef(0);

  const clearDesktopPreviewPress = React.useCallback(() => {
    desktopPreviewPressRef.current = null;
  }, []);

  const clearHoverTimeout = React.useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const clearContextMenuHoldTimeout = React.useCallback(() => {
    if (contextMenuHoldTimeoutRef.current) {
      clearTimeout(contextMenuHoldTimeoutRef.current);
      contextMenuHoldTimeoutRef.current = null;
    }
  }, []);

  const cancelContextMenuHold = React.useCallback(() => {
    clearContextMenuHoldTimeout();
    contextMenuHoldPointerIdRef.current = null;
  }, [clearContextMenuHoldTimeout]);

  const resetTouchGesture = React.useCallback(() => {
    cancelContextMenuHold();
    touchPointsRef.current.clear();
    touchHadMultiTouchRef.current = false;
  }, [cancelContextMenuHold]);

  const resolvePreviewPolicy = React.useCallback(
    () =>
      getCardHoverPreviewPolicy({
        zoneType,
        canPeek,
        faceDown,
        isDragging: interactionsDisabled,
        isZoneTopCard,
        allowLibraryTopPreview: canSeeLibraryTop,
      }),
    [
      canPeek,
      canSeeLibraryTop,
      faceDown,
      interactionsDisabled,
      isZoneTopCard,
      zoneType,
    ]
  );

  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactionsDisabled) return;
      if (Date.now() < suppressMouseHoverPreviewUntilRef.current) return;
      const policy = resolvePreviewPolicy();
      if (policy.kind === "none") return;

      clearHoverTimeout();

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
      card,
      clearHoverTimeout,
      resolvePreviewPolicy,
      showPreview,
    ]
  );

  const handleMouseLeave = React.useCallback(
    () => {
      clearHoverTimeout();
      hidePreview(card.id);
    },
    [card.id, clearHoverTimeout, hidePreview]
  );

  const handleDesktopPreviewPressStart = React.useCallback(
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

      desktopPreviewPressRef.current = {
        x: e.clientX,
        y: e.clientY,
        target: e.currentTarget,
      };
    },
    [zoneType, interactionsDisabled, faceDown, canPeek]
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
    (point: TouchPointState) => {
      if (!onContextMenu) return;
      onContextMenu({
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: point.x,
        clientY: point.y,
        currentTarget: point.target,
        target: point.target,
      } as unknown as React.MouseEvent);
    },
    [onContextMenu]
  );

  const beginTouchContextMenuHold = React.useCallback((pointerId: number) => {
    if (!onContextMenu) return;
    if (interactionsDisabled) return;
    contextMenuHoldPointerIdRef.current = pointerId;
    clearContextMenuHoldTimeout();
    contextMenuHoldTimeoutRef.current = setTimeout(() => {
      if (contextMenuHoldPointerIdRef.current !== pointerId) return;
      if (touchPointsRef.current.size !== 1) return;
      const point = touchPointsRef.current.get(pointerId);
      if (!point) return;
      if (point.moved) return;
      point.consumed = true;
      cancelContextMenuHold();
      openTouchContextMenu(point);
    }, TOUCH_CONTEXT_MENU_LONG_PRESS_MS);
  }, [
    cancelContextMenuHold,
    clearContextMenuHoldTimeout,
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
      suppressMouseHoverPreviewUntilRef.current =
        Date.now() + SUPPRESS_MOUSE_HOVER_AFTER_TOUCH_MS;

      touchPointsRef.current.set(event.pointerId, {
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        target: event.currentTarget,
        moved: false,
        consumed: false,
      });

      const pointCount = touchPointsRef.current.size;
      if (pointCount === 1) {
        touchHadMultiTouchRef.current = false;
        beginTouchContextMenuHold(event.pointerId);
      } else {
        touchHadMultiTouchRef.current = true;
        cancelContextMenuHold();
      }
    },
    [
      beginTouchContextMenuHold,
      cancelContextMenuHold,
      interactionsDisabled,
    ]
  );

  const handleTouchPressMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const point = touchPointsRef.current.get(event.pointerId);
      if (!point) return;
      point.x = event.clientX;
      point.y = event.clientY;
      const movement = Math.hypot(point.x - point.startX, point.y - point.startY);
      if (!point.moved) {
        if (movement > TOUCH_MOVE_TOLERANCE_PX) {
          point.moved = true;
        }
      }
      if (
        contextMenuHoldPointerIdRef.current === event.pointerId &&
        point.moved
      ) {
        cancelContextMenuHold();
      }
      if (movement > TOUCH_PREVIEW_TAP_TOLERANCE_PX) {
        unlockPreview();
      }
    },
    [cancelContextMenuHold, unlockPreview]
  );

  const handleTouchPressFinish = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const point = touchPointsRef.current.get(event.pointerId);
      if (!point) return;

      point.x = event.clientX;
      point.y = event.clientY;

      touchPointsRef.current.delete(event.pointerId);
      if (contextMenuHoldPointerIdRef.current === event.pointerId) {
        cancelContextMenuHold();
      }
      const movement = Math.hypot(point.x - point.startX, point.y - point.startY);
      const previewPolicy = resolvePreviewPolicy();
      const shouldOpenPreview =
        !touchHadMultiTouchRef.current &&
        !point.consumed &&
        movement <= TOUCH_PREVIEW_TAP_TOLERANCE_PX &&
        previewPolicy.kind !== "none" &&
        useDragStore.getState().activeCardId !== card.id;
      if (shouldOpenPreview) {
        lockPreview(card, point.target);
      }
      if (touchPointsRef.current.size === 0) {
        touchHadMultiTouchRef.current = false;
      }
    },
    [
      cancelContextMenuHold,
      card,
      lockPreview,
      resolvePreviewPolicy,
    ]
  );

  const handleTouchPressCancel = React.useCallback(() => {
    resetTouchGesture();
  }, [resetTouchGesture]);

  const handleDesktopPreviewPressMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!desktopPreviewPressRef.current) return;
      const dx = e.clientX - desktopPreviewPressRef.current.x;
      const dy = e.clientY - desktopPreviewPressRef.current.y;
      if (Math.hypot(dx, dy) > DESKTOP_PREVIEW_LOCK_MOVE_TOLERANCE_PX) {
        clearDesktopPreviewPress();
      }
    },
    [clearDesktopPreviewPress]
  );

  const handleDesktopPreviewPressEnd = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      const press = desktopPreviewPressRef.current;
      clearDesktopPreviewPress();
      if (!press) return;
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
      if (useDragStore.getState().activeCardId === card.id) return;
      toggleLock(card, press.target);
    },
    [card, clearDesktopPreviewPress, toggleLock]
  );

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
      clearHoverTimeout();
      clearDesktopPreviewPress();
      resetTouchGesture();
      hidePreview(card.id);
    };
  }, [
    card.id,
    clearDesktopPreviewPress,
    clearHoverTimeout,
    hidePreview,
    resetTouchGesture,
  ]);

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
        handleDesktopPreviewPressMove(event);
        handleTouchPressMove(event);
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        handleDesktopPreviewPressEnd(event);
        handleTouchPressFinish(event);
      },
      onPointerCancel: () => {
        clearDesktopPreviewPress();
        handleTouchPressCancel();
      },
      onPointerLeave: () => {
        clearDesktopPreviewPress();
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
        handleDesktopPreviewPressStart(event);
        handleTouchPressStart(event);
        listeners?.onPointerDown?.(event);
      },
    },
  };
};
