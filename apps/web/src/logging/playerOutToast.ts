import { toast } from "sonner";

import { useGameStore } from "@/store/gameStore";
import { logEventRegistry } from "./eventRegistry";
import type { PlayerOutPayload } from "./eventRegistry/playerEvents";
import type { LogContext } from "./types";

// Going out skips turns, so everyone should notice it. The player who went out
// can stay in from the toast, for a misclick or a card that keeps them alive.
export const announcePlayerOut = (
  eventId: string,
  payload: Record<string, unknown>,
  ctx: LogContext,
) => {
  if (eventId !== "player.out") return;
  const outPayload = payload as PlayerOutPayload;
  if (typeof outPayload.playerId !== "string") return;
  const parts = logEventRegistry["player.out"].format(outPayload, ctx);
  const message = parts.map((part) => part.text).join("").trim();
  if (!message) return;
  const { myPlayerId, viewerRole } = useGameStore.getState();
  const canStayIn = outPayload.out && viewerRole !== "spectator" && outPayload.playerId === myPlayerId;
  toast(message, {
    id: `player-out-${outPayload.playerId}`,
    action: canStayIn
      ? {
          label: "Stay in",
          onClick: () => useGameStore.getState().setPlayerOut(outPayload.playerId, false),
        }
      : undefined,
  });
};
