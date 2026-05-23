import type { Zone } from "@/types";

import { MAX_CARDS_PER_ZONE } from "@/lib/limits";

import { dedupeStrings } from "./utils";

export const sanitizeZone = (value: any): Zone | null => {
  if (!value || typeof value.id !== "string" || typeof value.ownerId !== "string") return null;
  const rawType = typeof value.type === "string" ? value.type : null;
  const type = rawType === "command" ? "commander" : rawType;
  if (!type) return null;
  if (![
    "library",
    "hand",
    "battlefield",
    "graveyard",
    "exile",
    "commander",
    "sideboard",
  ].includes(type)) {
    return null;
  }
  const ids = Array.isArray(value.cardIds)
    ? dedupeStrings(value.cardIds, MAX_CARDS_PER_ZONE)
    : [];
  return {
    id: value.id,
    type,
    ownerId: value.ownerId,
    cardIds: ids,
  };
};
