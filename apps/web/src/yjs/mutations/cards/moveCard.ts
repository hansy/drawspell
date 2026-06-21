import {
  buildMovedCard,
  planCardMovement,
  resolveCardMovementPosition,
} from "@mtg/shared/movement";
import { getCanonicalBattlefieldPlacementGridSteps } from "@/lib/positions";
import { resetCardToFrontFace } from "@/lib/cardDisplay";

import type { SharedMaps } from "../shared";
import { ensureZoneOrder, removeFromOrder } from "../shared";
import { readZone } from "../zones";
import { ensureCardMap, readCard } from "./cardData";
import { patchCard } from "./patchCard";

export function moveCard(
  maps: SharedMaps,
  cardId: string,
  toZoneId: string,
  position?: { x: number; y: number },
  opts?: {
    skipCollision?: boolean;
    groupCollision?: {
      movingCardIds: string[];
      targetPositions: Record<string, { x: number; y: number } | undefined>;
    };
  }
) {
  const card = readCard(maps, cardId);
  if (!card) return;

  const fromZoneId = card.zoneId;
  const fromZone = readZone(maps, fromZoneId);
  const toZone = readZone(maps, toZoneId);
  if (!fromZone || !toZone) return;
  if (!ensureCardMap(maps, cardId)) return;

  const toOrder = ensureZoneOrder(maps, toZoneId, toZone.cardIds);
  const resolvedPosition = resolveCardMovementPosition({
    card,
    fromZone,
    toZone,
    orderedCardIds: toOrder.toArray(),
    position,
    opts,
    getPosition: (id) => readCard(maps, id)?.position,
    getStepY: () => getCanonicalBattlefieldPlacementGridSteps().stepY,
  });
  const plan = planCardMovement({
    card,
    fromZone,
    toZone,
    placement: "top",
    position: resolvedPosition,
    opts,
  });
  const nextCard = buildMovedCard(card, plan, { resetCardToFrontFace });

  const fromOrder = ensureZoneOrder(maps, fromZoneId, fromZone.cardIds);
  removeFromOrder(fromOrder, cardId);
  removeFromOrder(toOrder, cardId);
  toOrder.push([cardId]);

  patchCard(maps, cardId, nextCard);
}
