import type { Card, ZoneType } from "@/types";
import type { ScryfallCard, ScryfallRelatedCard } from "@/types/scryfall";
import type { ScryfallFetchError } from "@/services/scryfall/scryfallErrors";

import { ZONE } from "@/constants/zones";

export const filterNonComboRelatedParts = (
  parts: ScryfallRelatedCard[] | undefined
): ScryfallRelatedCard[] => {
  return (parts ?? []).filter((part) => part.component !== "combo_piece");
};

export const fetchBattlefieldRelatedParts = async (params: {
  card: Pick<Card, "scryfallId">;
  zoneType: ZoneType | undefined;
  fetchCardById: (
    scryfallId: string
  ) => Promise<{ card: ScryfallCard | null; errors: ScryfallFetchError[] }>;
}): Promise<ScryfallRelatedCard[] | undefined> => {
  if (!params.card.scryfallId) return undefined;
  if (params.zoneType !== ZONE.BATTLEFIELD) return undefined;

  try {
    const result = await params.fetchCardById(params.card.scryfallId);
    const fullCard = result.card;
    return fullCard?.all_parts ? filterNonComboRelatedParts(fullCard.all_parts) : undefined;
  } catch {
    return undefined;
  }
};
