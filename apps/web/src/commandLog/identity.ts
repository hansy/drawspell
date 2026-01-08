import type { Card } from "@/types";

const UNKNOWN_CARD_NAME = "Unknown Card";

export const extractCardIdentity = (card: Card): Partial<Card> => ({
  name: card.name,
  imageUrl: card.imageUrl,
  oracleText: card.oracleText,
  typeLine: card.typeLine,
  scryfallId: card.scryfallId,
  scryfall: card.scryfall,
  isToken: card.isToken,
  power: card.power,
  toughness: card.toughness,
  basePower: card.basePower,
  baseToughness: card.baseToughness,
  customText: card.customText,
  currentFaceIndex: card.currentFaceIndex,
  isCommander: card.isCommander,
  commanderTax: card.commanderTax,
});

export const stripCardIdentity = (card: Card): Card => ({
  ...card,
  name: UNKNOWN_CARD_NAME,
  imageUrl: undefined,
  oracleText: undefined,
  typeLine: undefined,
  scryfallId: undefined,
  scryfall: undefined,
  isToken: undefined,
  power: undefined,
  toughness: undefined,
  basePower: undefined,
  baseToughness: undefined,
  customText: undefined,
  currentFaceIndex: undefined,
  isCommander: undefined,
  commanderTax: undefined,
});
