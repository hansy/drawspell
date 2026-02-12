import React from "react";

import type { Card } from "@/types";

import { cn } from "@/lib/utils";
import { CardView } from "../card/Card";
import { useTwoFingerScroll } from "@/hooks/shared/useTwoFingerScroll";

const TOUCH_CONTEXT_MENU_LONG_PRESS_MS = 500;
const TOUCH_MOVE_TOLERANCE_PX = 10;

type TouchPointState = {
  cardId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  target: HTMLDivElement;
  moved: boolean;
};

export interface ZoneViewerGroupedViewProps {
  sortedKeys: string[];
  groupedCards: Record<string, Card[]>;
  cardWidthPx: number;
  cardHeightPx: number;
  interactionsDisabled: boolean;
  pinnedCardId?: string;
  onCardContextMenu: (e: React.MouseEvent, card: Card) => void;
}

type GroupedColumnProps = {
  groupKey: string;
  cardsInGroup: Card[];
  cardWidthPx: number;
  cardHeightPx: number;
  interactionsDisabled: boolean;
  pinnedCardId?: string;
  onCardContextMenu: (e: React.MouseEvent, card: Card) => void;
  columnWidthPx: number;
  overlapPx: number;
  paddingBottomPx: number;
};

const GroupedColumn: React.FC<GroupedColumnProps> = ({
  groupKey,
  cardsInGroup,
  cardWidthPx,
  cardHeightPx,
  interactionsDisabled,
  pinnedCardId,
  onCardContextMenu,
  columnWidthPx,
  overlapPx,
  paddingBottomPx,
}) => {
  const [scrollNode, setScrollNode] = React.useState<HTMLDivElement | null>(null);
  useTwoFingerScroll({ target: scrollNode, axis: "y" });
  const touchPointsRef = React.useRef<Map<number, TouchPointState>>(new Map());
  const touchHoldTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const touchHoldPointerIdRef = React.useRef<number | null>(null);

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

  const beginTouchHold = React.useCallback((pointerId: number) => {
    if (interactionsDisabled) return;
    const point = touchPointsRef.current.get(pointerId);
    if (!point) return;
    const targetCard = cardsInGroup.find((card) => card.id === point.cardId);
    if (!targetCard) return;

    touchHoldPointerIdRef.current = pointerId;
    clearTouchHoldTimeout();
    touchHoldTimeoutRef.current = setTimeout(() => {
      if (touchHoldPointerIdRef.current !== pointerId) return;
      if (touchPointsRef.current.size !== 1) return;
      const currentPoint = touchPointsRef.current.get(pointerId);
      if (!currentPoint) return;
      if (currentPoint.moved) return;
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
    cardsInGroup,
    clearTouchHoldTimeout,
    interactionsDisabled,
    onCardContextMenu,
  ]);

  const handleTouchPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, cardId: string) => {
      if (event.pointerType !== "touch") return;
      if (interactionsDisabled) return;
      if (event.button !== 0) return;

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failures on unsupported environments.
      }

      touchPointsRef.current.set(event.pointerId, {
        cardId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        target: event.currentTarget,
        moved: false,
      });

      const pointCount = touchPointsRef.current.size;
      if (pointCount === 1) {
        beginTouchHold(event.pointerId);
        return;
      }
      if (pointCount > 1) {
        cancelTouchHold();
      }
    },
    [beginTouchHold, cancelTouchHold, interactionsDisabled]
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
    },
    [cancelTouchHold]
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
    },
    [cancelTouchHold]
  );

  React.useEffect(() => {
    return () => {
      cancelTouchHold();
      touchPointsRef.current.clear();
    };
  }, [cancelTouchHold]);

  return (
    <div className="shrink-0 flex flex-col" style={{ width: columnWidthPx }}>
      <h3 className="text-sm font-medium text-zinc-400 border-b border-zinc-800/50 pb-2 mb-4 text-center sticky top-0 bg-zinc-950/50 backdrop-blur-sm z-10">
        {groupKey} ({cardsInGroup.length})
      </h3>
      <div
        ref={setScrollNode}
        className="relative flex-1 overflow-y-auto overflow-x-hidden flex flex-col touch-none"
        style={{
          pointerEvents: interactionsDisabled ? "none" : "auto",
          paddingBottom: paddingBottomPx,
        }}
      >
        {cardsInGroup.map((card, index) => {
          const isPinned = pinnedCardId === card.id;
          return (
            <div
              key={card.id}
              data-zone-viewer-card-id={card.id}
              className={cn(
                "mx-auto transition-all duration-200",
                !interactionsDisabled && "hover:z-[100] hover:scale-110 hover:!mb-4",
                isPinned && "scale-110 shadow-xl"
              )}
              style={{
                width: `${cardWidthPx}px`,
                height: `${cardHeightPx}px`,
                marginBottom: isPinned
                  ? `${Math.round(cardHeightPx * 0.06)}px`
                  : `-${overlapPx}px`,
                zIndex: isPinned ? 200 : index,
              }}
              onPointerDown={(event) => handleTouchPointerDown(event, card.id)}
              onPointerMove={handleTouchPointerMove}
              onPointerUp={finishTouchPointer}
              onPointerCancel={finishTouchPointer}
              onPointerLeave={finishTouchPointer}
            >
              <CardView
                card={card}
                faceDown={false}
                style={{ width: cardWidthPx, height: cardHeightPx }}
                className="w-full shadow-lg h-full"
                imageClassName="object-top"
                preferArtCrop={false}
                onContextMenu={(e) => onCardContextMenu(e, card)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ZoneViewerGroupedView: React.FC<ZoneViewerGroupedViewProps> = ({
  sortedKeys,
  groupedCards,
  cardWidthPx,
  cardHeightPx,
  interactionsDisabled,
  pinnedCardId,
  onCardContextMenu,
}) => {
  const stackOffsetPx = Math.max(24, Math.round(cardHeightPx * 0.2));
  const overlapPx = cardHeightPx - stackOffsetPx;
  const columnWidthPx = Math.round(cardWidthPx + 24);
  const paddingBottomPx = Math.round(cardHeightPx);
  return (
    <div className="flex gap-8 h-full">
      {sortedKeys.map((key) => {
        const cardsInGroup = groupedCards[key] ?? [];

        return (
          <GroupedColumn
            key={key}
            groupKey={key}
            cardsInGroup={cardsInGroup}
            cardWidthPx={cardWidthPx}
            cardHeightPx={cardHeightPx}
            interactionsDisabled={interactionsDisabled}
            pinnedCardId={pinnedCardId}
            onCardContextMenu={onCardContextMenu}
            columnWidthPx={columnWidthPx}
            overlapPx={overlapPx}
            paddingBottomPx={paddingBottomPx}
          />
        );
      })}
    </div>
  );
};
