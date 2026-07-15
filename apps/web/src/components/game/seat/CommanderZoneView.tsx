import React from "react";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { MAX_COMMANDER_ZONE_CARDS } from "@mtg/shared/constants/limits";

import { cn } from "@/lib/utils";
import type { Zone as ZoneType, Card as CardType, ZoneId } from "@/types";
import { Tooltip } from "@/components/ui/tooltip";
import { ZONE_DRAG_OVERLAY_SCALE } from "@/lib/dndDragCue";
import { Card } from "../card/Card";
import { Zone } from "../zone/Zone";
import { COMMANDER_DRAWER_PADDING_PX } from "./handSizing";

import type { CommanderZoneController } from "@/hooks/game/seat/useCommanderZoneController";

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

export interface CommanderZoneViewProps extends CommanderZoneController {
  zone: ZoneType;
  cards: CardType[];
  isTop: boolean;
  isRight: boolean;
  onZoneContextMenu?: (e: React.MouseEvent, zoneId: ZoneId) => void;
  scale?: number;
  color?: string;
}

const COMMANDER_LIGHT_BY_SEAT_COLOR: Record<string, string> = {
  rose: "rgba(251, 113, 133, 0.95)",
  violet: "rgba(167, 139, 250, 0.95)",
  sky: "rgba(56, 189, 248, 0.95)",
  amber: "rgba(251, 191, 36, 0.95)",
};

const getCommanderPresenceGradient = (cardCount: number, color?: string) => {
  const white = "rgba(255, 255, 255, 0.96)";
  if (cardCount < 2) {
    return `linear-gradient(to bottom, ${white}, ${white})`;
  }
  const partner = COMMANDER_LIGHT_BY_SEAT_COLOR[color ?? ""] ??
    COMMANDER_LIGHT_BY_SEAT_COLOR.violet;
  return `linear-gradient(to bottom, ${white} 0%, ${white} 50%, ${partner} 50%, ${partner} 100%)`;
};

