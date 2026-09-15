import React from "react";
import { Check } from "lucide-react";

import type { Player } from "@/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TurnPickerDialogProps = {
  open: boolean;
  players: Player[];
  activePlayerId: string;
  viewerPlayerId: string;
  onClose: () => void;
  onSelect: (playerId: string) => void;
};

const PLAYER_DOT_CLASS_NAMES: Record<string, string> = {
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  sky: "bg-sky-400",
  amber: "bg-amber-400",
};

export const TurnPickerDialog: React.FC<TurnPickerDialogProps> = ({
  open,
  players,
  activePlayerId,
  viewerPlayerId,
  onClose,
  onSelect,
}) => {
  const choosePlayer = (playerId: string) => {
    if (playerId === activePlayerId) return;
    onSelect(playerId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="ds-dialog-size-xs border-zinc-800 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Set turn</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Choose who takes the next turn.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {players.map((player) => {
            const isActive = player.id === activePlayerId;
            const isViewer = player.id === viewerPlayerId;
            const playerName = player.name.trim() || "Player";

            return (
              <button
                key={player.id}
                type="button"
                disabled={isActive}
                onClick={() => choosePlayer(player.id)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                  isActive
                    ? "cursor-default border-amber-300/40 bg-amber-300/10 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    PLAYER_DOT_CLASS_NAMES[player.color ?? ""] ?? "bg-zinc-400",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {isViewer ? "You" : playerName}
                </span>
                {isActive && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-200">
                    <Check className="h-3.5 w-3.5" />
                    Current
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
