import type { Card } from "@mtg/shared/types/cards";
import type { Zone } from "@mtg/shared/types/zones";

import { isCommanderZoneType, isHiddenZoneType, ZONE } from "./constants";
import type {
  HiddenReveal,
  HiddenState,
  Maps,
  MoveOpts,
} from "./types";
import {
  buildCardIdentity,
  mergeCardIdentity,
  stripCardIdentity,
} from "./cards";
import {
  buildMovedCard,
  planCardMovement,
  resolveCardMovementPosition,
  type CardMovementLogFacts,
} from "@mtg/shared/movement";
import { getCanonicalBattlefieldPlacementGridSteps } from "@mtg/shared/positions";
import { readCard, readLiveZoneCardIds, readZone, writeCard, writeZone } from "./yjsStore";
import { placeCardId, removeFromArray } from "./lists";
import { syncLibraryRevealsToAllForPlayer, updatePlayerCounts } from "./hiddenState";

const updateCountsForZoneMove = (maps: Maps, hidden: HiddenState, fromOwnerId: string, toOwnerId: string) => {
  updatePlayerCounts(maps, hidden, fromOwnerId);
  if (toOwnerId !== fromOwnerId) {
    updatePlayerCounts(maps, hidden, toOwnerId);
  }
};

const readMovePosition = (
  value: unknown,
  fallback: Card["position"]
): Card["position"] | undefined => {
  if (!value || typeof value !== "object") return undefined;

  const position = value as Record<string, unknown>;
  return {
    x: typeof position.x === "number" ? position.x : fallback.x,
    y: typeof position.y === "number" ? position.y : fallback.y,
  };
};

const resolveMoveApplicationPosition = (params: {
  maps: Maps;
  card: Card;
  cardId: string;
  fromZone: Pick<Zone, "type">;
  toZone: Pick<Zone, "type">;
  toZoneCardIds: string[];
  position: Card["position"] | undefined;
  opts: MoveOpts | undefined;
}): Card["position"] => {
  const cardsById: Record<string, Card> = {};
  params.toZoneCardIds.forEach((id) => {
    const entry = readCard(params.maps, id);
    if (entry) cardsById[id] = entry;
  });

  return resolveCardMovementPosition({
    card: params.card,
    cardId: params.cardId,
    fromZone: params.fromZone,
    toZone: params.toZone,
    orderedCardIds: params.toZoneCardIds,
    position: params.position,
    opts: params.opts,
    getPosition: (id) => cardsById[id]?.position,
    getStepY: () => getCanonicalBattlefieldPlacementGridSteps().stepY,
  });
};

const pushMovementLogFacts = (
  logFacts: CardMovementLogFacts,
  actorId: string | undefined,
  cardId: string,
  fromZoneId: string,
  toZoneId: string,
  pushLogEvent: (eventId: string, payload: Record<string, unknown>) => void
) => {
  if (logFacts.event === "none") return;
  if (logFacts.event === "draw") {
    pushLogEvent("card.draw", {
      actorId,
      playerId: logFacts.playerId,
      count: logFacts.count,
    });
    return;
  }
  if (logFacts.event === "discard") {
    pushLogEvent("card.discard", {
      actorId,
      playerId: logFacts.playerId,
      count: logFacts.count,
    });
    return;
  }
  if (logFacts.event !== "move") return;
  pushLogEvent("card.move", {
    actorId,
    cardId,
    fromZoneId,
    toZoneId,
    placement: logFacts.placement,
    random: logFacts.random,
    cardName: logFacts.cardName,
    fromZoneType: logFacts.fromZoneType,
    toZoneType: logFacts.toZoneType,
    faceDown: logFacts.faceDown,
    forceHidden: logFacts.forceHidden,
    ...(logFacts.gainsControlBy ? { gainsControlBy: logFacts.gainsControlBy } : null),
  });
};

