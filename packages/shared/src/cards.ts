import type { Card } from "./types/cards";

export const getCardFaces = (card: Card) => card.scryfall?.card_faces ?? [];

export const getCurrentFaceIndex = (card: Card): number => {
  const faces = getCardFaces(card);
  if (!faces.length) return 0;
  const index = card.currentFaceIndex ?? 0;
  if (index < 0) return 0;
  if (index >= faces.length) return faces.length - 1;
  return index;
};

export const syncCardStatsToFace = (
  card: Card,
  faceIndex?: number,
  options?: { preserveExisting?: boolean }
): Card => {
  const faces = getCardFaces(card);
  const targetIndex = faceIndex ?? getCurrentFaceIndex(card);
  const targetFace = faces[targetIndex];
  if (!targetFace) return { ...card, currentFaceIndex: targetIndex };

  const hasPower = targetFace.power !== undefined;
  const hasToughness = targetFace.toughness !== undefined;
  const preserve = options?.preserveExisting;

  return {
    ...card,
    currentFaceIndex: targetIndex,
    power:
      preserve && card.power !== undefined
        ? card.power
        : hasPower
          ? targetFace.power
          : undefined,
    toughness:
      preserve && card.toughness !== undefined
        ? card.toughness
        : hasToughness
          ? targetFace.toughness
          : undefined,
    basePower: hasPower ? targetFace.power : undefined,
    baseToughness: hasToughness ? targetFace.toughness : undefined,
  };
};

export const resetCardToFrontFace = (card: Card): Card => {
  const reset = syncCardStatsToFace({ ...card, currentFaceIndex: 0 }, 0);
  if (!getCardFaces(card).length) {
    return {
      ...reset,
      power: reset.basePower ?? reset.power,
      toughness: reset.baseToughness ?? reset.toughness,
    };
  }
  return reset;
};

export const buildDuplicateTokenCard = (params: {
  sourceCard: Card;
  newCardId: string;
  position: Card["position"];
}): Card => ({
  ...params.sourceCard,
  id: params.newCardId,
  isToken: true,
  isCommander: false,
  commanderTax: 0,
  position: params.position,
  counters: params.sourceCard.counters.map((counter) => ({ ...counter })),
});
