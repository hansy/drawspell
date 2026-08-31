import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { getZoneByType } from "@/lib/gameSelectors";
import { canViewZone } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";

import type { Deps, GetState, SetState } from "./types";

export const createMoveBottomLibraryCardToHand = (
  _set: SetState,
  get: GetState,
  { dispatchIntent }: Deps,
): GameState["moveBottomLibraryCardToHand"] =>
  (playerId, actorId, _isRemote) => {
    const actor = actorId ?? playerId;
    const state = get();
    const role = actor === state.myPlayerId ? state.viewerRole : "player";
    const libraryZone = getZoneByType(state.zones, playerId, ZONE.LIBRARY);
    const handZone = getZoneByType(state.zones, playerId, ZONE.HAND);
    if (!libraryZone || !handZone) return;

    const permission = canViewZone({ actorId: actor, role }, libraryZone, {
      viewAll: true,
    });
    if (!permission.allowed) {
      logPermission({
        action: "moveBottomLibraryCardToHand",
        actorId: actor,
        allowed: false,
        reason: permission.reason,
        details: { playerId },
      });
      return;
    }

    const player = state.players[playerId];
    if (player && typeof player.libraryCount === "number" && player.libraryCount <= 0) {
      return;
    }

    dispatchIntent({
      type: "library.moveBottomToHand",
      payload: { playerId, actorId: actor },
      isRemote: _isRemote,
    });

    logPermission({
      action: "moveBottomLibraryCardToHand",
      actorId: actor,
      allowed: true,
      details: { playerId },
    });
  };