export const applyCardMove = (
  maps: Maps,
  hidden: HiddenState,
  payload: Record<string, unknown>,
  placement: "top" | "bottom",
  pushLogEvent: (eventId: string, payload: Record<string, unknown>) => void,
  markHiddenChanged: (impact?: {
    ownerId?: string;
    zoneId?: string;
    reveal?: HiddenReveal;
    prevReveal?: HiddenReveal;
  }) => void
): { ok: true } | { ok: false; error: string } => {
  const cardId = typeof payload.cardId === "string" ? payload.cardId : null;
  const toZoneId = typeof payload.toZoneId === "string" ? payload.toZoneId : null;
  if (!cardId || !toZoneId) return { ok: false, error: "invalid move" };

  const toZone = readZone(maps, toZoneId);
  if (!toZone) return { ok: false, error: "zone not found" };

  const publicCard = readCard(maps, cardId);
  const hiddenCard = !publicCard ? hidden.cards[cardId] : null;
  const card = publicCard ?? hiddenCard;
  if (!card) return { ok: false, error: "card not found" };

  const fromZone = readZone(maps, card.zoneId);
  if (!fromZone) return { ok: false, error: "zone not found" };
  const fromZoneCardIds = isCommanderZoneType(fromZone.type)
    ? readLiveZoneCardIds(maps, fromZone.id, fromZone.cardIds)
    : fromZone.cardIds;
  const toZoneCardIds = isCommanderZoneType(toZone.type)
    ? readLiveZoneCardIds(maps, toZone.id, toZone.cardIds)
    : toZone.cardIds;

  const priorReveal =
    fromZone.type === ZONE.HAND
      ? hidden.handReveals[cardId]
      : fromZone.type === ZONE.LIBRARY
        ? hidden.libraryReveals[cardId]
        : fromZone.type === ZONE.BATTLEFIELD && card.faceDown
          ? hidden.faceDownReveals[cardId]
          : undefined;

  const position = readMovePosition(payload.position, card.position);

  const opts = payload.opts && typeof payload.opts === "object" ? (payload.opts as MoveOpts) : undefined;
  const actorId = typeof payload.actorId === "string" ? payload.actorId : undefined;

  const faceDownIdentityForLog =
    card.faceDown && fromZone.type === ZONE.BATTLEFIELD
      ? hidden.faceDownBattlefield[cardId]
      : undefined;
  const plan = planCardMovement({
    card,
    fromZone,
    toZone,
    placement,
    position,
    opts,
    cardNameForLog: faceDownIdentityForLog?.name,
  });

  const sameBattlefield =
    fromZone.type === ZONE.BATTLEFIELD &&
    toZone.type === ZONE.BATTLEFIELD &&
    fromZone.id === toZone.id;

  const fromHidden = isHiddenZoneType(fromZone.type);
  const toHidden = isHiddenZoneType(toZone.type);

  if (!sameBattlefield || opts?.suppressLog) {
    pushMovementLogFacts(
      plan.logFacts,
      actorId,
      cardId,
      fromZone.id,
      toZoneId,
      pushLogEvent
    );
  }

  if (!fromHidden && !toHidden) {
    const tokenLeavingBattlefield = card.isToken && toZone.type !== ZONE.BATTLEFIELD;
    if (tokenLeavingBattlefield) {
      const nextFromIds = removeFromArray(fromZoneCardIds, cardId);
      writeZone(maps, { ...fromZone, cardIds: nextFromIds });
      maps.cards.delete(cardId);
      return { ok: true };
    }

    const wasFaceDownBattlefield = fromZone.type === ZONE.BATTLEFIELD && card.faceDown;
    const faceDownIdentity = wasFaceDownBattlefield
      ? hidden.faceDownBattlefield[cardId]
      : undefined;
    const cardWithIdentity = mergeCardIdentity(card, faceDownIdentity);

    const resolvedPosition = resolveMoveApplicationPosition({
      maps,
      card,
      cardId,
      fromZone,
      toZone,
      toZoneCardIds,
      position,
      opts,
    });

    const branchPlan = planCardMovement({
      card,
      fromZone,
      toZone,
      placement,
      position: resolvedPosition,
      opts,
      cardNameForLog: faceDownIdentityForLog?.name,
    });
    const nextCard = buildMovedCard(cardWithIdentity, branchPlan);

    const willBeFaceDownBattlefield =
      toZone.type === ZONE.BATTLEFIELD && nextCard.faceDown;
    const publicCard = willBeFaceDownBattlefield ? stripCardIdentity(nextCard) : nextCard;

    if (fromZone.id === toZone.id) {
      const nextIds = placeCardId(fromZoneCardIds, cardId, placement);
      writeZone(maps, { ...fromZone, cardIds: nextIds });
      writeCard(maps, publicCard);
    } else {
      const nextFromIds = removeFromArray(fromZoneCardIds, cardId);
      const nextToIds = placeCardId(toZoneCardIds, cardId, placement);
      writeZone(maps, { ...fromZone, cardIds: nextFromIds });
      writeZone(maps, { ...toZone, cardIds: nextToIds });
      writeCard(maps, publicCard);
    }

    if (willBeFaceDownBattlefield && (!wasFaceDownBattlefield || !faceDownIdentity)) {
      hidden.faceDownBattlefield[cardId] = buildCardIdentity(nextCard);
      if (!hidden.faceDownReveals[cardId]) {
        hidden.faceDownReveals[cardId] = {};
      }
      maps.faceDownRevealsToAll.delete(cardId);
      markHiddenChanged({
        ownerId: nextCard.controllerId,
        zoneId: toZone.id,
        reveal: hidden.faceDownReveals[cardId],
      });
    }
    if (wasFaceDownBattlefield && !willBeFaceDownBattlefield) {
      Reflect.deleteProperty(hidden.faceDownBattlefield, cardId);
      Reflect.deleteProperty(hidden.faceDownReveals, cardId);
      maps.faceDownRevealsToAll.delete(cardId);
      markHiddenChanged({
        ownerId: card.controllerId,
        zoneId: fromZone.id,
        reveal: priorReveal,
      });
    }
    return { ok: true };
  }

  if (fromHidden && toHidden) {
    const nextCard = buildMovedCard(card, plan);

    if (fromZone.type === ZONE.HAND) {
      const nextOrder =
        fromZone.id === toZone.id
          ? placeCardId(hidden.handOrder[fromZone.ownerId] ?? [], cardId, placement)
          : removeFromArray(hidden.handOrder[fromZone.ownerId] ?? [], cardId);
      hidden.handOrder[fromZone.ownerId] = nextOrder;
      writeZone(maps, { ...fromZone, cardIds: nextOrder });
    }
    if (fromZone.type === ZONE.LIBRARY) {
      hidden.libraryOrder[fromZone.ownerId] = removeFromArray(
        hidden.libraryOrder[fromZone.ownerId] ?? [],
        cardId
      );
    }
    if (fromZone.type === ZONE.SIDEBOARD) {
      hidden.sideboardOrder[fromZone.ownerId] = removeFromArray(
        hidden.sideboardOrder[fromZone.ownerId] ?? [],
        cardId
      );
    }

    if (toZone.type === ZONE.HAND) {
      const nextOrder =
        fromZone.id === toZone.id
          ? hidden.handOrder[toZone.ownerId] ?? []
          : placeCardId(hidden.handOrder[toZone.ownerId] ?? [], cardId, placement);
      hidden.handOrder[toZone.ownerId] = nextOrder;
      writeZone(maps, { ...toZone, cardIds: nextOrder });
    }
    if (toZone.type === ZONE.LIBRARY) {
      hidden.libraryOrder[toZone.ownerId] = placeCardId(
        hidden.libraryOrder[toZone.ownerId] ?? [],
        cardId,
        placement
      );
    }
    if (toZone.type === ZONE.SIDEBOARD) {
      hidden.sideboardOrder[toZone.ownerId] = placeCardId(
        hidden.sideboardOrder[toZone.ownerId] ?? [],
        cardId,
        placement
      );
    }

    hidden.cards[cardId] = nextCard;

    if (fromZone.type === ZONE.HAND && toZone.type !== ZONE.HAND) {
      Reflect.deleteProperty(hidden.handReveals, cardId);
      maps.handRevealsToAll.delete(cardId);
    }
    if (fromZone.type === ZONE.LIBRARY && toZone.type !== ZONE.LIBRARY) {
      Reflect.deleteProperty(hidden.libraryReveals, cardId);
      maps.libraryRevealsToAll.delete(cardId);
    }
    if (toZone.type === ZONE.LIBRARY) {
      nextCard.knownToAll = false;
      Reflect.deleteProperty(hidden.libraryReveals, cardId);
      maps.libraryRevealsToAll.delete(cardId);
    }
    if (toZone.type === ZONE.HAND) {
      if (nextCard.knownToAll) {
        hidden.handReveals[cardId] = { toAll: true };
        maps.handRevealsToAll.set(cardId, buildCardIdentity(nextCard));
      } else {
        Reflect.deleteProperty(hidden.handReveals, cardId);
        maps.handRevealsToAll.delete(cardId);
      }
    }

    updateCountsForZoneMove(maps, hidden, fromZone.ownerId, toZone.ownerId);
    if (fromZone.type === ZONE.LIBRARY) {
      syncLibraryRevealsToAllForPlayer(maps, hidden, fromZone.ownerId, fromZone.id);
    }
    if (toZone.type === ZONE.LIBRARY && toZone.ownerId !== fromZone.ownerId) {
      syncLibraryRevealsToAllForPlayer(maps, hidden, toZone.ownerId, toZone.id);
    }
    const nextReveal =
      toZone.type === ZONE.HAND
        ? hidden.handReveals[cardId]
        : toZone.type === ZONE.LIBRARY
          ? hidden.libraryReveals[cardId]
          : undefined;
    markHiddenChanged({
      ownerId: fromZone.ownerId,
      zoneId: fromZone.id,
      reveal: priorReveal,
    });
    if (toZone.ownerId !== fromZone.ownerId) {
      markHiddenChanged({
        ownerId: toZone.ownerId,
        zoneId: toZone.id,
        reveal: nextReveal,
      });
    }
    return { ok: true };
  }

  if (!fromHidden && toHidden) {
    const tokenLeavingBattlefield =
      card.isToken && fromZone.type === ZONE.BATTLEFIELD && toZone.type !== ZONE.BATTLEFIELD;
    if (tokenLeavingBattlefield) {
      const nextFromIds = removeFromArray(fromZoneCardIds, cardId);
      writeZone(maps, { ...fromZone, cardIds: nextFromIds });
      maps.cards.delete(cardId);
      return { ok: true };
    }

    const wasFaceDownBattlefield = fromZone.type === ZONE.BATTLEFIELD && card.faceDown;
    const faceDownIdentity = wasFaceDownBattlefield
      ? hidden.faceDownBattlefield[cardId]
      : undefined;
    const cardWithIdentity = mergeCardIdentity(card, faceDownIdentity);
    const nextCard = buildMovedCard(cardWithIdentity, plan);

    const nextFromIds = removeFromArray(fromZoneCardIds, cardId);
    writeZone(maps, { ...fromZone, cardIds: nextFromIds });
    maps.cards.delete(cardId);

    if (wasFaceDownBattlefield) {
      Reflect.deleteProperty(hidden.faceDownBattlefield, cardId);
      Reflect.deleteProperty(hidden.faceDownReveals, cardId);
      maps.faceDownRevealsToAll.delete(cardId);
    }

    hidden.cards[cardId] = nextCard;
    if (toZone.type === ZONE.HAND) {
      const nextOrder = placeCardId(hidden.handOrder[toZone.ownerId] ?? [], cardId, placement);
      hidden.handOrder[toZone.ownerId] = nextOrder;
      writeZone(maps, { ...toZone, cardIds: nextOrder });
      if (nextCard.knownToAll) {
        hidden.handReveals[cardId] = { toAll: true };
        maps.handRevealsToAll.set(cardId, buildCardIdentity(nextCard));
      } else {
        Reflect.deleteProperty(hidden.handReveals, cardId);
        maps.handRevealsToAll.delete(cardId);
      }
    } else if (toZone.type === ZONE.LIBRARY) {
      hidden.libraryOrder[toZone.ownerId] = placeCardId(
        hidden.libraryOrder[toZone.ownerId] ?? [],
        cardId,
        placement
      );
      Reflect.deleteProperty(hidden.libraryReveals, cardId);
      maps.libraryRevealsToAll.delete(cardId);
      nextCard.knownToAll = false;
    } else if (toZone.type === ZONE.SIDEBOARD) {
      hidden.sideboardOrder[toZone.ownerId] = placeCardId(
        hidden.sideboardOrder[toZone.ownerId] ?? [],
        cardId,
        placement
      );
    }

    updateCountsForZoneMove(maps, hidden, toZone.ownerId, toZone.ownerId);
    if (toZone.type === ZONE.LIBRARY) {
      syncLibraryRevealsToAllForPlayer(maps, hidden, toZone.ownerId, toZone.id);
    }
    const nextReveal =
      toZone.type === ZONE.HAND
        ? hidden.handReveals[cardId]
        : toZone.type === ZONE.LIBRARY
          ? hidden.libraryReveals[cardId]
          : undefined;
    markHiddenChanged({
      ownerId: toZone.ownerId,
      zoneId: toZone.id,
      reveal: nextReveal,
    });
    return { ok: true };
  }

  if (fromHidden && !toHidden) {
    if (fromZone.type === ZONE.HAND) {
      const nextOrder = removeFromArray(hidden.handOrder[fromZone.ownerId] ?? [], cardId);
      hidden.handOrder[fromZone.ownerId] = nextOrder;
      writeZone(maps, { ...fromZone, cardIds: nextOrder });
      Reflect.deleteProperty(hidden.handReveals, cardId);
      maps.handRevealsToAll.delete(cardId);
    }
    if (fromZone.type === ZONE.LIBRARY) {
      hidden.libraryOrder[fromZone.ownerId] = removeFromArray(
        hidden.libraryOrder[fromZone.ownerId] ?? [],
        cardId
      );
      Reflect.deleteProperty(hidden.libraryReveals, cardId);
      maps.libraryRevealsToAll.delete(cardId);
    }
    if (fromZone.type === ZONE.SIDEBOARD) {
      hidden.sideboardOrder[fromZone.ownerId] = removeFromArray(
        hidden.sideboardOrder[fromZone.ownerId] ?? [],
        cardId
      );
    }

    const resolvedPosition = resolveMoveApplicationPosition({
      maps,
      card,
      cardId,
      fromZone,
      toZone,
      toZoneCardIds,
      position,
      opts,
    });

    const branchPlan = planCardMovement({
      card,
      fromZone,
      toZone,
      placement,
      position: resolvedPosition,
      opts,
      cardNameForLog: faceDownIdentityForLog?.name,
    });
    const nextCard = buildMovedCard(card, branchPlan);

    const nextToIds = placeCardId(toZoneCardIds, cardId, placement);
    writeZone(maps, { ...toZone, cardIds: nextToIds });
    const willBeFaceDownBattlefield =
      toZone.type === ZONE.BATTLEFIELD && nextCard.faceDown;
    const publicCard = willBeFaceDownBattlefield ? stripCardIdentity(nextCard) : nextCard;
    writeCard(maps, publicCard);
    Reflect.deleteProperty(hidden.cards, cardId);

    if (willBeFaceDownBattlefield) {
      hidden.faceDownBattlefield[cardId] = buildCardIdentity(nextCard);
      hidden.faceDownReveals[cardId] = {};
      maps.faceDownRevealsToAll.delete(cardId);
    }

    updateCountsForZoneMove(maps, hidden, fromZone.ownerId, fromZone.ownerId);
    if (fromZone.type === ZONE.LIBRARY) {
      syncLibraryRevealsToAllForPlayer(maps, hidden, fromZone.ownerId, fromZone.id);
    }
    markHiddenChanged({
      ownerId: fromZone.ownerId,
      zoneId: fromZone.id,
      reveal: priorReveal,
    });
    return { ok: true };
  }

  return { ok: true };
};
