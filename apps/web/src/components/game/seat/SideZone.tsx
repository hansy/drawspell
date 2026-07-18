import React from "react";
import { Card as CardType, Zone as ZoneType, ZoneId } from "@/types";
import { Zone } from "../zone/Zone";
import { Card } from "../card/Card";
import { cn } from "@/lib/utils";
import { CARD_ASPECT_RATIO, ZONE_SIDEWAYS_CLASSES } from "@/lib/constants";
import { ZONE } from "@/constants/zones";
import {
  TOUCH_CONTEXT_MENU_LONG_PRESS_MS,
  TOUCH_MOVE_TOLERANCE_PX,
} from "@/lib/touchGestures";

const TOUCH_DOUBLE_TAP_MS = 280;
const NATIVE_CLICK_SUPPRESSION_MS = 450;

type TouchPressState = {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  target: HTMLDivElement;
  moved: boolean;
  longPressTriggered: boolean;
};

interface SideZoneProps {
  zone: ZoneType;
  card?: CardType;
  label: string;
  count: number;
  onContextMenu?: (e: React.MouseEvent, zoneId: ZoneId) => void;
  onClick?: (e: React.MouseEvent, zoneId: ZoneId) => void;
  onDoubleClick?: (e: React.MouseEvent, zoneId: ZoneId) => void;
  emptyContent?: React.ReactNode;
  cardClassName?: string;
  faceDown?: boolean;
  disableCardDrag?: boolean;
  showContextMenuCursor?: boolean;
  rightIndicator?: React.ReactNode;
  indicatorSide?: "left" | "right";
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  variant?: "side" | "edge";
  cardHeight?: number;
  visibleHeight?: number;
  flipCard?: boolean;
}

export const shouldDisableSideZoneCardDrag = (
  zoneType: ZoneType["type"],
  disableCardDrag = false,
) => disableCardDrag || zoneType === ZONE.LIBRARY;

