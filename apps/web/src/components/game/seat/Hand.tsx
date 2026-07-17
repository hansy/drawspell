import React from "react";
import { cn } from "@/lib/utils";
import { Zone as ZoneType, Card as CardType, ViewerRole } from "@/types";
import { Card } from "../card/Card";
import { Zone } from "../zone/Zone";
import { ZONE_LABEL } from "@/constants/zones";
import { shouldRenderFaceDown } from "@/lib/reveal";
import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from "@/lib/constants";
import {
  debugLog,
  isDebugEnabled,
  summarizeDndCardGeometry,
  summarizeHandScrollElement,
} from "@/lib/debug";
import { useDragStore } from "@/store/dragStore";
import {
  HAND_BASE_CARD_SCALE,
  HAND_CARD_OVERLAP_RATIO,
  HAND_CARD_SCROLL_EDGE_PADDING_PX,
  HAND_CARD_TOP_GAP_PX,
} from "./handSizing";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ZONE_DRAG_OVERLAY_SCALE } from "@/lib/dndDragCue";
import { hasPendingDropVisualClaim } from "@/lib/dndVisualOwnership";
import { useOptionalCardPreview } from "../card/CardPreviewProvider";
import {
  TOUCH_CONTEXT_MENU_LONG_PRESS_MS,
  TOUCH_MOVE_TOLERANCE_PX,
} from "@/lib/touchGestures";

interface HandProps {
  zone: ZoneType;
  cards: CardType[];
  isTop: boolean;
  isRight: boolean;
  isMe: boolean;
  viewerPlayerId: string;
  viewerRole?: ViewerRole;
  onCardContextMenu?: (e: React.MouseEvent, card: CardType) => void;
  onHandContextMenu?: (e: React.MouseEvent, zoneId: string) => void;
  className?: string;
  scale?: number;
  cardScale?: number;
  cardOverlapRatio?: number;
  baseCardHeight?: number;
  showLabel?: boolean;
  dropDisabled?: boolean;
  showCustomScrollbar?: boolean;
  fitCards?: boolean;
  labelPlacement?: "seat-edge" | "top-left" | "top-center" | "bottom-center";
  cardTopGapPx?: number;
  flipCards?: boolean;
  coverFlow?: boolean;
}

const HAND_SCROLLBAR_MIN_OVERFLOW_PX = 1;
const HAND_SCROLL_DEBUG_MIN_DELTA_PX = 4;
const COVER_FLOW_AXIS_LOCK_PX = 6;
const COVER_FLOW_SWIPE_COMMIT_PX = 18;
const COVER_FLOW_VELOCITY_COMMIT_PX_PER_MS = 0.25;
const COVER_FLOW_VELOCITY_PROJECTION_MS = 120;
const COVER_FLOW_MAX_VELOCITY_PROJECTION_PX = 32;
const COVER_FLOW_EDGE_RESISTANCE = 0.28;

type TouchPressState = {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  target: HTMLDivElement;
  moved: boolean;
};

