import React from "react";
import { Eye, Heart, RectangleVertical } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { ZONE } from "@/constants/zones";
import { canViewerSeeLibraryCardByReveal, shouldRenderFaceDown } from "@/lib/reveal";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";
import { MANA_TYPES, normalizeManaPool, type ViewerRole } from "@/types";

export type PortraitSeatStripSeat = {
  playerId: string;
  label: string;
  color: string;
};

const seatColorClass = (color: string | undefined) => {
  if (color === "rose") return "bg-rose-400";
  if (color === "violet") return "bg-violet-400";
  if (color === "sky") return "bg-sky-400";
  if (color === "amber") return "bg-amber-400";
  return "bg-zinc-300";
};

type SeatSummary = {
  life: number;
  handCount: number;
  hasReveal: boolean;
  hasMana: boolean;
};

// Flat primitive values so the shallow comparison can tell when nothing changed.
const useSeatSummaries = (
  playerIds: string[],
  viewerId: string,
  viewerRole: ViewerRole | undefined,
): Record<string, SeatSummary> => {
  const flat = useGameStore(
    useShallow((state) => {
      const values: Record<string, number | boolean> = {};
      for (const playerId of playerIds) {
        const player = state.players[playerId];
        let handCount = 0;
        let hasReveal = false;
        for (const zone of Object.values(state.zones)) {
          if (zone.ownerId !== playerId) continue;
          if (zone.type === ZONE.HAND) {
            handCount = zone.cardIds.length;
            if (playerId !== viewerId) {
              hasReveal ||= zone.cardIds.some((id) => {
                const card = state.cards[id];
                return card ? !shouldRenderFaceDown(card, ZONE.HAND, viewerId, viewerRole) : false;
              });
            }
          } else if (zone.type === ZONE.LIBRARY && playerId !== viewerId) {
            hasReveal ||= zone.cardIds.some((id) => {
              const card = state.cards[id];
              return card ? canViewerSeeLibraryCardByReveal(card, viewerId, viewerRole) : false;
            });
          }
        }
        const pool = normalizeManaPool(player?.manaPool);
        values[`${playerId}:life`] = player?.life ?? 0;
        values[`${playerId}:hand`] = handCount;
        values[`${playerId}:reveal`] = hasReveal;
        values[`${playerId}:mana`] = MANA_TYPES.some((type) => (pool[type] ?? 0) > 0);
      }
      return values;
    }),
  );
  return React.useMemo(() => {
    const summaries: Record<string, SeatSummary> = {};
    for (const playerId of playerIds) {
      summaries[playerId] = {
        life: Number(flat[`${playerId}:life`] ?? 0),
        handCount: Number(flat[`${playerId}:hand`] ?? 0),
        hasReveal: Boolean(flat[`${playerId}:reveal`]),
        hasMana: Boolean(flat[`${playerId}:mana`]),
      };
    }
    return summaries;
  }, [flat, playerIds]);
};

// Phone view: every player's life and hand size stay visible while you look at
// one seat, and tapping a player switches to their board.
export const PortraitSeatStrip: React.FC<{
  seats: PortraitSeatStripSeat[];
  activePlayerId: string | null;
  viewerId: string;
  viewerRole?: ViewerRole;
  onSelectSeat: (playerId: string) => void;
}> = ({ seats, activePlayerId, viewerId, viewerRole, onSelectSeat }) => {
  const playerIds = React.useMemo(() => seats.map((seat) => seat.playerId), [seats]);
  const summaries = useSeatSummaries(playerIds, viewerId, viewerRole);

  if (seats.length < 2) return null;

  return (
    <nav
      aria-label="Players"
      data-portrait-seat-strip
      data-no-seat-swipe="true"
      className="flex h-12 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-1.5 py-1 scrollbar-none"
    >
      {seats.map((seat) => {
        const summary = summaries[seat.playerId];
        const active = seat.playerId === activePlayerId;
        return (
          <button
            key={seat.playerId}
            type="button"
            aria-pressed={active}
            aria-label={`${active ? "Viewing" : "View"} ${seat.label}: ${summary?.life ?? 0} life, ${summary?.handCount ?? 0} cards in hand${summary?.hasReveal ? ", has revealed cards" : ""}${summary?.hasMana ? ", has floating mana" : ""}`}
            data-portrait-seat-chip={seat.playerId}
            onClick={() => {
              if (!active) onSelectSeat(seat.playerId);
            }}
            className={cn(
              "flex min-w-0 flex-1 basis-0 items-center gap-1.5 rounded-md border px-2 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80",
              active
                ? "border-zinc-500 bg-zinc-800 text-white"
                : "border-zinc-800 bg-zinc-900/70 text-zinc-300 active:bg-zinc-800",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("h-2.5 w-2.5 shrink-0 rounded-full", seatColorClass(seat.color))}
            />
            <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[11px] font-semibold">{seat.label}</span>
              <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-zinc-400">
                <Heart className="h-2.5 w-2.5" />
                <span className="text-zinc-100">{summary?.life ?? 0}</span>
                <RectangleVertical className="ml-1 h-2.5 w-2.5" />
                <span className="text-zinc-100">{summary?.handCount ?? 0}</span>
                {summary?.hasReveal && <Eye className="h-3 w-3 text-zinc-100" />}
                {summary?.hasMana && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                )}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
};
