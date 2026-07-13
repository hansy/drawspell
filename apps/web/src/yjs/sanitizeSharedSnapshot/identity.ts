import type { CardIdentity, LibraryRevealEntry } from "@/types";

import {
  MAX_NAME_LENGTH,
  MAX_MANA_COST_LENGTH,
  MAX_TYPE_LINE_LENGTH,
  MAX_ORACLE_TEXT_LENGTH,
  MAX_SCRYFALL_ID_LENGTH,
  MAX_REVEAL_ORDER_KEY_LENGTH,
} from "../sanitizeLimits";
import { clampString, isRecord, normalizeScryfallLiteForSync, sanitizeImageUrl } from "../mutations/shared";

export const sanitizeCardIdentity = (value: unknown): CardIdentity | null => {
  if (!isRecord(value)) return null;
  const rawName = clampString(value.name, MAX_NAME_LENGTH);
  const name = rawName || "Card";
  const identity: CardIdentity = { name };

  const canonicalName = clampString(value.canonicalName, MAX_NAME_LENGTH);
  if (canonicalName) identity.canonicalName = canonicalName;

  const manaCost = clampString(value.manaCost, MAX_MANA_COST_LENGTH);
  if (manaCost) identity.manaCost = manaCost;

  if (typeof value.manaValue === "number" && Number.isFinite(value.manaValue)) {
    identity.manaValue = Math.max(0, Math.min(1_000, value.manaValue));
  }

  const imageUrl = sanitizeImageUrl(value.imageUrl);
  if (imageUrl) identity.imageUrl = imageUrl;

  const oracleText = clampString(value.oracleText, MAX_ORACLE_TEXT_LENGTH);
  if (oracleText) identity.oracleText = oracleText;

  const typeLine = clampString(value.typeLine, MAX_TYPE_LINE_LENGTH);
  if (typeLine) identity.typeLine = typeLine;

  const scryfallId = clampString(value.scryfallId, MAX_SCRYFALL_ID_LENGTH);
  if (scryfallId) identity.scryfallId = scryfallId;

  const scryfall = normalizeScryfallLiteForSync(value.scryfall);
  if (scryfall) identity.scryfall = scryfall;

  if (value.isToken === true) identity.isToken = true;

  return identity;
};

export const sanitizeLibraryRevealEntry = (value: unknown): LibraryRevealEntry | null => {
  if (!isRecord(value)) return null;
  const card = sanitizeCardIdentity(value.card);
  if (!card) return null;
  const orderKey = clampString(value.orderKey, MAX_REVEAL_ORDER_KEY_LENGTH);
  if (!orderKey) return null;
  const ownerId = typeof value.ownerId === "string" ? value.ownerId : undefined;
  return ownerId ? { card, orderKey, ownerId } : { card, orderKey };
};
