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
  baseCardHeight?: number;
  showLabel?: boolean;
  dropDisabled?: boolean;
}

const TOUCH_CONTEXT_MENU_LONG_PRESS_MS = 500;
const TOUCH_MOVE_TOLERANCE_PX = 10;
const HAND_SCROLLBAR_MIN_OVERFLOW_PX = 1;
const HAND_SCROLL_DEBUG_MIN_DELTA_PX = 4;

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
    baseCardHeight,
    useFullSlotWidth,
    renderedZoneId,
  }: {
    card: CardType;
    isMe: boolean;
    viewerPlayerId: string;
    viewerRole?: ViewerRole;
    onCardContextMenu?: (e: React.MouseEvent, card: CardType) => void;
    cardScale: number;
    baseCardHeight?: number;
    useFullSlotWidth: boolean;
    renderedZoneId: string;
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
      },
      disabled: !isMe,
    });
    const isPendingDrop = useDragStore((state) =>
      state.pendingDropVisualClaims.some(
        (claim) =>
          claim.cardId === card.id && claim.sourceZoneId === renderedZoneId,
      ),
    );
    const isActiveDragSource = useDragStore(
      (state) => state.activeCardId === card.id
    );
    const isCardFaceSuppressed = isActiveDragSource || isPendingDrop;

    const resolvedBaseHeight = baseCardHeight ?? BASE_CARD_HEIGHT;
    const cardWidth = resolvedBaseHeight * CARD_ASPECT_RATIO * cardScale;
    const overlapWidth = useFullSlotWidth
      ? cardWidth
      : cardWidth * HAND_CARD_OVERLAP_RATIO;

    const style = React.useMemo(() => {
      return {
        transform: CSS.Transform.toString(transform),
        transition,
        ["--hand-card-max-width" as string]: `${overlapWidth}px`,
      } as React.CSSProperties;
    }, [transform, transition, overlapWidth]);

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
        className={cn(
          "relative shrink-0 h-full w-auto max-w-[var(--hand-card-max-width)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group",
          "hover:-translate-y-3",
          isActiveDragSource && "z-50",
          isPendingDrop && "z-50 opacity-0",
        )}
        {...attributes}
        {...listeners}
      >
        <div
          data-dnd-hand-drop-preview-card-id={
            isActiveDragSource ? card.id : undefined
          }
          data-dnd-hand-card-frame-id={card.id}
          className={cn(
            "w-auto aspect-[11/15] transition-transform duration-200",
          )}
          style={{
            opacity: isActiveDragSource ? 0.45 : undefined,
            transition: "opacity 160ms ease-out",
          }}
        >
          <Card
            card={card}
            className={cn(
              "origin-top shadow-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "group-hover:ring-2 group-hover:ring-cyan-200/90 group-hover:ring-offset-2 group-hover:ring-offset-zinc-950",
              "hover:ring-2 hover:ring-cyan-200/90 hover:ring-offset-2 hover:ring-offset-zinc-950",
              "group-hover:shadow-[0_16px_36px_rgba(103,232,249,0.3)]",
              isActiveDragSource &&
                "ring-2 ring-cyan-200/90 ring-offset-2 ring-offset-zinc-950 shadow-[0_16px_36px_rgba(103,232,249,0.25)]",
            )}
            style={{
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
  baseCardHeight,
  showLabel = true,
  dropDisabled = false,
}) => {
  const handDragPreview = useDragStore((state) => state.handDragPreview);
  const displayCards = React.useMemo(() => {
    if (!handDragPreview || handDragPreview.zoneId !== zone.id) return cards;
    const oldIndex = cards.findIndex((card) => card.id === handDragPreview.cardId);
    if (oldIndex === -1) return cards;
    const targetIndex = Math.max(
      0,
      Math.min(cards.length - 1, handDragPreview.targetIndex)
    );
    if (oldIndex === targetIndex) return cards;
    return arrayMove(cards, oldIndex, targetIndex);
  }, [cards, handDragPreview, zone.id]);
  // Memoize card IDs array for SortableContext
  const cardIds = React.useMemo(
    () => displayCards.map((card) => card.id),
    [displayCards]
  );
  const isSingleCardHand = cards.length === 1;
  const touchPressTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPressRef = React.useRef<TouchPressState | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const lastLoggedScrollLeftRef = React.useRef<number | null>(null);
  const [scrollbarState, setScrollbarState] = React.useState({
    left: 0,
    max: 0,
    visible: false,
  });

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

  return (
    <div
      className={cn(
        "h-full flex-1 relative min-w-0 w-0", // w-0 enforces flex width constraint
        // Distinct background for hand area
        "bg-zinc-900/60 backdrop-blur-sm",
        isTop ? "border-b border-white/10" : "border-t border-white/10",
        // Padding to prevent bleeding into adjacent seats
        "px-4",
        className,
      )}
    >
      {showLabel && (
        <div
          className={cn(
            "absolute px-3 py-1 lg:text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-zinc-700/70 rounded-full z-40 pointer-events-none select-none shadow-[0_2px_10px_rgba(0,0,0,0.45)]",
            // Vertical positioning: straddle the border
            isTop ? "-bottom-3" : "-top-3",
            // Horizontal positioning: opposite to sidebar
            // If sidebar is Right (isRight), label is Left
            // If sidebar is Left (!isRight), label is Right
            isRight ? "left-8" : "right-8",
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
          "w-full h-full flex overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent overscroll-x-none touch-pan-x",
        )}
      >
        <SortableContext
          items={cardIds}
          strategy={horizontalListSortingStrategy}
        >
          <div
            data-dnd-hand-card-strip
            className={cn(
              "flex h-full gap-0 items-start",
              isSingleCardHand
                ? "w-full justify-center"
                : "box-content w-max min-w-full shrink-0 justify-start",
            )}
            style={{
              paddingTop: HAND_CARD_TOP_GAP_PX,
              paddingLeft: HAND_CARD_SCROLL_EDGE_PADDING_PX,
              paddingRight: HAND_CARD_SCROLL_EDGE_PADDING_PX,
            }}
          >
            {/*
              Keep single-card hands visually centered by using a full-width slot.
              Overlap slot widths remain for multi-card hands.
            */}
            {displayCards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                isMe={isMe}
                viewerPlayerId={viewerPlayerId}
                viewerRole={viewerRole}
                onCardContextMenu={onCardContextMenu}
                cardScale={cardScale}
                baseCardHeight={baseCardHeight}
                useFullSlotWidth={isSingleCardHand}
                renderedZoneId={zone.id}
              />
            ))}
          </div>
        </SortableContext>
      </Zone>
      {scrollbarState.visible && (
        <input
          aria-label={`${ZONE_LABEL.hand} scroll`}
          data-dnd-hand-scrollbar
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
