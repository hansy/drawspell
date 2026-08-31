import type { GameState } from "@/types";

import { canMoveCard } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import type { Deps, GetState, SetState } from "./types";
import { applyMoveToState } from "./applyMoveToState";

export const createMoveCards =
  (_set: SetState, get: GetState, { dispatchIntent }: Deps): GameState["moveCards"] =>
  (moves, actorId, isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    const snapshot = get();
    const role = actor === snapshot.myPlayerId ? snapshot.viewerRole : "player";
    const uniqueMoves = moves.filter(
      (move, index) =>
        moves.findIndex((candidate) => candidate.cardId === move.cardId) === index,
    );
    if (uniqueMoves.length < 2) return;

    const allowed = uniqueMoves.every((move) => {
      const card = snapshot.cards[move.cardId];
      const fromZone = card ? snapshot.zones[card.zoneId] : undefined;
      const toZone = snapshot.zones[move.toZoneId];
      if (!card || !fromZone || !toZone) return false;
      return canMoveCard({ actorId: actor, role, card, fromZone, toZone }).allowed;
    });
    if (!allowed) {
      logPermission({
        action: "moveCards",
        actorId: actor,
        allowed: false,
        reason: "One or more selected cards cannot be moved",
        details: { cardIds: uniqueMoves.map((move) => move.cardId) },
      });
      return;
    }

    logPermission({
      action: "moveCards",
      actorId: actor,
      allowed: true,
      details: { cardIds: uniqueMoves.map((move) => move.cardId) },
    });
    dispatchIntent({
      type: "card.move.batch",
      payload: { moves: uniqueMoves, actorId: actor },
      applyLocal: (state) =>
        uniqueMoves.reduce(
          (nextState, move) => applyMoveToState(nextState, move),
          state,
        ),
      isRemote,
    });
  };
