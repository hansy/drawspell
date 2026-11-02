import type { Card } from "@/types";
import { getLocale } from "@/paraglide/runtime.js";
import { m } from "@/paraglide/messages.js";
import { useGameStore } from "@/store/gameStore";
import { canViewerSeeCardInZone } from "@/lib/reveal";
import { useLocalizedScryfallCard } from "@/hooks/scryfall/useLocalizedScryfallCard";
import { localizedCardPresentation } from "@/services/scryfall/localizedPresentation";
import { toScryfallLanguage } from "@/i18n/locales";

export function LocalizedCardRules({ card, faceDown }: { card: Card; faceDown: boolean }) {
  const viewerId = useGameStore((state) => state.myPlayerId);
  const role = useGameStore((state) => state.viewerRole);
  const zone = useGameStore((state) => state.zones[card.zoneId]);
  const libraryTopReveal = useGameStore((state) => state.players[zone?.ownerId ?? card.ownerId]?.libraryTopReveal);
  const canSee = !faceDown && canViewerSeeCardInZone(card, zone, viewerId, role, libraryTopReveal);
  const locale = getLocale();
  const { original, data } = useLocalizedScryfallCard(card.scryfallId, locale, canSee);
  if (!canSee || !original) return null;
  const presentation = localizedCardPresentation(original, data, card.currentFaceIndex ?? 0);
  const fallback = data && data.lang !== toScryfallLanguage(locale);
  return (
    <details className="absolute left-0 top-full z-50 mt-2 max-h-60 w-full overflow-auto rounded border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-200 shadow-xl">
      <summary className="cursor-pointer">{m.card_rules()}</summary>
      <p className="mt-2 font-semibold">{presentation.name}</p>
      <p>{presentation.typeLine}</p>
      <p className="mt-2 whitespace-pre-wrap">{presentation.printedText}</p>
      {fallback ? <p className="mt-2 text-xs text-zinc-400">{m.scryfall_language_fallback()}</p> : null}
      {locale !== "en" && presentation.oracleText ? (
        <details className="mt-2">
          <summary className="cursor-pointer">{m.card_english_oracle()}</summary>
          <p lang="en" className="mt-2 whitespace-pre-wrap">{presentation.oracleText}</p>
        </details>
      ) : null}
    </details>
  );
}
