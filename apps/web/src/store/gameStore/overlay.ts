import { ZONE } from "@/constants/zones";
import type { Card, GameState, Zone } from "@/types";
import type { PrivateOverlayPayload } from "@/partykit/messages";
import { isHiddenZoneType } from "@mtg/shared/constants/zones";

const preservePublicZoneState = (existing: Card, merged: Card): Card => {
  return {
    ...merged,
    zoneId: existing.zoneId,
    position: existing.position,
    tapped: existing.tapped,
    counters: existing.counters,
    faceDown: existing.faceDown,
    faceDownMode: existing.faceDownMode,
    controllerId: existing.controllerId,
    rotation: existing.rotation,
    currentFaceIndex: existing.currentFaceIndex,
    isCommander: existing.isCommander,
    commanderTax: existing.commanderTax,
    knownToAll: existing.knownToAll,
  };
};

type PlaceholderCardLocation = {
  ownerId: string;
  zoneId: string;
};

const createPlaceholderCard = (params: {
  id: string;
  ownerId: string;
  zoneId: string;
}): Card => ({
  id: params.id,
  name: "Card",
  ownerId: params.ownerId,
  controllerId: params.ownerId,
  zoneId: params.zoneId,
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
  knownToAll: false,
  revealedToAll: false,
  revealedTo: [],
});

const ensurePlaceholderCard = (
  cards: Record<string, Card>,
  cardId: string,
  location: PlaceholderCardLocation | undefined
) => {
  if (cards[cardId] || !location) return;

  cards[cardId] = createPlaceholderCard({
    id: cardId,
    ownerId: location.ownerId,
    zoneId: location.zoneId,
  });
};

const applyPublicReveal = (
  cards: Record<string, Card>,
  cardId: string,
  identity: Partial<Card>
) => {
  const existing = cards[cardId];
  if (!existing) return;

  cards[cardId] = {
    ...existing,
    ...identity,
    revealedToAll: true,
  };
};

const buildHandCardZones = (zones: Record<string, Zone>) => {
  const byCardId = new Map<string, PlaceholderCardLocation>();
  Object.values(zones).forEach((zone) => {
    if (zone.type !== ZONE.HAND) return;
    zone.cardIds.forEach((cardId) => {
      if (typeof cardId !== "string") return;
      byCardId.set(cardId, { ownerId: zone.ownerId, zoneId: zone.id });
    });
  });
  return byCardId;
};

const ensureHiddenZonePlaceholders = (
  zones: Record<string, Zone>,
  cards: Record<string, Card>
) => {
  Object.values(zones).forEach((zone) => {
    if (zone.type !== ZONE.HAND && zone.type !== ZONE.LIBRARY && zone.type !== ZONE.SIDEBOARD) {
      return;
    }
    zone.cardIds.forEach((cardId) => {
      if (typeof cardId !== "string") return;
      ensurePlaceholderCard(cards, cardId, {
        ownerId: zone.ownerId,
        zoneId: zone.id,
      });
    });
  });
};

export const mergePrivateOverlay = (
  base: GameState,
  overlay?: PrivateOverlayPayload | null
): GameState => {
  const nextCards: Record<string, Card> = { ...base.cards };
  const nextZones: Record<string, Zone> = { ...base.zones };
  const handCardZones = buildHandCardZones(base.zones);

  handCardZones.forEach((location, cardId) => {
    ensurePlaceholderCard(nextCards, cardId, location);
  });

  Object.entries(base.handRevealsToAll).forEach(([cardId, identity]) => {
    ensurePlaceholderCard(nextCards, cardId, handCardZones.get(cardId));
    applyPublicReveal(nextCards, cardId, identity);
  });

  Object.entries(base.faceDownRevealsToAll).forEach(([cardId, identity]) => {
    applyPublicReveal(nextCards, cardId, identity);
  });

  if (overlay) {
    overlay.cards.forEach((card) => {
      const existing = nextCards[card.id];
      if (!existing) {
        nextCards[card.id] = card;
        return;
      }
      const merged = { ...existing, ...card };
      const zone = nextZones[existing.zoneId];
      if (zone && !isHiddenZoneType(zone.type)) {
        nextCards[card.id] = preservePublicZoneState(existing, merged);
        return;
      }
      nextCards[card.id] = merged;
    });

    if (overlay.zoneCardOrders) {
      Object.entries(overlay.zoneCardOrders).forEach(([zoneId, cardIds]) => {
        const zone = nextZones[zoneId];
        if (!zone || !Array.isArray(cardIds)) return;
        nextZones[zoneId] = {
          ...zone,
          cardIds: cardIds.filter((id): id is string => typeof id === "string"),
        };
      });
    }
  }

  ensureHiddenZonePlaceholders(nextZones, nextCards);

  const libraryZoneByOwner = new Map<string, string>();
  Object.values(nextZones).forEach((zone) => {
    if (zone.type === ZONE.LIBRARY) {
      libraryZoneByOwner.set(zone.ownerId, zone.id);
    }
  });

  Object.entries(base.libraryRevealsToAll).forEach(([cardId, entry]) => {
    const ownerId = entry.ownerId ?? nextCards[cardId]?.ownerId;
    const zoneId = nextCards[cardId]?.zoneId ?? (ownerId ? libraryZoneByOwner.get(ownerId) : undefined);
    ensurePlaceholderCard(
      nextCards,
      cardId,
      ownerId && zoneId ? { ownerId, zoneId } : undefined
    );
    applyPublicReveal(nextCards, cardId, entry.card);
  });

  return { ...base, cards: nextCards, zones: nextZones };
};