const SortableCard = React.memo(
  ({
    card,
    isMe,
    viewerPlayerId,
    viewerRole,
    onCardContextMenu,
    cardScale,
    cardOverlapRatio,
    baseCardHeight,
    useFullSlotWidth,
    alignVisualBounds,
    renderedZoneId,
    flipCard,
    isPreviewed,
    coverFlowOffset,
    onActivate,
  }: {
    card: CardType;
    isMe: boolean;
    viewerPlayerId: string;
    viewerRole?: ViewerRole;
    onCardContextMenu?: (e: React.MouseEvent, card: CardType) => void;
    cardScale: number;
    cardOverlapRatio: number;
    baseCardHeight?: number;
    useFullSlotWidth: boolean;
    alignVisualBounds: boolean;
    renderedZoneId: string;
    flipCard: boolean;
    isPreviewed: boolean;
    coverFlowOffset?: number;
    onActivate?: (cardId: string) => void;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: card.id,
      data: {
        cardId: card.id,
        zoneId: card.zoneId,
        ownerId: card.ownerId,
        tapped: card.tapped,
        cardScale,
        dragOverlayScale: ZONE_DRAG_OVERLAY_SCALE,
        dragOverlayCue: "zone",
      },
      disabled: !isMe,
    });
    const isPendingDrop = useDragStore((state) =>
      hasPendingDropVisualClaim(
        state.pendingDropVisualClaims,
        card.id,
        renderedZoneId,
      ),
    );
    const isActiveDragSource = useDragStore(
      (state) => state.activeCardId === card.id
    );
    const isCardFaceSuppressed = isActiveDragSource || isPendingDrop;

    const resolvedBaseHeight = baseCardHeight ?? BASE_CARD_HEIGHT;
    const cardWidth = resolvedBaseHeight * CARD_ASPECT_RATIO * cardScale;
    const cardHeight = resolvedBaseHeight * cardScale;
    const overlapWidth = useFullSlotWidth
      ? cardWidth
      : cardWidth * cardOverlapRatio;

    const style = React.useMemo(() => {
      return {
        transform: CSS.Transform.toString(transform),
        transition: isActiveDragSource ? "none" : transition,
        ["--hand-card-slot-width" as string]: `${overlapWidth}px`,
      } as React.CSSProperties;
    }, [isActiveDragSource, overlapWidth, transform, transition]);

    React.useEffect(() => {
      if (!isDebugEnabled("battlefieldDnd")) return;
      debugLog("battlefieldDnd", "hand-card-layout", {
        cardId: card.id,
        zoneId: card.zoneId,
        renderedZoneId,
        isActiveDragSource,
        isDragging,
        isPendingDrop,
        isCardFaceSuppressed,
        cardScale,
        cardOverlapRatio,
        baseCardHeight,
        resolvedBaseHeight,
        cardWidth,
        overlapWidth,
        useFullSlotWidth,
        transform,
        transition,
        dndGeometry: summarizeDndCardGeometry(card.id),
      });
    }, [
      baseCardHeight,
      card.id,
      card.zoneId,
      cardScale,
      cardOverlapRatio,
      cardWidth,
      isDragging,
      isActiveDragSource,
      isPendingDrop,
      isCardFaceSuppressed,
      overlapWidth,
      renderedZoneId,
      resolvedBaseHeight,
      transform,
      transition,
      useFullSlotWidth,
    ]);

    const handleContextMenu = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onCardContextMenu?.(e, card);
      },
      [onCardContextMenu, card],
    );

    return (
      <div
        ref={setNodeRef}
        style={style}
        data-dnd-hand-sortable-card-id={card.id}
        data-dnd-hand-card-scale={cardScale}
        data-hand-card-previewed={isPreviewed ? "true" : undefined}
        className={cn(
          "relative flex shrink-0 h-full w-[var(--hand-card-slot-width)] items-center lg:items-start touch-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group",
          isMe && coverFlowOffset === undefined && "hover:-translate-y-3",
          isActiveDragSource && "z-50",
          isPendingDrop && "z-50 opacity-0",
        )}
        {...attributes}
        {...listeners}
        onClick={() => onActivate?.(card.id)}
      >
        <div
          data-dnd-hand-drop-preview-card-id={
            isActiveDragSource ? card.id : undefined
          }
          data-dnd-hand-card-frame-id={card.id}
          className={cn(
            "ds-seat-upright w-auto aspect-[11/15] transition-transform duration-200",
            flipCard && "rotate-180",
          )}
          style={{
            width: alignVisualBounds ? cardWidth : undefined,
            height: alignVisualBounds ? cardHeight : undefined,
            opacity: isActiveDragSource ? 0.45 : undefined,
            zIndex:
              coverFlowOffset === undefined
                ? undefined
                : 20 - Math.min(10, Math.abs(coverFlowOffset)),
            transform:
              coverFlowOffset === undefined
                ? undefined
                : coverFlowOffset === 0
                  ? "translate3d(0,-4px,0) scale(1) rotateY(0deg)"
                  : `translate3d(${Math.sign(coverFlowOffset) * Math.min(12, Math.abs(coverFlowOffset) * 4)}px,${Math.min(14, Math.abs(coverFlowOffset) * 5)}px,0) scale(${Math.max(0.82, 0.94 - Math.abs(coverFlowOffset) * 0.04)}) rotateY(${-Math.sign(coverFlowOffset) * Math.min(12, 8 + Math.abs(coverFlowOffset) * 2)}deg)`,
            transition:
              "transform 190ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease-out",
          }}
        >
          <Card
            card={card}
            className={cn(
              "origin-top shadow-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "origin-center lg:origin-top",
              isMe &&
                "group-hover:ring-2 group-hover:ring-cyan-200/90 group-hover:ring-offset-2 group-hover:ring-offset-zinc-950",
              isMe &&
                "hover:ring-2 hover:ring-cyan-200/90 hover:ring-offset-2 hover:ring-offset-zinc-950",
              isMe &&
                "group-hover:shadow-[0_16px_36px_rgba(103,232,249,0.3)]",
              isActiveDragSource &&
                "ring-2 ring-cyan-200/90 ring-offset-2 ring-offset-zinc-950 shadow-[0_16px_36px_rgba(103,232,249,0.25)]",
              isMe && isPreviewed &&
                "ring-2 ring-cyan-200 ring-offset-2 ring-offset-zinc-950",
            )}
            style={{
              transformOrigin: alignVisualBounds ? "top left" : undefined,
              transition:
                "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 300ms cubic-bezier(0.22, 1, 0.36, 1), border-color 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease-out",
            }}
            faceDown={shouldRenderFaceDown(
              card,
              "hand",
              viewerPlayerId,
              viewerRole,
            )}
            onContextMenu={handleContextMenu}
            disableDrag // We use Sortable's drag handle
            disableHoverAnimation={!isMe}
            isDragging={isPendingDrop}
            scale={cardScale}
          />
        </div>
      </div>
    );
  },
);

