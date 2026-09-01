import type { Card, CardId, CardReveal, Player, PlayerId } from "@/types";
import { getPlayerLabel } from "@/lib/playerLabel";

import type { ContextMenuItem } from "./types";

type SetCardReveal = (
  cardId: CardId,
  reveal: CardReveal
) => void;

export const buildRevealMenu = (opts: {
  card: Card;
  players?: Record<PlayerId, Player>;
  actorId: PlayerId;
  setCardReveal: SetCardReveal;
  audienceMode?: "otherPlayers" | "allPlayers";
}): ContextMenuItem => {
  const { card, players, actorId, setCardReveal, audienceMode = "otherPlayers" } = opts;
  const audiencePlayers = players
    ? Object.values(players).filter(
        (player) => audienceMode === "allPlayers" || player.id !== actorId,
      )
    : [];

  const revealItems: ContextMenuItem[] = [];

  revealItems.push({
    type: "action",
    label: audienceMode === "allPlayers" ? "Everyone" : "Reveal to all",
    checked: card.revealedToAll,
    onSelect: () => setCardReveal(card.id, { toAll: true }),
  });

  revealItems.push({ type: "separator" });

  audiencePlayers.forEach((p) => {
    const isRevealed = card.revealedToAll || card.revealedTo?.includes(p.id);
    revealItems.push({
      type: "action",
      label: getPlayerLabel({
        playerId: p.id,
        viewerId: actorId,
        playerName: p.name,
        perspective: "actionRecipient",
      }),
      checked: isRevealed,
      onSelect: () => {
        if (card.revealedToAll) {
          const newTo = audiencePlayers
            .filter((otherPlayer) => otherPlayer.id !== p.id)
            .map((otherPlayer) => otherPlayer.id);
          setCardReveal(card.id, { to: newTo });
        } else {
          const current = card.revealedTo ?? [];
          let newTo: string[];
          if (current.includes(p.id)) {
            newTo = current.filter((id) => id !== p.id);
          } else {
            newTo = [...current, p.id];
          }
          setCardReveal(card.id, { to: newTo });
        }
      },
    });
  });

  revealItems.push({ type: "separator" });

  revealItems.push({
    type: "action",
    label: audienceMode === "allPlayers" ? "Hide from everyone" : "Hide for all",
    onSelect: () => setCardReveal(card.id, null),
  });

  return {
    type: "action",
    label: "Reveal to ...",
    onSelect: () => {},
    submenu: revealItems,
  };
};
