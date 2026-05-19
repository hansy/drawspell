import type { Card } from "./types/cards";

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
