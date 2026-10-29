import React from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
  type Placement,
} from "@floating-ui/react";
import { Flag, Forward } from "lucide-react";

import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";

const PLAYER_DOT_CLASS_NAMES: Record<string, string> = {
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  sky: "bg-sky-400",
  amber: "bg-amber-400",
};

const itemClassName =
  "flex w-full items-center gap-3 rounded p-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-300";

type TurnMenuProps = {
  anchor: HTMLElement | null;
  placement?: Placement;
  onClose: () => void;
  onEndTurn?: () => void;
  onPassTurnTo?: (playerId: string) => void;
};

// Everything about turns in one place: end it, choose who goes next, or sit out.
// The sidebar End turn button and the chevron on your turn pill both open it.
export const TurnMenu: React.FC<TurnMenuProps> = ({
  anchor,
  placement = "right-start",
  onClose,
  onEndTurn,
  onPassTurnTo,
}) => {
  const myPlayerId = useGameStore((state) => state.myPlayerId);
  const activePlayerId = useGameStore((state) => state.activePlayerId);
  const players = useGameStore((state) => state.players);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const isOut = Boolean(players[myPlayerId]?.out);
  const isMyTurn = Boolean(myPlayerId) && activePlayerId === myPlayerId;
  const others = playerOrder
    .filter((id) => id !== myPlayerId)
    .map((id) => players[id])
    .filter((player): player is NonNullable<typeof player> => Boolean(player?.deckLoaded));

  const { refs, floatingStyles } = useFloating({
    open: true,
    placement,
    strategy: "fixed",
    elements: { reference: anchor },
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, onClose]);

  const choose = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <FloatingPortal>
      <div
        ref={(node) => {
          menuRef.current = node;
          refs.setFloating(node);
        }}
        style={floatingStyles}
        role="menu"
        aria-label="Turn"
        data-no-seat-swipe="true"
        className="z-[70] flex w-56 flex-col gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl"
      >
        <button
          type="button"
          role="menuitem"
          disabled={!isMyTurn || !onEndTurn}
          onClick={() => onEndTurn && choose(onEndTurn)}
          className={itemClassName}
        >
          <Forward size={16} />
          End turn
          <span className="ml-auto hidden text-[10px] text-zinc-500 lg:inline">⇧ Space</span>
        </button>

        {isMyTurn && onPassTurnTo && others.length > 1 && (
          <>
            <div className="px-2 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Pass to
            </div>
            {others.map((player) => (
              <button
                key={player.id}
                type="button"
                role="menuitem"
                disabled={Boolean(player.out)}
                onClick={() => choose(() => onPassTurnTo(player.id))}
                className={itemClassName}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-1 h-2 w-2 shrink-0 rounded-full",
                    PLAYER_DOT_CLASS_NAMES[player.color ?? ""] ?? "bg-zinc-400",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{player.name.trim() || "Player"}</span>
                {player.out && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Out
                  </span>
                )}
              </button>
            ))}
          </>
        )}

        <div className="my-1 border-t border-zinc-800" />
        <button
          type="button"
          role="menuitem"
          onClick={() =>
            choose(() => useGameStore.getState().setPlayerOut(myPlayerId, !isOut))
          }
          className={itemClassName}
        >
          <Flag size={16} />
          {isOut ? "I'm back in" : "I'm out (skip my turns)"}
        </button>
      </div>
    </FloatingPortal>
  );
};
