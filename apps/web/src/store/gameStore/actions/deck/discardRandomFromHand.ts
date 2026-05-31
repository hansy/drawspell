import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { getZoneByType } from "@/lib/gameSelectors";
import { logPermission } from "@/rules/logger";

import type { Deps, GetState, SetState } from "./types";

export const createDiscardRandomFromHand = (
  _set: SetState,
  get: GetState,
  { dispatchIntent }: Deps
): GameState["discardRandomFromHand"] =>
  (playerId, count = 1, actorId, _isRemote) => {
    const actor = actorId ?? playerId;
    const state = get();
    const role = actor === state.myPlayerId ? state.viewerRole : "player";
    const handZone = getZoneByType(state.zones, playerId, ZONE.HAND);

    if (!handZone) return;
    if (role === "spectator" || actor !== playerId) {
      logPermission({
        action: "discardRandomFromHand",
        actorId: actor,
        allowed: false,
        reason: "Cannot discard from another player's hand",
        details: { playerId, count },
      });
      return;
    }

    const handCount = handZone.cardIds.length;
    const normalizedCount = Number.isFinite(count)
      ? Math.max(0, Math.min(handCount, Math.floor(count)))
      : 0;
    if (normalizedCount <= 0) return;

    dispatchIntent({
      type: "hand.discardRandom",
      payload: { playerId, count: normalizedCount, actorId: actor },
      isRemote: _isRemote,
    });

    logPermission({
      action: "discardRandomFromHand",
      actorId: actor,
      allowed: true,
      details: { playerId, count: normalizedCount },
    });
  };
