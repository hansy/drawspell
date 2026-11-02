import { m } from "@/paraglide/messages.js";
import type { PlayerId } from "@/types";

type PlayerLabelPerspective = "actionRecipient" | "visibilitySubject";

export const getPlayerLabel = (params: {
  playerId: PlayerId;
  viewerId: PlayerId;
  playerName?: string;
  perspective: PlayerLabelPerspective;
}): string => {
  if (params.playerId === params.viewerId) {
    return params.perspective === "actionRecipient" ? m.player_me() : m.player_you();
  }

  const trimmedName = params.playerName?.trim();
  return trimmedName || params.playerId;
};