export const CommanderZoneView: React.FC<CommanderZoneViewProps> = ({
  zone,
  cards,
  isTop,
  isRight,
  onZoneContextMenu,
  scale = 1,
  color,
  isOwner,
  handleTaxDelta,
}) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const { active } = useDndContext();
  const [activeTaxCardId, setActiveTaxCardId] = React.useState<string | null>(null);
  const [touchExpanded, setTouchExpanded] = React.useState(false);
  const commanderDrop = useDroppable({
    id: `commander-drop-trigger:${zone.id}`,
    disabled: !isOwner || cards.length >= MAX_COMMANDER_ZONE_CARDS,
    data: {
      zoneId: zone.id,
      type: zone.type,
      dragOverlayScale: ZONE_DRAG_OVERLAY_SCALE,
      dragOverlayCue: "zone",
    },
  });
  const touchPressTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
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

  const handleTouchContextMenuStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!onZoneContextMenu) return;
      if (event.pointerType !== "touch") return;
      if (event.button !== 0) return;
      if (event.target instanceof HTMLElement) {
        if (event.target.closest("[data-card-id]")) return;
        if (event.target.closest("button")) return;
      }

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
      };
      touchPressRef.current = press;
      clearTouchPressTimeout();
      touchPressTimeoutRef.current = setTimeout(() => {
        const currentPress = touchPressRef.current;
        if (!currentPress) return;
        if (currentPress.pointerId !== press.pointerId) return;
        if (currentPress.moved) return;
        touchPressTimeoutRef.current = null;
        onZoneContextMenu(
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
    [clearTouchPress, clearTouchPressTimeout, onZoneContextMenu, zone.id]
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
    [clearTouchPressTimeout]
  );

  const handleTouchContextMenuEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      const press = touchPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      clearTouchPress();
    },
    [clearTouchPress]
  );

  React.useEffect(() => {
    return () => {
      clearTouchPress();
    };
  }, [clearTouchPress]);

  React.useEffect(() => {
    if (!activeTaxCardId && !touchExpanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setActiveTaxCardId(null);
      setTouchExpanded(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [activeTaxCardId, touchExpanded]);

  return (
    <div
      ref={rootRef}
      data-commander-zone-variant="drawer"
      className="group/commander-zone relative z-30 flex w-full items-center justify-center"
    >
      <button
        ref={commanderDrop.setNodeRef}
        type="button"
        data-commander-zone-label
        data-commander-drop-target="true"
        data-drag-overlay-scale={ZONE_DRAG_OVERLAY_SCALE}
        data-drop-active={commanderDrop.isOver ? "true" : "false"}
        aria-label="Open commander zone"
        aria-expanded={touchExpanded}
        onClick={() => setTouchExpanded((expanded) => !expanded)}
        className={cn(
          "relative z-40 flex h-[var(--commander-zone-label-height)] w-full shrink-0 items-center justify-center border-y border-white/10 bg-zinc-900/85 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/70",
          touchExpanded && "bg-zinc-800 text-white",
          commanderDrop.isOver &&
            "border-indigo-300 bg-indigo-500/30 text-indigo-50 ring-2 ring-inset ring-indigo-300 shadow-[0_0_16px_rgba(129,140,248,0.55)]",
        )}
        style={{ paddingBlock: "var(--commander-zone-label-padding)" }}
      >
        {cards.length > 0 && (
          <div
            aria-hidden="true"
            data-commander-presence-light
            data-commander-presence-segments={cards.length > 1 ? "2" : "1"}
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-px"
            style={{
              backgroundImage: getCommanderPresenceGradient(cards.length, color),
            }}
          >
            <div
              className="absolute -inset-x-1 inset-y-0 opacity-60 blur-[3px]"
              style={{
                backgroundImage: getCommanderPresenceGradient(cards.length, color),
              }}
            />
          </div>
        )}
        <span
          className={cn(
            "ds-seat-upright ds-seat-vertical-label whitespace-nowrap leading-none [writing-mode:vertical-rl]",
          )}
        >
          Commander
        </span>
      </button>

      <div
        data-commander-zone-panel
        className={cn(
          "absolute z-30 h-[var(--commander-drawer-height)] w-max transition-[clip-path,visibility] duration-200 ease-out motion-reduce:transition-none",
          isTop ? "top-0" : "bottom-0",
          isRight ? "right-full" : "left-full",
          touchExpanded
            ? "visible [clip-path:inset(0_0_0_0)]"
            : cn(
                "invisible group-hover/commander-zone:visible group-hover/commander-zone:[clip-path:inset(0_0_0_0)] group-focus-within/commander-zone:visible group-focus-within/commander-zone:[clip-path:inset(0_0_0_0)]",
                isRight
                  ? "[clip-path:inset(0_0_0_100%)]"
                  : "[clip-path:inset(0_100%_0_0)]",
              ),
        )}
        onContextMenu={(e) => onZoneContextMenu?.(e, zone.id)}
        onPointerDown={handleTouchContextMenuStart}
        onPointerMove={handleTouchContextMenuMove}
        onPointerUp={handleTouchContextMenuEnd}
        onPointerCancel={handleTouchContextMenuEnd}
        onPointerLeave={handleTouchContextMenuEnd}
      >
        <Zone
          zone={zone}
          disabled={Boolean(active)}
          className={cn(
            "flex h-full w-max min-w-[calc(var(--commander-drawer-height)*0.733)] items-stretch gap-2 overflow-visible border border-zinc-700/90 bg-zinc-900/95 shadow-lg",
            isRight ? "rounded-l-lg" : "rounded-r-lg",
          )}
          style={{ padding: COMMANDER_DRAWER_PADDING_PX }}
          scale={scale}
        >
          {cards.length > 0 ? (
            cards.map((card) => {
              const taxValue = card.commanderTax ?? 0;
              const canDecrement = taxValue > 0;
              const taxControlsVisible = activeTaxCardId === card.id;
              return (
                <div
                  key={card.id}
                  data-commander-drawer-card
                  className="ds-seat-upright group/commander-card relative h-full shrink-0 aspect-[11/15]"
                >
                  <Card
                    card={card}
                    rotateLabel={isTop}
                    style={isTop ? { transform: "rotate(180deg)" } : undefined}
                    disableHoverAnimation
                    className="h-full w-full cursor-grab active:cursor-grabbing lg:!h-full lg:!w-full"
                  />
                  <div className="pointer-events-auto absolute right-1 top-1 z-40">
                    <div
                      className={cn(
                        "grid h-7 grid-cols-[0fr_auto_0fr] items-center rounded-full border border-zinc-700 bg-zinc-950/90 px-1 shadow-lg ring-1 ring-black/50 transition-[grid-template-columns,border-color] duration-150 ease-out group-hover/commander-card:grid-cols-[1fr_auto_1fr]",
                        taxControlsVisible && "grid-cols-[1fr_auto_1fr] border-indigo-300",
                      )}
                    >
                      <div className="min-w-0 overflow-hidden">
                        {isOwner && (
                          <Tooltip content="Subtract commander tax" placement="top">
                            <button
                              type="button"
                              aria-label={`Decrease commander tax for ${card.name}`}
                              className={cn(
                                "flex h-5 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white",
                                !canDecrement && "cursor-not-allowed opacity-40",
                              )}
                              disabled={!canDecrement}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleTaxDelta(card, -2);
                              }}
                            >
                              -2
                            </button>
                          </Tooltip>
                        )}
                      </div>
                      <Tooltip content="Commander tax" placement="top">
                        <div
                          className={cn(
                            "pointer-events-auto flex h-5 min-w-5 items-center justify-center rounded-full border border-zinc-500 bg-zinc-900 px-1 text-[11px] font-bold text-white transition-colors",
                            taxControlsVisible && "border-indigo-300 ring-indigo-300/70",
                          )}
                          onPointerDown={(event) => {
                            if (event.pointerType !== "touch") return;
                            event.stopPropagation();
                            setActiveTaxCardId(card.id);
                          }}
                        >
                          {taxValue}
                        </div>
                      </Tooltip>
                      <div className="min-w-0 overflow-hidden">
                        {isOwner && (
                          <Tooltip content="Add commander tax" placement="top">
                            <button
                              type="button"
                              aria-label={`Increase commander tax for ${card.name}`}
                              className="flex h-5 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleTaxDelta(card, 2);
                              }}
                            >
                              +2
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div
              data-commander-zone-empty
              className="ds-seat-upright flex h-full min-w-[calc(var(--commander-drawer-height)*0.733)] items-center justify-center px-5 text-xs font-medium uppercase tracking-widest text-zinc-600"
            >
              Empty
            </div>
          )}
        </Zone>
      </div>
    </div>
  );
};
