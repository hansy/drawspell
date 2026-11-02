import type { Card } from "@/types";
import { getLocale } from "@/paraglide/runtime.js";
import { m } from "@/paraglide/messages.js";
import { useGameStore } from "@/store/gameStore";
import { canViewerSeeCardIdentity } from "@/lib/reveal";
import { getCurrentFaceIndex } from "@/lib/cardDisplay";
import { getLocalizedDisplayName } from "@/i18n/cardDisplay";
import { useLocalizedScryfallCard } from "@/hooks/scryfall/useLocalizedScryfallCard";
import { localizedCardPresentation } from "@/services/scryfall/localizedPresentation";

export function LocalizedCardName({ card }: { card: Card }) {
  const viewerId = useGameStore((state) => state.myPlayerId);
  const role = useGameStore((state) => state.viewerRole);
  const zone = useGameStore((state) => state.zones[card.zoneId]);
  const visible = canViewerSeeCardIdentity(card, zone?.type, viewerId, role);
  const { original, data } = useLocalizedScryfallCard(card.scryfallId, getLocale(), visible);
  if (!visible) return m.hidden_card();
  return original ? localizedCardPresentation(original, data, getCurrentFaceIndex(card)).name : getLocalizedDisplayName(card);
}
