import type { Card } from "@/types";
import { getLocale } from "@/paraglide/runtime.js";
import { getCurrentFaceIndex, getDisplayName } from "@/lib/cardDisplay";
import { peekLocalizedCard } from "@/services/scryfall/localizedCards";

/** Presentation only. Gameplay code keeps using canonical names and original printing IDs. */
export function getLocalizedDisplayName(card: Card) {
  const translated = card.scryfallId ? peekLocalizedCard(card.scryfallId, getLocale()) : null;
  const face = translated?.card_faces?.[getCurrentFaceIndex(card)];
  return face?.printed_name || translated?.printed_name || getDisplayName(card);
}
