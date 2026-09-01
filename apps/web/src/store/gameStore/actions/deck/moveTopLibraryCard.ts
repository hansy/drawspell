import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { getZoneByType } from "@/lib/gameSelectors";
import { canViewZone } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";

import type { Deps, GetState, SetState } from "./types";

export const createMoveTopLibraryCard = (
  _set: SetState,
  get: GetState,
  { dispatchIntent }: Deps,
): GameState["moveTopLibraryCard"] =>
  (playerId, toZoneId, position, actorId, _isRemote) => {
    const actor = actorId ?? playerId;
    const state = get();
    const role = actor === state.myPlayerId ? state.viewerRole : "player";
    const libraryZone = getZoneByType(state.zones, playerId, ZONE.LIBRARY);
    const toZone = state.zones[toZoneId];
    if (!libraryZone || !toZone) return;

    const viewPermission = canViewZone({ actorId: actor, role }, libraryZone, {
      viewAll: true,
    });
    if (!viewPermission.allowed) {
      logPermission({
        action: "moveTopLibraryCard",
        actorId: actor,
        allowed: false,
        reason: viewPermission.reason,
        details: { playerId, toZoneId },
      });
      return;
    }

    const player = state.players[playerId];
    if (player && typeof player.libraryCount === "number" && player.libraryCount <= 0) {
      return;
    }

    dispatchIntent({
      type: "library.moveTop",
      payload: { playerId, toZoneId, position, actorId: actor },
      isRemote: _isRemote,
    });

    logPermission({
      action: "moveTopLibraryCard",
      actorId: actor,
      allowed: true,
      details: { playerId, toZoneId },
    });
  };
