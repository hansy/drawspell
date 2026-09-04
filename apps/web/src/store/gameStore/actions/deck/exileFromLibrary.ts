import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { getZoneByType } from "@/lib/gameSelectors";
import { canViewZone } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";

import { isLibraryKnownEmpty } from "./libraryState";
import type { Deps, GetState, SetState } from "./types";

export const createExileFromLibrary = (
  _set: SetState,
  get: GetState,
  { dispatchIntent }: Deps,
): GameState["exileFromLibrary"] =>
  (playerId, count = 1, actorId, _isRemote, options) => {
    const actor = actorId ?? playerId;
    const normalizedCount = Math.max(1, Math.floor(count));
    const state = get();
    const role = actor === state.myPlayerId ? state.viewerRole : "player";
    const libraryZone = getZoneByType(state.zones, playerId, ZONE.LIBRARY);
    const exileZone = getZoneByType(state.zones, playerId, ZONE.EXILE);
    if (!libraryZone || !exileZone) return;

    const viewPermission = canViewZone({ actorId: actor, role }, libraryZone, {
      viewAll: true,
    });
    if (!viewPermission.allowed) {
      logPermission({
        action: "exileFromLibrary",
        actorId: actor,
        allowed: false,
        reason: viewPermission.reason,
        details: { playerId, count: normalizedCount },
      });
      return;
    }

    if (isLibraryKnownEmpty(state.players[playerId]?.libraryCount)) {
      return;
    }

    dispatchIntent({
      type: "library.exile",
      payload: {
        playerId,
        count: normalizedCount,
        actorId: actor,
        ...(options?.faceDown ? { faceDown: true } : null),
      },
      isRemote: _isRemote,
    });

    logPermission({
      action: "exileFromLibrary",
      actorId: actor,
      allowed: true,
      details: { playerId, count: normalizedCount },
    });
  };
