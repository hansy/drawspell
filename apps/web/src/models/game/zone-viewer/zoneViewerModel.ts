import type { Card, Zone } from "@/types";
import { peekCachedCard } from "@/services/scryfall/scryfallCache";
import { toScryfallCardLite } from "@/types/scryfallLite";

import { ZONE } from "@/constants/zones";

export type ZoneViewerMode = "grouped" | "linear";

export type LibraryCardGroup = {
  /** Case-insensitive canonical-name key. */
  key: string;
  /** Canonical card name displayed to the player. */
  name: string;
  /** Exact Scryfall mana-cost notation, when known. */
  manaCost?: string;
  /** All interchangeable physical copies represented by this row. */
  cards: Card[];
  /** Stable representative used for previews and card actions. */
  representative: Card;
  count: number;
};

export type LibraryManaSection = {
  key: string;
  label: string;
  manaValue: number | null;
  isLands: boolean;
  groups: LibraryCardGroup[];
  cardCount: number;
  uniqueCount: number;
};

const resolveZoneViewerCardMetadata = (card: Card) => {
  const cached = card.scryfallId ? peekCachedCard(card.scryfallId) : null;
  const scryfallLite = card.scryfall ?? (cached ? toScryfallCardLite(cached) : undefined);
  const oracleText =
    card.oracleText ??
    cached?.oracle_text ??
    cached?.card_faces?.map((face) => face.oracle_text).filter(Boolean).join(" ");

  return { cached, scryfallLite, oracleText };
};

const getCanonicalName = (card: Card): string => {
  const { cached } = resolveZoneViewerCardMetadata(card);
  return card.canonicalName?.trim() || cached?.name?.trim() || card.name.trim();
};

const getCanonicalNameKey = (card: Card): string =>
  getCanonicalName(card).toLowerCase();

const getManaCost = (card: Card): string | undefined => {
  if (card.manaCost?.trim()) return card.manaCost.trim();

  const { cached } = resolveZoneViewerCardMetadata(card);
  if (!cached) return undefined;

  if (cached.layout === "split") {
    const combined = cached.card_faces
      ?.map((face) => face.mana_cost?.trim())
      .filter((cost): cost is string => Boolean(cost))
      .join(" // ");
    if (combined) return combined;
  }

  return cached.card_faces?.[0]?.mana_cost?.trim() ||
    cached.mana_cost?.split("//")[0]?.trim() ||
    undefined;
};

const matchesZoneViewerFilter = (card: Card, lowerFilter: string) => {
  const { scryfallLite, oracleText } = resolveZoneViewerCardMetadata(card);
  const nameMatch = card.name.toLowerCase().includes(lowerFilter);
  const canonicalNameMatch = getCanonicalName(card).toLowerCase().includes(lowerFilter);
  const faceNameMatch = scryfallLite?.card_faces?.some((face) =>
    face.name?.toLowerCase().includes(lowerFilter)
  );
  const typeMatch = card.typeLine?.toLowerCase().includes(lowerFilter);
  const oracleMatch = oracleText?.toLowerCase().includes(lowerFilter);

  return nameMatch || canonicalNameMatch || faceNameMatch || typeMatch || oracleMatch;
};

const getZoneViewerGroupKey = (card: Card) => {
  if (card.typeLine?.toLowerCase().includes("land")) {
    return "Lands";
  }

  const { scryfallLite } = resolveZoneViewerCardMetadata(card);
  return `Cost ${card.manaValue ?? scryfallLite?.cmc ?? 0}`;
};

const createLibraryCardGroups = (cards: Card[]): LibraryCardGroup[] => {
  const byCanonicalName = new Map<string, LibraryCardGroup>();

  cards.forEach((card) => {
    const key = getCanonicalNameKey(card);
    const existing = byCanonicalName.get(key);
    if (existing) {
      existing.cards.push(card);
      existing.count += 1;
      if (!existing.manaCost) existing.manaCost = getManaCost(card);
      return;
    }

    byCanonicalName.set(key, {
      key,
      name: getCanonicalName(card),
      manaCost: getManaCost(card),
      cards: [card],
      representative: card,
      count: 1,
    });
  });

  return [...byCanonicalName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
};

export const getZoneViewerMode = (zone: Zone | null, count?: number): ZoneViewerMode => {
  if (zone?.type === ZONE.LIBRARY && !count) return "grouped";
  return "linear";
};

export const computeZoneViewerCards = (params: {
  zone: Zone;
  cardsById: Record<string, Card>;
  count?: number;
  frozenCardIds?: string[] | null;
  filterText: string;
}): Card[] => {
  let cardIds = [...params.zone.cardIds];

  // If count is specified, take from the END (top of library).
  if (params.count && params.count > 0) {
    if (params.zone.type === ZONE.LIBRARY && params.frozenCardIds != null) {
      const frozenSet = new Set(params.frozenCardIds);
      cardIds = cardIds.filter((id) => frozenSet.has(id));
    } else {
      cardIds = cardIds.slice(-params.count);
    }
  }

  let currentCards = cardIds.map((id) => params.cardsById[id]).filter(Boolean);

  const normalizedFilter = params.filterText.trim().toLowerCase();
  if (normalizedFilter) {
    if (getZoneViewerMode(params.zone, params.count) === "grouped") {
      const matchingGroupKeys = new Set(
        currentCards
          .filter((card) => matchesZoneViewerFilter(card, normalizedFilter))
          .map(getCanonicalNameKey)
      );
      currentCards = currentCards.filter((card) =>
        matchingGroupKeys.has(getCanonicalNameKey(card))
      );
    } else {
      currentCards = currentCards.filter((card) =>
        matchesZoneViewerFilter(card, normalizedFilter)
      );
    }
  }

  return currentCards;
};

/**
 * Builds the compact full-library view. Cards are first separated into Lands
 * and mana-value sections, then collapsed by canonical card name.
 */
export const buildLibraryManaSections = (cards: Card[]): LibraryManaSection[] => {
  const manaGroups = groupZoneViewerCards(cards);

  return sortZoneViewerGroupKeys(Object.keys(manaGroups)).map((key) => {
    const sectionCards = manaGroups[key] ?? [];
    const isLands = key === "Lands";
    const manaValue = isLands ? null : Number(key.replace("Cost ", ""));
    const groups = createLibraryCardGroups(sectionCards);

    return {
      key,
      label: isLands ? "Lands" : `${manaValue}-mana`,
      manaValue,
      isLands,
      groups,
      cardCount: sectionCards.length,
      uniqueCount: groups.length,
    };
  });
};

export const groupZoneViewerCards = (cards: Card[]): Record<string, Card[]> => {
  const groups: Record<string, Card[]> = {};

  cards.forEach((card) => {
    const key = getZoneViewerGroupKey(card);
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  });

  return groups;
};

export const sortZoneViewerGroupKeys = (keys: string[]): string[] => {
  return [...keys].sort((a, b) => {
    if (a === "Lands") return -1;
    if (b === "Lands") return 1;

    const costA = parseInt(a.replace("Cost ", ""));
    const costB = parseInt(b.replace("Cost ", ""));
    return costA - costB;
  });
};
