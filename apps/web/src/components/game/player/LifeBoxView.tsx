import React from "react";
import { Minus, Plus } from "lucide-react";

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
  isMe,
  className,
  isRight,
  onEditUsername,
  onContextMenu,
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
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [touchExpanded, setTouchExpanded] = React.useState(false);
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
      setTouchExpanded(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [touchExpanded]);

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
            className="text-3xl font-bold font-mono text-center leading-none select-none lg:text-[clamp(18px,calc(var(--sidezone-h)*0.45),46px)]"
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
