import React from "react";
import { Minus, Plus } from "lucide-react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";

import { Tooltip } from "@/components/ui/tooltip";
import { MAX_PLAYER_LIFE, MIN_PLAYER_LIFE } from "@/lib/limits";
import { cn } from "@/lib/utils";

import type { LifeBoxController } from "@/hooks/game/player/useLifeBoxController";

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

export const LifeBoxView: React.FC<LifeBoxController> = ({
  player,
  color,
  isMe,
  className,
  isRight,
  isTop,
  onEditUsername,
  onContextMenu,
  variant,
  canEditLife,
  canEditCommanderDamage,
  showCommanderDamageDrawer,
  commanderDamageEntries,
  handleLifeChange,
  handleCommanderDamageChange,
}) => {
  const isAtMinLife = player.life <= MIN_PLAYER_LIFE;
  const isAtMaxLife = player.life >= MAX_PLAYER_LIFE;
  const namePillClass =
    "inline-flex items-center leading-none bg-zinc-900 px-2 py-1 text-xs font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap border border-zinc-700 rounded-full shadow-sm lg:text-[clamp(10px,calc(var(--sidezone-h)*0.14),14px)]";
  const playerNameColorClass = cn(
    color === "rose" && "text-rose-400",
    color === "violet" && "text-violet-400",
    color === "sky" && "text-sky-400",
    color === "amber" && "text-amber-400",
  );
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [touchExpanded, setTouchExpanded] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const sidebarDisclosureOpen =
    variant === "sidebar" && (touchExpanded || sidebarOpen);
  const {
    refs: sidebarFloatingRefs,
    floatingStyles: sidebarFloatingStyles,
    context: sidebarFloatingContext,
  } = useFloating({
    open: sidebarDisclosureOpen,
    onOpenChange: setSidebarOpen,
    placement: isRight ? "left-start" : "right-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const sidebarHover = useHover(sidebarFloatingContext, {
    enabled: variant === "sidebar",
    delay: { close: 80 },
    handleClose: safePolygon(),
  });
  const sidebarFocus = useFocus(sidebarFloatingContext, {
    enabled: variant === "sidebar",
  });
  const sidebarRole = useRole(sidebarFloatingContext, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    sidebarHover,
    sidebarFocus,
    sidebarRole,
  ]);
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
      if (!canEditLife || !onContextMenu) return;
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
      };
      touchPressRef.current = press;
      clearTouchPressTimeout();
      touchPressTimeoutRef.current = setTimeout(() => {
        const currentPress = touchPressRef.current;
        if (!currentPress) return;
        if (currentPress.pointerId !== press.pointerId) return;
        if (currentPress.moved) return;
        touchPressTimeoutRef.current = null;
        onContextMenu({
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: currentPress.clientX,
          clientY: currentPress.clientY,
          currentTarget: currentPress.target,
          target: currentPress.target,
        } as unknown as React.MouseEvent);
      }, TOUCH_CONTEXT_MENU_LONG_PRESS_MS);
    },
    [canEditLife, clearTouchPress, clearTouchPressTimeout, onContextMenu]
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
    if (!touchExpanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (sidebarFloatingRefs.floating.current?.contains(target)) return;
      setTouchExpanded(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [sidebarFloatingRefs.floating, touchExpanded]);

  const handleTouchExpand = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      setTouchExpanded(true);
    },
    []
  );

  const lifeControlVisibility = touchExpanded
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100";
  const commanderDrawerVisibility = touchExpanded
    ? "opacity-100 visible"
    : "opacity-0 invisible group-hover:opacity-100 group-hover:visible";

  if (variant === "sidebar") {
    const sidebarDisclosureVisibility = sidebarDisclosureOpen
      ? "visible opacity-100"
      : "invisible opacity-0";

    return (
      <>
        <div
          ref={(node) => {
            rootRef.current = node;
            sidebarFloatingRefs.setReference(node);
          }}
          data-life-box-variant="sidebar"
          className={cn(
            "group/life pointer-events-auto relative flex h-12 w-full shrink-0 items-center justify-center border-b border-white/10 bg-zinc-950/55 backdrop-blur-[1px]",
            className,
          )}
          {...getReferenceProps({ onPointerDown: handleTouchExpand })}
        >
          <div
            data-desktop-life-total
            tabIndex={canEditLife || showCommanderDamageDrawer ? 0 : undefined}
            aria-label={`${player.name || "Player"} life total ${player.life}`}
            className={cn(
              "ds-seat-upright select-none font-mono text-xl font-bold leading-none text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
              canEditLife && onContextMenu
                ? "cursor-context-menu"
                : "cursor-default",
            )}
            onContextMenu={canEditLife ? onContextMenu : undefined}
            onPointerDown={handleTouchContextMenuStart}
            onPointerMove={handleTouchContextMenuMove}
            onPointerUp={handleTouchContextMenuEnd}
            onPointerCancel={handleTouchContextMenuEnd}
            onPointerLeave={handleTouchContextMenuEnd}
          >
            {player.life}
          </div>
        </div>

        <FloatingPortal>
          <div
            ref={sidebarFloatingRefs.setFloating}
            data-life-sidebar-disclosure
            data-life-sidebar-placement={isRight ? "left" : "right"}
            style={sidebarFloatingStyles}
            className={cn(
              "z-50 w-48 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl transition-[opacity,visibility] duration-150 ease-out motion-reduce:transition-none",
              sidebarDisclosureVisibility,
            )}
            {...getFloatingProps()}
          >
          <div
            data-life-controls-label
            className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400"
          >
            Life Total
          </div>
          <div className="flex items-center justify-center gap-2">
            {canEditLife && (
              <button
                type="button"
                aria-label="Decrease life"
                onClick={() => handleLifeChange(-1)}
                disabled={isAtMinLife}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-colors hover:bg-red-900/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus size={14} />
              </button>
            )}
            <span className="min-w-10 text-center font-mono text-xl font-bold text-zinc-100">
              {player.life}
            </span>
            {canEditLife && (
              <button
                type="button"
                aria-label="Increase life"
                onClick={() => handleLifeChange(1)}
                disabled={isAtMaxLife}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-colors hover:bg-green-900/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          {showCommanderDamageDrawer && (
            <div
              data-commander-damage-controls
              className="mt-3 border-t border-zinc-700 pt-3"
            >
              <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Commander damage
              </div>
              <div className="flex flex-col gap-2">
                {commanderDamageEntries.map(({ opponentId, color, damage }) => (
                  <div
                    key={opponentId}
                    className="flex items-center justify-center gap-3"
                  >
                    {canEditCommanderDamage && (
                      <button
                        type="button"
                        aria-label={`Decrease commander damage from ${opponentId}`}
                        onClick={() => handleCommanderDamageChange(opponentId, -1)}
                        disabled={damage <= 0}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus size={13} />
                      </button>
                    )}
                    <span
                      className={cn(
                        "w-8 text-center font-mono text-base",
                        color === "rose" && "text-rose-400",
                        color === "violet" && "text-violet-400",
                        color === "sky" && "text-sky-400",
                        color === "amber" && "text-amber-400",
                      )}
                    >
                      {damage}
                    </span>
                    {canEditCommanderDamage && (
                      <button
                        type="button"
                        aria-label={`Increase commander damage from ${opponentId}`}
                        onClick={() => handleCommanderDamageChange(opponentId, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                      >
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </FloatingPortal>
      </>
    );
  }

  if (variant === "hand-edge") {
    const edgeControlVisibility = touchExpanded
      ? "visible w-7 opacity-100"
      : "invisible w-0 opacity-0 group-hover/life:visible group-hover/life:w-7 group-hover/life:opacity-100 group-focus-within/life:visible group-focus-within/life:w-7 group-focus-within/life:opacity-100";
    const edgeDisclosureVisibility = touchExpanded
      ? "visible opacity-100 translate-y-0"
      : cn(
          "invisible opacity-0 group-hover/life:visible group-hover/life:opacity-100 group-hover/life:translate-y-0 group-focus-within/life:visible group-focus-within/life:opacity-100 group-focus-within/life:translate-y-0",
          isTop ? "-translate-y-1" : "translate-y-1",
        );
    const hasDisclosure = canEditLife || showCommanderDamageDrawer;

    return (
      <div
        ref={rootRef}
        data-life-box-variant="hand-edge"
        className={cn(
          "ds-seat-life-pill relative flex items-center whitespace-nowrap rounded-lg border border-zinc-700/80 bg-zinc-900 font-bold uppercase text-zinc-400 shadow-[0_2px_10px_rgba(0,0,0,0.45)]",
          isMe && "border-indigo-500/50",
          touchExpanded && "border-indigo-300/70",
          className,
        )}
      >
        {isMe && onEditUsername ? (
          <Tooltip content="Click to edit username" placement="top">
            <button
              type="button"
              onClick={onEditUsername}
              className={cn(
                "cursor-pointer transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:text-zinc-100",
                playerNameColorClass,
              )}
            >
              {player.name || "Me"}
            </button>
          </Tooltip>
        ) : (
          <span className={playerNameColorClass}>
            {player.name || (isMe ? "Me" : "")}
          </span>
        )}

        <span className="ds-seat-life-divider text-zinc-600">-</span>

        <div
          className="group/life relative flex items-center gap-1"
          onPointerDown={handleTouchExpand}
        >
          {canEditLife ? (
            <button
              type="button"
              aria-label="Decrease life"
              onClick={() => handleLifeChange(-1)}
              disabled={isAtMinLife}
              className={cn(
                "flex h-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-300 transition-[width,opacity,background-color,color] duration-150",
                edgeControlVisibility,
                isAtMinLife
                  ? "cursor-not-allowed text-zinc-600"
                  : "hover:bg-red-900/60 hover:text-white",
              )}
            >
              <Minus size={14} />
            </button>
          ) : (
            <div className="h-7 w-0 shrink-0" />
          )}

          <div
            tabIndex={hasDisclosure ? 0 : undefined}
            aria-label={`${player.name || "Player"} life total ${player.life}`}
            className={cn(
              "ds-seat-life-total text-center font-mono leading-none text-zinc-100 select-none",
              hasDisclosure && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
              canEditLife && onContextMenu
                ? "cursor-context-menu"
                : hasDisclosure && "cursor-default",
            )}
            onContextMenu={canEditLife ? onContextMenu : undefined}
            onPointerDown={handleTouchContextMenuStart}
            onPointerMove={handleTouchContextMenuMove}
            onPointerUp={handleTouchContextMenuEnd}
            onPointerCancel={handleTouchContextMenuEnd}
            onPointerLeave={handleTouchContextMenuEnd}
          >
            {player.life}
          </div>

          {canEditLife ? (
            <button
              type="button"
              aria-label="Increase life"
              onClick={() => handleLifeChange(1)}
              disabled={isAtMaxLife}
              className={cn(
                "flex h-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-300 transition-[width,opacity,background-color,color] duration-150",
                edgeControlVisibility,
                isAtMaxLife
                  ? "cursor-not-allowed text-zinc-600"
                  : "hover:bg-green-900/60 hover:text-white",
              )}
            >
              <Plus size={14} />
            </button>
          ) : (
            <div className="h-7 w-0 shrink-0" />
          )}

          {showCommanderDamageDrawer && (
            <div
              data-life-edge-disclosure
              data-commander-damage-controls
              className={cn(
                "absolute right-0 z-50 min-w-44 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl transition-all duration-150 ease-out",
                isTop ? "top-full mt-2" : "bottom-full mb-2",
                edgeDisclosureVisibility,
              )}
            >
              <div>
                <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Commander damage
                </div>
                <div className="flex flex-col gap-2">
                  {commanderDamageEntries.map(
                    ({ opponentId, color, damage }) => (
                        <div
                          key={opponentId}
                          className="flex items-center justify-center gap-3"
                        >
                          {canEditCommanderDamage && (
                            <button
                              type="button"
                              aria-label={`Decrease commander damage from ${opponentId}`}
                              onClick={() =>
                                handleCommanderDamageChange(opponentId, -1)
                              }
                              disabled={damage <= 0}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus size={13} />
                            </button>
                          )}
                          <span
                            className={cn(
                              "w-8 text-center font-mono text-base",
                              color === "rose" && "text-rose-400",
                              color === "violet" && "text-violet-400",
                              color === "sky" && "text-sky-400",
                              color === "amber" && "text-amber-400",
                            )}
                          >
                            {damage}
                          </span>
                          {canEditCommanderDamage && (
                            <button
                              type="button"
                              aria-label={`Increase commander damage from ${opponentId}`}
                              onClick={() =>
                                handleCommanderDamageChange(opponentId, 1)
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                            >
                              <Plus size={13} />
                            </button>
                          )}
                        </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "group w-full h-24 flex flex-col items-center justify-center p-1.5 bg-zinc-800/30 rounded-lg border-2 border-zinc-700 ring-1 ring-transparent shadow-lg backdrop-blur-sm relative lg:h-full lg:p-[clamp(4px,calc(var(--sidezone-h)*0.08),10px)]",
        isMe && "border-indigo-500/50 ring-indigo-500/20",
        touchExpanded && "border-indigo-300/70 ring-indigo-300/60",
        className,
      )}
      onPointerDown={handleTouchExpand}
    >
      {/* Player Name Label */}
      <div className="absolute -top-[18px] left-1/2 -translate-x-1/2 z-10">
        {isMe && onEditUsername ? (
          <Tooltip content="Click to edit username" placement="top">
            <button
              type="button"
              onClick={onEditUsername}
              className={cn(
                namePillClass,
                "appearance-none cursor-pointer hover:text-zinc-200 hover:border-zinc-500 transition-colors",
              )}
            >
              {player.name || "Me"}
            </button>
          </Tooltip>
        ) : (
          <div className={namePillClass}>
            {player.name || (isMe ? "Me" : "")}
          </div>
        )}
      </div>

      <div className="w-full flex flex-col items-center justify-center">
        {/* Main Life Counter */}
        <div className="flex items-center gap-1">
          {canEditLife ? (
            <button
              type="button"
              aria-label="Decrease life"
              onClick={() => handleLifeChange(-1)}
              disabled={isAtMinLife}
              className={cn(
                "w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center transition-all lg:w-[clamp(18px,calc(var(--sidezone-h)*0.24),32px)] lg:h-[clamp(18px,calc(var(--sidezone-h)*0.24),32px)]",
                lifeControlVisibility,
                isAtMinLife
                  ? "cursor-not-allowed text-zinc-500 group-hover:opacity-50"
                  : "hover:bg-red-900/50",
              )}
            >
              <Minus size={16} />
            </button>
          ) : (
            <div className="w-7 h-7 lg:w-[clamp(18px,calc(var(--sidezone-h)*0.24),32px)] lg:h-[clamp(18px,calc(var(--sidezone-h)*0.24),32px)]" />
          )}

          <div
            className={cn(
              "text-3xl font-bold font-mono text-center leading-none select-none lg:text-[clamp(18px,calc(var(--sidezone-h)*0.45),46px)]",
              canEditLife && onContextMenu && "cursor-context-menu",
            )}
            onContextMenu={canEditLife ? onContextMenu : undefined}
            onPointerDown={handleTouchContextMenuStart}
            onPointerMove={handleTouchContextMenuMove}
            onPointerUp={handleTouchContextMenuEnd}
            onPointerCancel={handleTouchContextMenuEnd}
            onPointerLeave={handleTouchContextMenuEnd}
          >
            {player.life}
          </div>

          {canEditLife ? (
            <button
              type="button"
              aria-label="Increase life"
              onClick={() => handleLifeChange(1)}
              disabled={isAtMaxLife}
              className={cn(
                "w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center transition-all lg:w-[clamp(18px,calc(var(--sidezone-h)*0.24),32px)] lg:h-[clamp(18px,calc(var(--sidezone-h)*0.24),32px)]",
                lifeControlVisibility,
                isAtMaxLife
                  ? "cursor-not-allowed text-zinc-500 group-hover:opacity-50"
                  : "hover:bg-green-900/50",
              )}
            >
              <Plus size={16} />
            </button>
          ) : (
            <div className="w-7 h-7 lg:w-[clamp(18px,calc(var(--sidezone-h)*0.24),32px)] lg:h-[clamp(18px,calc(var(--sidezone-h)*0.24),32px)]" />
          )}
        </div>

        {/* Commander Damage Drawer */}
        {showCommanderDamageDrawer && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-auto py-4 px-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl backdrop-blur-sm",
              "flex flex-col gap-3 transition-all duration-200 ease-in-out",
              commanderDrawerVisibility,
              // Position based on seat side
              isRight
                ? "right-full mr-4 origin-right"
                : "left-full ml-4 origin-left",
            )}
          >
            {/* Label straddling top border */}
            <div className="absolute left-1/2 -translate-x-1/2 bg-zinc-900 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap border border-zinc-700 rounded-full z-10 -top-2.5 shadow-sm">
              CMDR DMG
            </div>

            {commanderDamageEntries.map(({ opponentId, color, damage }) => (
              <div
                key={opponentId}
                className="flex items-center justify-center gap-4 group/cmd"
              >
                {canEditCommanderDamage ? (
                  <button
                    type="button"
                    aria-label={`Decrease commander damage from ${opponentId}`}
                    onClick={() => handleCommanderDamageChange(opponentId, -1)}
                    disabled={damage <= 0}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 transition-colors",
                      damage <= 0
                        ? "opacity-50 text-zinc-600"
                        : "hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    <Minus size={14} />
                  </button>
                ) : (
                  <div className="w-8 h-8" />
                )}

                <span
                  className={cn(
                    "text-xl font-mono font-bold w-8 text-center lg:text-[clamp(16px,calc(var(--card-h)*0.2),24px)]",
                    color === "rose" && "text-rose-500/70",
                    color === "violet" && "text-violet-500/70",
                    color === "sky" && "text-sky-500/70",
                    color === "amber" && "text-amber-500/70",
                  )}
                >
                  {damage}
                </span>

                {canEditCommanderDamage ? (
                  <button
                    type="button"
                    aria-label={`Increase commander damage from ${opponentId}`}
                    onClick={() => handleCommanderDamageChange(opponentId, 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                ) : (
                  <div className="w-8 h-8" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
