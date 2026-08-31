import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { buildRevealPatch } from "../cardsModel";
import type { Deps, GetState, SetState } from "./types";

export const createSetCardsReveal =
  (_set: SetState, get: GetState, { dispatchIntent }: Deps): GameState["setCardsReveal"] =>
  (cardIds, reveal, actorId, isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    const snapshot = get();
    if (snapshot.viewerRole === "spectator") return;
    const uniqueIds = Array.from(new Set(cardIds));
    if (uniqueIds.length < 2) return;

    const cards = uniqueIds.map((id) => snapshot.cards[id]).filter(Boolean);
    const allowed =
      cards.length === uniqueIds.length &&
      cards.every((card) => {
        const zoneType = snapshot.zones[card.zoneId]?.type;
        const faceDownBattlefield = zoneType === ZONE.BATTLEFIELD && card.faceDown;
        return faceDownBattlefield
          ? card.controllerId === actor
          : card.ownerId === actor &&
              (zoneType === ZONE.HAND || zoneType === ZONE.LIBRARY);
      });
    if (!allowed) return;

    dispatchIntent({
      type: "card.reveal.set.batch",
      payload: { cardIds: uniqueIds, reveal, actorId: actor },
      applyLocal: (state) => {
        const nextCards = { ...state.cards };
        cards.forEach((card) => {
          const current = nextCards[card.id];
          if (!current) return;
          nextCards[card.id] = {
            ...current,
            ...buildRevealPatch(current, reveal, { excludeId: actor }),
          };
        });
        return { cards: nextCards };
      },
      isRemote,
    });
  };