// Shared rendering for vertical sidebar zones (library/graveyard/exile).
export const SideZone: React.FC<SideZoneProps> = ({
  zone,
  card,
  label,
  count,
  onContextMenu,
  onClick,
  onDoubleClick,
  emptyContent,
  cardClassName,
  faceDown,
  disableCardDrag,
  showContextMenuCursor,
  rightIndicator,
  indicatorSide = "right",
  onMouseEnter,
  onMouseLeave,
  variant = "side",
  cardHeight,
  visibleHeight,
  flipCard = false,
}) => {
  const cardDragDisabled = shouldDisableSideZoneCardDrag(
    zone.type,
    disableCardDrag,
  );
  const touchPressTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const touchPressRef = React.useRef<TouchPressState | null>(null);
  const lastTapRef = React.useRef<{
    timestamp: number;
  } | null>(null);
  const suppressNativeUntilRef = React.useRef(0);

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

  const suppressNativeMouseEvents = React.useCallback(() => {
    suppressNativeUntilRef.current = Date.now() + NATIVE_CLICK_SUPPRESSION_MS;
  }, []);

  const shouldSuppressNativeMouseEvents = React.useCallback(
    () => Date.now() < suppressNativeUntilRef.current,
    []
  );

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      onContextMenu?.(event, zone.id);
    },
    [onContextMenu, zone.id]
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (shouldSuppressNativeMouseEvents()) return;
      onClick?.(event, zone.id);
    },
    [onClick, shouldSuppressNativeMouseEvents, zone.id]
  );

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (shouldSuppressNativeMouseEvents()) return;
      onDoubleClick?.(event, zone.id);
    },
    [onDoubleClick, shouldSuppressNativeMouseEvents, zone.id]
  );

  const handleTouchPressStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      if (event.button !== 0) return;

      if (
        touchPressRef.current &&
        touchPressRef.current.pointerId !== event.pointerId
      ) {
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
        longPressTriggered: false,
      };
      touchPressRef.current = press;
      clearTouchPressTimeout();
      touchPressTimeoutRef.current = setTimeout(() => {
        const currentPress = touchPressRef.current;
        if (!currentPress) return;
        if (currentPress.pointerId !== press.pointerId) return;
        if (currentPress.moved) return;
        currentPress.longPressTriggered = true;
        touchPressTimeoutRef.current = null;
        suppressNativeMouseEvents();
        onContextMenu?.(
          {
            preventDefault: () => {},
            stopPropagation: () => {},
            clientX: currentPress.clientX,
            clientY: currentPress.clientY,
            currentTarget: currentPress.target,
            target: currentPress.target,
          } as unknown as React.MouseEvent,
          zone.id
        );
      }, TOUCH_CONTEXT_MENU_LONG_PRESS_MS);
    },
    [
      clearTouchPress,
      clearTouchPressTimeout,
      onContextMenu,
      suppressNativeMouseEvents,
      zone.id,
    ]
  );

  const handleTouchPressMove = React.useCallback(
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
    [clearTouchPressTimeout]
  );

  const handleTouchPressEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const press = touchPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      press.clientX = event.clientX;
      press.clientY = event.clientY;
      clearTouchPressTimeout();
      touchPressRef.current = null;
      suppressNativeMouseEvents();

      if (press.longPressTriggered || press.moved) return;

      const now = Date.now();
      const previousTap = lastTapRef.current;
      const isDoubleTap = Boolean(
        previousTap &&
          now - previousTap.timestamp <= TOUCH_DOUBLE_TAP_MS
      );
      if (isDoubleTap) {
        lastTapRef.current = null;
        onDoubleClick?.(event as unknown as React.MouseEvent, zone.id);
        return;
      }

      lastTapRef.current = {
        timestamp: now,
      };
      onClick?.(event as unknown as React.MouseEvent, zone.id);
    },
    [
      clearTouchPressTimeout,
      onClick,
      onDoubleClick,
      suppressNativeMouseEvents,
      zone.id,
    ]
  );

  const handleTouchPressCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const press = touchPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      clearTouchPress();
      suppressNativeMouseEvents();
    },
    [clearTouchPress, suppressNativeMouseEvents]
  );

  React.useEffect(() => {
    return () => {
      clearTouchPress();
    };
  }, [clearTouchPress]);

  if (variant === "edge") {
    return (
      <div
        data-side-zone-variant="edge"
        className="group/edge-zone relative h-full min-w-0 overflow-hidden touch-manipulation select-none"
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handleTouchPressStart}
        onPointerMove={handleTouchPressMove}
        onPointerUp={handleTouchPressEnd}
        onPointerCancel={handleTouchPressCancel}
        onPointerLeave={handleTouchPressCancel}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        <Zone
          zone={zone}
          className={cn(
            "group absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-lg bg-zinc-900/25 transition-colors duration-150",
            cardHeight === undefined && "top-2 aspect-[11/15] w-[104%] max-w-44",
            cardHeight !== undefined && "top-0",
            !card &&
              zone.type !== ZONE.LIBRARY &&
              "border-2 border-dotted border-zinc-700/80 hover:border-zinc-500/80",
            "hover:bg-zinc-800/40",
            showContextMenuCursor
              ? "cursor-context-menu"
              : onClick && "cursor-pointer",
          )}
          style={
            cardHeight === undefined
              ? undefined
              : {
                  height: cardHeight,
                  width: cardHeight * CARD_ASPECT_RATIO,
                }
          }
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {rightIndicator && (
            <div className="ds-seat-upright pointer-events-none absolute right-1 top-1 z-20 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
              {rightIndicator}
            </div>
          )}

          {card ? (
            <Card
              card={card}
              style={{ width: "100%", height: "100%" }}
              faceDown={faceDown}
              disableDrag={cardDragDisabled}
              disableInteractions
              disableHoverAnimation
              className={cn(
                "ds-seat-upright h-full w-full",
                flipCard && "rotate-180",
                cardClassName,
              )}
            />
          ) : (
            <div
              data-edge-zone-empty-content
              className="relative w-full overflow-hidden rounded-lg"
              style={{ height: visibleHeight ?? "100%" }}
            >
              {emptyContent ?? (
                <span
                  data-edge-zone-empty-label
                  className={cn(
                    "absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 text-xs text-zinc-500",
                    "ds-seat-upright",
                  )}
                >
                  {label}
                </span>
              )}
            </div>
          )}

        </Zone>

        <div
          data-edge-zone-label
          className={cn(
            "ds-edge-zone-label pointer-events-none invisible absolute bottom-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-zinc-700/70 bg-zinc-900 font-bold uppercase text-zinc-400 opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition-[opacity,visibility] duration-150 group-hover/edge-zone:visible group-hover/edge-zone:opacity-100 group-focus-within/edge-zone:visible group-focus-within/edge-zone:opacity-100 motion-reduce:transition-none select-none",
            "ds-seat-upright",
          )}
        >
          {label} - {count}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative group w-full h-[var(--sidezone-h)] min-h-0 shrink-0 flex items-center justify-center touch-manipulation select-none"
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handleTouchPressStart}
      onPointerMove={handleTouchPressMove}
      onPointerUp={handleTouchPressEnd}
      onPointerCancel={handleTouchPressCancel}
      onPointerLeave={handleTouchPressCancel}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <Zone
        zone={zone}
        className={cn(
          ZONE_SIDEWAYS_CLASSES,
          "bg-zinc-800/30 rounded-lg border-2 border-dotted border-zinc-700 flex items-center justify-center relative transition-colors duration-150 p-[var(--sidezone-pad)]",
          "hover:bg-zinc-800/50 hover:border-zinc-500/80 hover:shadow-[0_0_0_1px_rgba(148,163,184,0.3)]",
          showContextMenuCursor
            ? "cursor-context-menu"
            : onClick && "cursor-pointer",
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {rightIndicator && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 pointer-events-none z-[10] drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]",
              // Keep the indicator "inland" by placing it inside the zone bounds.
              indicatorSide === "left" ? "left-[-20px]" : "right-[-20px]",
            )}
          >
            {rightIndicator}
          </div>
        )}
        {card ? (
          <div className="w-full h-full relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full aspect-[2/3] rotate-90 scale-[var(--sidezone-card-scale)] origin-center">
                <Card
                  card={card}
                  style={{ width: "100%", height: "100%" }}
                  faceDown={faceDown}
                  disableDrag={cardDragDisabled}
                  disableInteractions
                  disableHoverAnimation
                  className={cn("w-full h-full", cardClassName)}
                />
              </div>
            </div>
          </div>
        ) : (
          (emptyContent ?? <span className="text-zinc-600 text-xs">{label}</span>)
        )}

        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 px-2 text-xs text-zinc-400 uppercase tracking-wider font-medium whitespace-nowrap border border-zinc-800 rounded-full z-10 top-0 pointer-events-none select-none">
          {label}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 bg-zinc-900 px-2 lg:text-xs text-zinc-300 font-mono border border-zinc-800 rounded-full z-10 bottom-0 pointer-events-none select-none">
          {count}
        </div>
      </Zone>
    </div>
  );
};
