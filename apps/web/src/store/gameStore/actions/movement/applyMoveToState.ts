import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { getCanonicalBattlefieldPlacementGridSteps } from "@/lib/positions";
import {
  buildMovedCard,
  planCardMovement,
  resolveCardMovementPosition,
} from "../movementModel";
import { moveCardIdBetweenZones, removeCardFromZones } from "../movementState";

type MoveRequest = Parameters<GameState["moveCards"]>[0][number];

export const applyMoveToState = (
  state: GameState,
  request: MoveRequest,
): GameState => {
  const card = state.cards[request.cardId];
  const toZone = state.zones[request.toZoneId];
  if (!card || !toZone) return state;
  const fromZone = state.zones[card.zoneId];
  if (!fromZone) return state;

  const cards = { ...state.cards };
  if (card.isToken && toZone.type !== ZONE.BATTLEFIELD) {
    Reflect.deleteProperty(cards, card.id);
    return {
      ...state,
      cards,
      zones: removeCardFromZones(state.zones, card.id, [
        fromZone.id,
        toZone.id,
      ]),
    };
  }

  const placement = request.placement ?? "top";
  const resolvedPosition = resolveCardMovementPosition({
    card,
    fromZone,
    toZone,
    orderedCardIds: toZone.cardIds,
    position: request.position,
    opts: request.opts,
    getPosition: (id) => cards[id]?.position,
    getStepY: () => getCanonicalBattlefieldPlacementGridSteps().stepY,
  });
  const plan = planCardMovement({
    card,
    fromZone,
    toZone,
    placement,
    position: resolvedPosition,
    opts: request.opts,
  });
  cards[card.id] = buildMovedCard(card, plan);

  return {
    ...state,
    cards,
    zones: moveCardIdBetweenZones({
      zones: state.zones,
      cardId: card.id,
      fromZoneId: fromZone.id,
      toZoneId: toZone.id,
      placement,
    }),
  };
};
