import React from "react";

import type { Card } from "@/types";

import { cn } from "@/lib/utils";
import { CardView } from "../card/Card";
import { useTwoFingerScroll } from "@/hooks/shared/useTwoFingerScroll";

const TOUCH_CONTEXT_MENU_LONG_PRESS_MS = 500;
const TOUCH_MOVE_TOLERANCE_PX = 10;
const TOUCH_REORDER_START_PX = 4;

type TouchPointState = {
  cardId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  target: HTMLDivElement;
  moved: boolean;
};

type TouchDragState = {
  pointerId: number;
  draggedCardId: string;
  started: boolean;
};

export interface ZoneViewerLinearViewProps {
  orderedCards: Card[];
  canReorder: boolean;
  orderedCardIds: string[];
  setOrderedCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  reorderList: (ids: string[], draggingId: string, overId: string) => string[];
  commitReorder: (newOrder: string[]) => void;
  displayCards: Card[];
  interactionsDisabled: boolean;
  pinnedCardId?: string;
  onCardContextMenu: (e: React.MouseEvent, card: Card) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  cardWidthPx: number;
  cardHeightPx: number;
}

export const ZoneViewerLinearView: React.FC<ZoneViewerLinearViewProps> = ({
  orderedCards,
  canReorder,
  orderedCardIds,
  setOrderedCardIds,
  draggingId,
  setDraggingId,
  reorderList,
  commitReorder,
  displayCards,
  interactionsDisabled,
  pinnedCardId,
  onCardContextMenu,
  listRef,
  cardWidthPx,
  cardHeightPx,
}) => {
  const renderCards = React.useMemo(() => [...orderedCards].reverse(), [orderedCards]);
  const cardsById = React.useMemo(
    () => new Map(renderCards.map((card) => [card.id, card])),
    [renderCards]
  );
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [scrollNode, setScrollNode] = React.useState<HTMLDivElement | null>(null);
  useTwoFingerScroll({ target: scrollNode, axis: "x" });
  const latestOrderRef = React.useRef<string[]>([]);
  const touchPointsRef = React.useRef<Map<number, TouchPointState>>(new Map());
  const touchHoldTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const touchHoldPointerIdRef = React.useRef<number | null>(null);
  const touchDragRef = React.useRef<TouchDragState | null>(null);
  const touchContextMenuTriggeredRef = React.useRef(false);

  React.useEffect(() => {
    latestOrderRef.current = orderedCardIds.length
      ? orderedCardIds
      : displayCards.map((card) => card.id);
  }, [displayCards, orderedCardIds]);

  const clearTouchHoldTimeout = React.useCallback(() => {
    if (touchHoldTimeoutRef.current) {
      clearTimeout(touchHoldTimeoutRef.current);
      touchHoldTimeoutRef.current = null;
    }
  }, []);

  const cancelTouchHold = React.useCallback(() => {
    clearTouchHoldTimeout();
    touchHoldPointerIdRef.current = null;
  }, [clearTouchHoldTimeout]);

  const reorderFromTouch = React.useCallback(
    (draggedCardId: string, overCardId: string) => {
      const source = latestOrderRef.current.length
        ? latestOrderRef.current
        : displayCards.map((card) => card.id);
      const rendered = [...source].reverse();
      const reordered = reorderList(rendered, draggedCardId, overCardId);
      const nextOrder = reordered.reverse();
      latestOrderRef.current = nextOrder;
      setOrderedCardIds(nextOrder);
    },
    [displayCards, reorderList, setOrderedCardIds]
  );

  const beginTouchHold = React.useCallback((pointerId: number) => {
    if (interactionsDisabled) return;
    const point = touchPointsRef.current.get(pointerId);
    if (!point) return;
    const targetCard = cardsById.get(point.cardId);
    if (!targetCard) return;

    touchHoldPointerIdRef.current = pointerId;
    clearTouchHoldTimeout();
    touchHoldTimeoutRef.current = setTimeout(() => {
      if (touchHoldPointerIdRef.current !== pointerId) return;
      if (touchPointsRef.current.size !== 1) return;
      const currentPoint = touchPointsRef.current.get(pointerId);
      if (!currentPoint) return;
      if (currentPoint.moved) return;
      touchContextMenuTriggeredRef.current = true;
      touchDragRef.current = null;
      setDraggingId(null);
      cancelTouchHold();
      onCardContextMenu(
        {
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: currentPoint.x,
          clientY: currentPoint.y,
          currentTarget: currentPoint.target,
          target: currentPoint.target,
        } as unknown as React.MouseEvent,
        targetCard
      );
    }, TOUCH_CONTEXT_MENU_LONG_PRESS_MS);
  }, [
    cancelTouchHold,
    cardsById,
    clearTouchHoldTimeout,
    interactionsDisabled,
    onCardContextMenu,
    setDraggingId,
  ]);

  const handleTouchPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, card: Card) => {
      if (event.pointerType !== "touch") return;
      if (interactionsDisabled) return;
      if (event.button !== 0) return;

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failures on unsupported environments.
      }

      touchPointsRef.current.set(event.pointerId, {
        cardId: card.id,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        target: event.currentTarget,
        moved: false,
      });

      const pointCount = touchPointsRef.current.size;
      if (pointCount === 1) {
        touchContextMenuTriggeredRef.current = false;
        touchDragRef.current = canReorder
          ? {
              pointerId: event.pointerId,
              draggedCardId: card.id,
              started: false,
            }
          : null;
        beginTouchHold(event.pointerId);
      } else {
        touchDragRef.current = null;
        setDraggingId(null);
        cancelTouchHold();
      }
    },
    [beginTouchHold, canReorder, cancelTouchHold, interactionsDisabled, setDraggingId]
  );

  const handleTouchPointerMove = React.useCallback(
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

      if (
        touchHoldPointerIdRef.current === event.pointerId &&
        point.moved
      ) {
        cancelTouchHold();
      }

      const drag = touchDragRef.current;
      if (!drag) return;
      if (drag.pointerId !== event.pointerId) return;
      if (touchPointsRef.current.size !== 1) return;
      if (!canReorder || touchContextMenuTriggeredRef.current) return;

      if (!drag.started) {
        const movement = Math.hypot(point.x - point.startX, point.y - point.startY);
        if (movement <= TOUCH_REORDER_START_PX) return;
        drag.started = true;
        setDraggingId(drag.draggedCardId);
      }

      event.preventDefault();
      const elementFromPoint =
        typeof document.elementFromPoint === "function"
          ? document.elementFromPoint.bind(document)
          : null;
      if (!elementFromPoint) return;
      const target = elementFromPoint(event.clientX, event.clientY)?.closest(
        "[data-zone-viewer-card-id]"
      );
      const overCardId = target?.getAttribute("data-zone-viewer-card-id");
      if (!overCardId) return;
      if (overCardId === drag.draggedCardId) return;
      reorderFromTouch(drag.draggedCardId, overCardId);
    },
    [canReorder, cancelTouchHold, reorderFromTouch, setDraggingId]
  );

  const finishTouchPointer = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const point = touchPointsRef.current.get(event.pointerId);
      if (!point) return;

      if (
        typeof event.currentTarget.hasPointerCapture === "function" &&
        typeof event.currentTarget.releasePointerCapture === "function" &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      touchPointsRef.current.delete(event.pointerId);
      if (touchHoldPointerIdRef.current === event.pointerId) {
        cancelTouchHold();
      }

      const drag = touchDragRef.current;
      if (drag && drag.pointerId === event.pointerId) {
        const shouldCommit =
          drag.started && !touchContextMenuTriggeredRef.current;
        touchDragRef.current = null;
        setDraggingId(null);
        if (shouldCommit) {
          commitReorder(latestOrderRef.current);
        }
      }

      if (touchPointsRef.current.size === 0) {
        touchContextMenuTriggeredRef.current = false;
      }
    },
    [cancelTouchHold, commitReorder, setDraggingId]
  );

  React.useEffect(() => {
    return () => {
      cancelTouchHold();
      touchPointsRef.current.clear();
      touchDragRef.current = null;
    };
  }, [cancelTouchHold]);
  const hoveredIndex = React.useMemo(() => {
    if (!hoveredId) return -1;
    return renderCards.findIndex((card) => card.id === hoveredId);
  }, [hoveredId, renderCards]);
  const setListRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      setScrollNode(node);
    },
    [listRef]
  );
  const effectiveCardHeightPx = Math.max(1, Math.round(cardHeightPx));
  const effectiveCardWidthPx = Math.max(1, Math.round(cardWidthPx));
  const slotWidthPx = Math.max(50, Math.round(effectiveCardWidthPx * 0.28));
  const maxSpreadPx = Math.round(effectiveCardWidthPx * 0.5);
  const decayPx = Math.max(8, Math.round(effectiveCardWidthPx * 0.07));

  return (
    <div
      ref={setListRef}
      className="flex items-center overflow-x-auto px-24 py-8 touch-none"
      style={{ pointerEvents: interactionsDisabled ? "none" : "auto" }}
    >
      {renderCards.map((card, index) => {
        const isPinned = pinnedCardId === card.id;
        const isDragging = draggingId === card.id;
        const isHovered = hoveredId === card.id;
        const distance = hoveredIndex < 0 ? -1 : Math.abs(index - hoveredIndex);
        const offset = (() => {
          if (hoveredIndex < 0) return 0;
          if (distance === 0) return 0;
          const direction = index < hoveredIndex ? -1 : 1;
          const magnitude = Math.max(0, maxSpreadPx - (distance - 1) * decayPx);
          return direction * magnitude;
        })();
        const scale = isPinned ? 1.1 : isHovered ? 1.08 : 1;
        const zIndex = (() => {
          if (isPinned) return 300;
          if (isHovered) return 200;
          if (hoveredIndex < 0) return renderCards.length - index;
          return 150 - distance;
        })();
        return (
          <div
            key={card.id}
            data-zone-viewer-card-id={card.id}
            draggable={canReorder}
            onDragStart={() => canReorder && setDraggingId(card.id)}
            onDragEnter={(e) => {
              if (!canReorder || !draggingId) return;
              e.preventDefault();
              setOrderedCardIds((ids) => {
                const source = ids.length ? ids : displayCards.map((c) => c.id);
                const rendered = [...source].reverse();
                const reordered = reorderList(rendered, draggingId, card.id);
                return reordered.reverse();
              });
            }}
            onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
            onDragEnd={() => {
              if (!canReorder || !draggingId) return;
              commitReorder(orderedCardIds.length ? orderedCardIds : displayCards.map((c) => c.id));
              setDraggingId(null);
            }}
            onDrop={(e) => {
              if (!canReorder) return;
              e.preventDefault();
            }}
            onMouseEnter={() => setHoveredId(card.id)}
            onMouseLeave={() =>
              setHoveredId((prev) => (prev === card.id ? null : prev))
            }
            onPointerDown={(event) => handleTouchPointerDown(event, card)}
            onPointerMove={handleTouchPointerMove}
            onPointerUp={finishTouchPointer}
            onPointerCancel={finishTouchPointer}
            onPointerLeave={finishTouchPointer}
            className={cn(
              "shrink-0 transition-transform duration-200 ease-out relative group flex items-start justify-center"
            )}
            style={{
              width: slotWidthPx,
              transform: `translateX(${offset}px) scale(${scale})`,
              zIndex,
              opacity: isDragging ? 0.5 : 1,
            }}
          >
            <div
              className="relative"
              style={{ width: effectiveCardWidthPx, height: effectiveCardHeightPx }}
            >
              {index === 0 && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md z-[101]">
                  Top card
                </div>
              )}
              <CardView
                card={card}
                faceDown={false}
                style={{ width: effectiveCardWidthPx, height: effectiveCardHeightPx }}
                className="w-full h-full shadow-lg"
                imageClassName="object-top"
                preferArtCrop={false}
                disableHoverAnimation
                onContextMenu={(e) => onCardContextMenu(e, card)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
