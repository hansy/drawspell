import React from "react";
import { cn } from "@/lib/utils";
import { Zone as ZoneType, Card as CardType, ViewerRole } from "@/types";
import { Card } from "../card/Card";
import { Zone } from "../zone/Zone";
import { ZONE_LABEL } from "@/constants/zones";
import { shouldRenderFaceDown } from "@/lib/reveal";
import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from "@/lib/constants";
import { debugLog, isDebugEnabled, summarizeDndCardGeometry } from "@/lib/debug";
import { useDragStore } from "@/store/dragStore";
import { useTwoFingerScroll } from "@/hooks/shared/useTwoFingerScroll";
import {
  HAND_BASE_CARD_SCALE,
  HAND_CARD_OVERLAP_RATIO,
  HAND_CARD_TOP_GAP_PX,
} from "./handSizing";
import {
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
    const isSourceVisualSuppressed = isDragging || isPendingDrop;

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
        isDragging,
        isPendingDrop,
        isSourceVisualSuppressed,
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
      isPendingDrop,
      isSourceVisualSuppressed,
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
          "relative shrink-0 h-full w-auto max-w-[var(--hand-card-max-width)] transition-all duration-200 ease-out group",
          "hover:max-w-[20rem] hover:z-50 hover:scale-110",
          isSourceVisualSuppressed && "z-50 opacity-0",
        )}
        {...attributes}
        {...listeners}
      >
        <div
          data-dnd-hand-card-frame-id={card.id}
          className={cn(
            "w-auto aspect-[11/15] transition-transform duration-200",
          )}
        >
          <Card
            card={card}
            className="shadow-xl origin-top"
            faceDown={shouldRenderFaceDown(
              card,
              "hand",
              viewerPlayerId,
              viewerRole,
            )}
            onContextMenu={handleContextMenu}
            disableDrag // We use Sortable's drag handle
            isDragging={isSourceVisualSuppressed}
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
  // Memoize card IDs array for SortableContext
  const cardIds = React.useMemo(() => cards.map((c) => c.id), [cards]);
  const [handScrollNode, setHandScrollNode] =
    React.useState<HTMLDivElement | null>(null);
  useTwoFingerScroll({ target: handScrollNode, axis: "x" });
  const touchPressTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPressRef = React.useRef<TouchPressState | null>(null);

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
        innerRef={setHandScrollNode}
        onContextMenu={handleHandContextMenu}
        onPointerDown={handleTouchContextMenuStart}
        onPointerMove={handleTouchContextMenuMove}
        onPointerUp={handleTouchContextMenuEnd}
        onPointerCancel={handleTouchContextMenuEnd}
        onPointerLeave={handleTouchContextMenuEnd}
        className={cn(
          "w-full h-full flex overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent overscroll-x-none touch-none",
        )}
      >
        <SortableContext
          items={cardIds}
          strategy={horizontalListSortingStrategy}
        >
          <div
            className={cn(
              "flex w-full h-full gap-0 items-start justify-center",
            )}
            style={{ paddingTop: HAND_CARD_TOP_GAP_PX }}
          >
            {/*
              Keep single-card hands visually centered by using a full-width slot.
              Overlap slot widths remain for multi-card hands.
            */}
            {cards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                isMe={isMe}
                viewerPlayerId={viewerPlayerId}
                viewerRole={viewerRole}
                onCardContextMenu={onCardContextMenu}
                cardScale={cardScale}
                baseCardHeight={baseCardHeight}
                useFullSlotWidth={cards.length === 1}
                renderedZoneId={zone.id}
              />
            ))}
          </div>
        </SortableContext>
      </Zone>
    </div>
  );
};

export const Hand = React.memo(HandInner);
