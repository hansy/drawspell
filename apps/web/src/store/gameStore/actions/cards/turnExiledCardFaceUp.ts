import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { logPermission } from "@/rules/logger";

import type { Deps, GetState, SetState } from "./types";

export const createTurnExiledCardFaceUp = (
  _set: SetState,
  get: GetState,
  { dispatchIntent }: Deps,
): GameState["turnExiledCardFaceUp"] =>
  (cardId, actorId, isRemote) => {
    const state = get();
    const actor = actorId ?? state.myPlayerId;
    const role = actor === state.myPlayerId ? state.viewerRole : "player";
    const card = state.cards[cardId];
    const zone = card ? state.zones[card.zoneId] : undefined;
    const allowed =
      role !== "spectator" &&
      Boolean(card?.faceDown) &&
      zone?.type === ZONE.EXILE &&
      zone.ownerId === actor;

    logPermission({
      action: "turnExiledCardFaceUp",
      actorId: actor,
      allowed,
      ...(!allowed ? { reason: "Only the exile zone owner may turn this card face up" } : null),
      details: { cardId, zoneId: zone?.id },
    });
    if (!allowed) return;

    dispatchIntent({
      type: "card.faceUp",
      payload: { cardId, actorId: actor },
      isRemote,
    });
  };