const HandInner: React.FC<HandProps> = ({
  zone,
  cards,
  isTop,
  isRight,
  isMe,
  viewerPlayerId,
  viewerRole,
  onCardContextMenu,
  onHandContextMenu,
  className,
  scale = 1,
  cardScale = HAND_BASE_CARD_SCALE,
  cardOverlapRatio = HAND_CARD_OVERLAP_RATIO,
  baseCardHeight,
  showLabel = true,
  dropDisabled = false,
  showCustomScrollbar = false,
  fitCards = false,
  labelPlacement = "seat-edge",
  cardTopGapPx = HAND_CARD_TOP_GAP_PX,
  flipCards = false,
  coverFlow = false,
}) => {
  const preview = useOptionalCardPreview();
  const handDragPreview = useDragStore((state) => state.handDragPreview);
  const activeDragCardId = useDragStore((state) => state.activeCardId);
  const displayCards = React.useMemo(() => {
    if (coverFlow) return cards;
    if (!handDragPreview || handDragPreview.zoneId !== zone.id) return cards;
    const oldIndex = cards.findIndex((card) => card.id === handDragPreview.cardId);
    if (oldIndex === -1) return cards;
    const targetIndex = Math.max(
      0,
      Math.min(cards.length - 1, handDragPreview.targetIndex)
    );
    if (oldIndex === targetIndex) return cards;
    return arrayMove(cards, oldIndex, targetIndex);
  }, [cards, coverFlow, handDragPreview, zone.id]);
  // Memoize card IDs array for SortableContext
  const cardIds = React.useMemo(
    () => displayCards.map((card) => card.id),
    [displayCards]
  );
  const isSingleCardHand = displayCards.length === 1;
  const touchPressTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPressRef = React.useRef<TouchPressState | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const lastLoggedScrollLeftRef = React.useRef<number | null>(null);
  const [scrollbarState, setScrollbarState] = React.useState({
    left: 0,
    max: 0,
    visible: false,
  });
  const [fitCardOverlapRatio, setFitCardOverlapRatio] = React.useState(
    cardOverlapRatio,
  );
  const [coverFlowActiveCardId, setCoverFlowActiveCardId] = React.useState<
    string | null
  >(() => cards[cards.length - 1]?.id ?? null);
  const [coverFlowDragOffsetPx, setCoverFlowDragOffsetPx] = React.useState(0);
  const [isCoverFlowSwiping, setIsCoverFlowSwiping] = React.useState(false);
  const coverFlowSuppressClickRef = React.useRef(false);
  const coverFlowSuppressClickTimeoutRef = React.useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  const coverFlowSwipeRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    lastX: number;
    lastTimestamp: number;
    velocityX: number;
    axis: "pending" | "horizontal" | "vertical";
  } | null>(null);

  React.useEffect(() => {
    if (!coverFlow) return;
    if (coverFlowActiveCardId && cards.some((card) => card.id === coverFlowActiveCardId)) {
      return;
    }
    setCoverFlowActiveCardId(cards[cards.length - 1]?.id ?? null);
  }, [cards, coverFlow, coverFlowActiveCardId]);

  const coverFlowActiveIndex = Math.max(
    0,
    displayCards.findIndex((card) => card.id === coverFlowActiveCardId),
  );
  const resolvedBaseHeight = baseCardHeight ?? BASE_CARD_HEIGHT;
  const coverFlowCardWidth = resolvedBaseHeight * CARD_ASPECT_RATIO * cardScale;
  const coverFlowSlotWidth = coverFlowCardWidth * 0.42;
  const coverFlowCenterOffset =
    coverFlowActiveIndex * coverFlowSlotWidth + coverFlowCardWidth / 2;

  const clearCoverFlowClickSuppression = React.useCallback(() => {
    if (coverFlowSuppressClickTimeoutRef.current) {
      clearTimeout(coverFlowSuppressClickTimeoutRef.current);
      coverFlowSuppressClickTimeoutRef.current = null;
    }
    coverFlowSuppressClickRef.current = false;
  }, []);

  const releaseCoverFlowClickSuppression = React.useCallback(() => {
    if (coverFlowSuppressClickTimeoutRef.current) {
      clearTimeout(coverFlowSuppressClickTimeoutRef.current);
    }
    coverFlowSuppressClickTimeoutRef.current = setTimeout(() => {
      coverFlowSuppressClickTimeoutRef.current = null;
      coverFlowSuppressClickRef.current = false;
    }, 0);
  }, []);

  const resetCoverFlowGesture = React.useCallback(() => {
    coverFlowSwipeRef.current = null;
    setCoverFlowDragOffsetPx(0);
    setIsCoverFlowSwiping(false);
  }, []);

  const handleCoverFlowPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!coverFlow || event.pointerType !== "touch" || event.button !== 0) return;
      coverFlowSwipeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastTimestamp: event.timeStamp,
        velocityX: 0,
        axis: "pending",
      };
      clearCoverFlowClickSuppression();
    },
    [clearCoverFlowClickSuppression, coverFlow],
  );

  const handleCoverFlowPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = coverFlowSwipeRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (activeDragCardId) {
        resetCoverFlowGesture();
        return;
      }
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      const deltaX = event.clientX - gesture.startX;
      const deltaY = gesture.y - gesture.startY;

      if (gesture.axis === "pending") {
        if (
          Math.abs(deltaX) < COVER_FLOW_AXIS_LOCK_PX &&
          Math.abs(deltaY) < COVER_FLOW_AXIS_LOCK_PX
        ) {
          return;
        }
        gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }
      if (gesture.axis !== "horizontal") return;

      const elapsedMs = Math.max(1, event.timeStamp - gesture.lastTimestamp);
      const instantaneousVelocity = (event.clientX - gesture.lastX) / elapsedMs;
      gesture.velocityX = gesture.velocityX * 0.65 + instantaneousVelocity * 0.35;
      gesture.lastX = event.clientX;
      gesture.lastTimestamp = event.timeStamp;

      const isPullingPastStart = coverFlowActiveIndex === 0 && deltaX > 0;
      const isPullingPastEnd =
        coverFlowActiveIndex === displayCards.length - 1 && deltaX < 0;
      const resistedDelta =
        isPullingPastStart || isPullingPastEnd
          ? deltaX * COVER_FLOW_EDGE_RESISTANCE
          : deltaX;
      coverFlowSuppressClickRef.current = true;
      setIsCoverFlowSwiping(true);
      setCoverFlowDragOffsetPx(resistedDelta);
    },
    [
      activeDragCardId,
      coverFlowActiveIndex,
      displayCards.length,
      resetCoverFlowGesture,
    ],
  );

  const handleCoverFlowPointerEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = coverFlowSwipeRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (activeDragCardId || gesture.axis !== "horizontal") {
        resetCoverFlowGesture();
        return;
      }

      const deltaX = event.clientX - gesture.startX;
      const shouldCommit =
        Math.abs(deltaX) >= COVER_FLOW_SWIPE_COMMIT_PX ||
        Math.abs(gesture.velocityX) >= COVER_FLOW_VELOCITY_COMMIT_PX_PER_MS;
      if (!shouldCommit) {
        resetCoverFlowGesture();
        releaseCoverFlowClickSuppression();
        return;
      }

      const velocityProjection = Math.max(
        -COVER_FLOW_MAX_VELOCITY_PROJECTION_PX,
        Math.min(
          COVER_FLOW_MAX_VELOCITY_PROJECTION_PX,
          gesture.velocityX * COVER_FLOW_VELOCITY_PROJECTION_MS,
        ),
      );
      const projectedDelta = deltaX + velocityProjection;
      const snapDistance = Math.max(72, coverFlowSlotWidth);
      const stepCount = Math.max(
        1,
        Math.min(
          3,
          Math.round(
            (Math.abs(projectedDelta) - COVER_FLOW_SWIPE_COMMIT_PX) / snapDistance,
          ),
        ),
      );
      const nextIndex = Math.max(
        0,
        Math.min(
          displayCards.length - 1,
          coverFlowActiveIndex + (projectedDelta < 0 ? stepCount : -stepCount),
        ),
      );
      setCoverFlowActiveCardId(displayCards[nextIndex]?.id ?? null);
      resetCoverFlowGesture();
      releaseCoverFlowClickSuppression();
    },
    [
      activeDragCardId,
      coverFlowActiveIndex,
      coverFlowSlotWidth,
      displayCards,
      releaseCoverFlowClickSuppression,
      resetCoverFlowGesture,
    ],
  );

  const handleCoverFlowActivate = React.useCallback((cardId: string) => {
    if (coverFlowSuppressClickRef.current || activeDragCardId) return;
    setCoverFlowActiveCardId(cardId);
  }, [activeDragCardId]);

  React.useEffect(() => {
    if (!activeDragCardId) return;
    coverFlowSuppressClickRef.current = true;
    resetCoverFlowGesture();
  }, [activeDragCardId, resetCoverFlowGesture]);

  React.useEffect(
    () => () => {
      if (coverFlowSuppressClickTimeoutRef.current) {
        clearTimeout(coverFlowSuppressClickTimeoutRef.current);
      }
    },
    [],
  );

  const clearTouchPressTimeout = React.useCallback(() => {
    if (touchPressTimeoutRef.current) {
      clearTimeout(touchPressTimeoutRef.current);
      touchPressTimeoutRef.current = null;
    }
  }, []);

  const clearTouchPress = React.useCallback(() => {
    clearTouchPressTimeout();
    touchPressRef.current = null;
  }, [clearTouchPressTimeout]);

  const handleHandContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      onHandContextMenu?.(e, zone.id);
    },
    [onHandContextMenu, zone.id],
  );

  const syncScrollbarState = React.useCallback(() => {
    const node = scrollContainerRef.current;
    if (!node) {
      setScrollbarState({ left: 0, max: 0, visible: false });
      return;
    }

    const max = Math.max(0, node.scrollWidth - node.clientWidth);
    const left = Math.min(max, Math.max(0, node.scrollLeft));
    const overflowBeyondDragGutters = Math.max(
      0,
      max - HAND_CARD_SCROLL_EDGE_PADDING_PX * 2,
    );
    const visible =
      displayCards.length > 1 &&
      overflowBeyondDragGutters > HAND_SCROLLBAR_MIN_OVERFLOW_PX;
    setScrollbarState((current) =>
      current.left === left && current.max === max && current.visible === visible
        ? current
        : { left, max, visible },
    );

    if (isDebugEnabled("battlefieldDnd")) {
      const previousLeft = lastLoggedScrollLeftRef.current;
      const leftDelta = previousLeft === null ? 0 : left - previousLeft;
      const shouldLog =
        previousLeft === null || Math.abs(leftDelta) >= HAND_SCROLL_DEBUG_MIN_DELTA_PX;
      if (shouldLog) {
        lastLoggedScrollLeftRef.current = left;
        debugLog("battlefieldDnd", "hand-scroll-sync", {
          zoneId: zone.id,
          cardCount: displayCards.length,
          left,
          leftDelta,
          max,
          overflowBeyondDragGutters,
          visible,
          scrollElement: summarizeHandScrollElement(zone.id),
        });
      }
    }
  }, [displayCards.length, zone.id]);

  const setScrollContainerNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
      syncScrollbarState();
    },
    [syncScrollbarState],
  );

  const syncFitCardOverlap = React.useCallback(() => {
    if (!fitCards || displayCards.length < 2) {
      setFitCardOverlapRatio(cardOverlapRatio);
      return;
    }
    const node = scrollContainerRef.current;
    if (!node) return;

    const resolvedBaseHeight = baseCardHeight ?? BASE_CARD_HEIGHT;
    const cardWidth = resolvedBaseHeight * CARD_ASPECT_RATIO * cardScale;
    if (cardWidth <= 0) return;

    const edgePadding = 16;
    const availableWidth = Math.max(0, node.clientWidth - edgePadding * 2);
    const fittedSlotWidth = Math.max(
      0,
      (availableWidth - cardWidth) / (displayCards.length - 1),
    );
    const nextRatio = Math.min(cardOverlapRatio, fittedSlotWidth / cardWidth);
    setFitCardOverlapRatio((current) =>
      Math.abs(current - nextRatio) < 0.001 ? current : nextRatio,
    );
  }, [
    baseCardHeight,
    cardOverlapRatio,
    cardScale,
    displayCards.length,
    fitCards,
  ]);

  React.useLayoutEffect(() => {
    syncScrollbarState();
    const node = scrollContainerRef.current;
    if (!node) return;

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(syncScrollbarState);
    observer.observe(node);
    const strip = node.querySelector("[data-dnd-hand-card-strip]");
    if (strip instanceof Element) observer.observe(strip);
    return () => observer.disconnect();
  }, [displayCards.length, syncScrollbarState]);

  React.useLayoutEffect(() => {
    syncFitCardOverlap();
    const node = scrollContainerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncFitCardOverlap);
    observer.observe(node);
    return () => observer.disconnect();
  }, [syncFitCardOverlap]);

  const handleTouchContextMenuStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!onHandContextMenu) return;
      if (event.pointerType !== "touch") return;
      if (event.button !== 0) return;
      if (event.target instanceof HTMLElement && event.target.closest("[data-card-id]")) {
        return;
      }

      if (touchPressRef.current && touchPressRef.current.pointerId !== event.pointerId) {
        clearTouchPress();
        return;
      }

      const press: TouchPressState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.currentTarget,
        moved: false,
      };
      touchPressRef.current = press;
      clearTouchPressTimeout();
      touchPressTimeoutRef.current = setTimeout(() => {
        const currentPress = touchPressRef.current;
        if (!currentPress) return;
        if (currentPress.pointerId !== press.pointerId) return;
        if (currentPress.moved) return;
        touchPressTimeoutRef.current = null;
        onHandContextMenu({
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: currentPress.clientX,
          clientY: currentPress.clientY,
          currentTarget: currentPress.target,
          target: currentPress.target,
        } as unknown as React.MouseEvent, zone.id);
      }, TOUCH_CONTEXT_MENU_LONG_PRESS_MS);
    },
    [clearTouchPress, clearTouchPressTimeout, onHandContextMenu, zone.id],
  );

  const handleTouchContextMenuMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const press = touchPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      press.clientX = event.clientX;
      press.clientY = event.clientY;
      if (press.moved) return;
      const dx = event.clientX - press.startX;
      const dy = event.clientY - press.startY;
      if (Math.hypot(dx, dy) > TOUCH_MOVE_TOLERANCE_PX) {
        press.moved = true;
        clearTouchPressTimeout();
      }
    },
    [clearTouchPressTimeout],
  );

  const handleTouchContextMenuEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const press = touchPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      clearTouchPress();
    },
    [clearTouchPress],
  );

  React.useEffect(() => clearTouchPress, [clearTouchPress]);
  const customScrollbarVisible = showCustomScrollbar && scrollbarState.visible;
  const reserveCustomScrollbarSpace = showCustomScrollbar && displayCards.length > 1;

  return (
    <div
      data-hand-fit-cards={fitCards ? "true" : undefined}
      data-hand-cover-flow={coverFlow ? "true" : undefined}
      data-cover-flow-dragging={isCoverFlowSwiping ? "true" : undefined}
      className={cn(
        "group/hand-zone h-full flex-1 relative min-w-0 w-0", // w-0 enforces flex width constraint
        // Distinct background for hand area
        "bg-zinc-900/60",
        isTop ? "border-b border-white/10" : "border-t border-white/10",
        // Padding to prevent bleeding into adjacent seats
        "px-4",
        className,
      )}
      onPointerDownCapture={handleCoverFlowPointerDown}
      onPointerMoveCapture={handleCoverFlowPointerMove}
      onPointerUpCapture={handleCoverFlowPointerEnd}
      onPointerCancelCapture={() => {
        resetCoverFlowGesture();
        releaseCoverFlowClickSuppression();
      }}
    >
      {showLabel && (
        <div
          data-edge-zone-label
          className={cn(
            "ds-edge-zone-label absolute font-bold uppercase text-zinc-400 bg-zinc-900 border border-zinc-700/70 rounded-full z-40 pointer-events-none select-none shadow-[0_2px_10px_rgba(0,0,0,0.45)] whitespace-nowrap",
            "invisible opacity-0 transition-[opacity,visibility] duration-150 group-hover/hand-zone:visible group-hover/hand-zone:opacity-100 group-focus-within/hand-zone:visible group-focus-within/hand-zone:opacity-100 motion-reduce:transition-none",
            // Vertical positioning: straddle the border
            labelPlacement === "top-left"
              ? "-top-3 left-8"
              : labelPlacement === "top-center"
                ? "-top-3 left-1/2 -translate-x-1/2"
              : labelPlacement === "bottom-center"
                ? "bottom-1 left-1/2 -translate-x-1/2"
              : isTop
                ? "-bottom-3"
                : "-top-3",
            // Horizontal positioning: opposite to sidebar
            // If sidebar is Right (isRight), label is Left
            // If sidebar is Left (!isRight), label is Right
            labelPlacement === "seat-edge"
              ? isRight
                ? "left-8"
                : "right-8"
              : undefined,
            "ds-seat-upright",
          )}
        >
          {ZONE_LABEL.hand} - {cards.length}
        </div>
      )}

      <Zone
        zone={zone}
        disabled={dropDisabled}
        scale={scale}
        cardScale={cardScale}
        innerRef={setScrollContainerNode}
        onContextMenu={handleHandContextMenu}
        onPointerDown={handleTouchContextMenuStart}
        onPointerMove={handleTouchContextMenuMove}
        onPointerUp={handleTouchContextMenuEnd}
        onPointerCancel={handleTouchContextMenuEnd}
        onPointerLeave={handleTouchContextMenuEnd}
        onScroll={syncScrollbarState}
        className={cn(
          "w-full h-full flex scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent overscroll-x-none",
          isMe && viewerRole !== "spectator" && onHandContextMenu && cards.length > 0 &&
            "cursor-context-menu",
          coverFlow
            ? "overflow-hidden touch-none [perspective:900px]"
            : fitCards
            ? "overflow-x-clip overflow-y-visible touch-none"
            : "overflow-x-auto overflow-y-hidden",
          !coverFlow && !fitCards &&
            (showCustomScrollbar ? "touch-none" : "touch-pan-x"),
        )}
      >
        <SortableContext
          items={cardIds}
          strategy={horizontalListSortingStrategy}
        >
          <div
            data-dnd-hand-card-strip
            className={cn(
              "flex h-full gap-0 items-center lg:items-start pt-0 lg:pt-[var(--hand-card-top-gap)] motion-reduce:transition-none",
              coverFlow
                ? cn(
                    "absolute left-1/2 top-1/2 w-max [transform-style:preserve-3d]",
                    isCoverFlowSwiping
                      ? "transition-none will-change-transform"
                      : "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  )
                : cn(
                    "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    isSingleCardHand
                      ? "w-full justify-center"
                      : "w-max min-w-full shrink-0 justify-center",
                  ),
            )}
            style={{
              ["--hand-card-top-gap" as string]: `${cardTopGapPx}px`,
              paddingLeft: coverFlow ? 0 : fitCards ? 16 : HAND_CARD_SCROLL_EDGE_PADDING_PX,
              paddingRight: coverFlow ? 0 : fitCards ? 16 : HAND_CARD_SCROLL_EDGE_PADDING_PX,
              paddingBottom: reserveCustomScrollbarSpace ? 12 : 0,
              transform: coverFlow
                ? `translate3d(${-coverFlowCenterOffset + coverFlowDragOffsetPx}px,-50%,0)`
                : undefined,
            }}
          >
            {/*
              Keep single-card hands visually centered by using a full-width slot.
              Overlap slot widths remain for multi-card hands.
            */}
            {displayCards.map((card, index) => (
              <SortableCard
                key={card.id}
                card={card}
                isMe={isMe}
                viewerPlayerId={viewerPlayerId}
                viewerRole={viewerRole}
                onCardContextMenu={onCardContextMenu}
                cardScale={cardScale}
                cardOverlapRatio={
                  coverFlow ? 0.42 : fitCards ? fitCardOverlapRatio : cardOverlapRatio
                }
                baseCardHeight={baseCardHeight}
                useFullSlotWidth={
                  !coverFlow && (isSingleCardHand ||
                  (fitCards && index === displayCards.length - 1)
                  )
                }
                alignVisualBounds={coverFlow || fitCards}
                renderedZoneId={zone.id}
                flipCard={flipCards}
                isPreviewed={Boolean(isMe && preview?.previewCardId === card.id)}
                coverFlowOffset={coverFlow ? index - coverFlowActiveIndex : undefined}
                onActivate={coverFlow ? handleCoverFlowActivate : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </Zone>
      {customScrollbarVisible && (
        <input
          aria-label={`${ZONE_LABEL.hand} scroll`}
          data-dnd-hand-scrollbar
          data-no-seat-swipe="true"
          type="range"
          min={0}
          max={scrollbarState.max}
          value={Math.min(scrollbarState.left, scrollbarState.max)}
          onChange={(event) => {
            const node = scrollContainerRef.current;
            if (!node) return;
            node.scrollLeft = Number(event.currentTarget.value);
            syncScrollbarState();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          className="absolute inset-x-6 bottom-1 z-50 h-5 cursor-ew-resize appearance-none bg-transparent accent-cyan-300 [touch-action:none] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-700/90 [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-cyan-100/80 [&::-webkit-slider-thumb]:bg-cyan-300 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(103,232,249,0.35)] [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-zinc-700/90 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-10 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-cyan-100/80 [&::-moz-range-thumb]:bg-cyan-300"
        />
      )}
    </div>
  );
};

export const Hand = React.memo(HandInner);
