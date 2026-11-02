import { m } from "@/paraglide/messages.js";
import { MAX_CARDS_PER_ZONE } from "@/lib/limits";
import { MAX_COMMANDER_ZONE_CARDS } from "@mtg/shared/constants/limits";
import { getRequestedCounts } from "./counts";
import type { ParsedCard } from "./types";

export const validateDeckListLimits = (
  parsedDeck: ParsedCard[],
  opts?: { maxLibraryCards?: number }
): { ok: true } | { ok: false; error: string } => {
  const { library, commander } = getRequestedCounts(parsedDeck);
  const maxLibraryCards = opts?.maxLibraryCards ?? MAX_CARDS_PER_ZONE;

  if (library > maxLibraryCards) {
    return {
      ok: false,
      error: m.deck_too_large({ count: library, limit: maxLibraryCards }),
    };
  }

  if (commander > MAX_COMMANDER_ZONE_CARDS) {
    return {
      ok: false,
      error: m.commander_too_large({ count: commander, limit: MAX_COMMANDER_ZONE_CARDS }),
    };
  }

  return { ok: true };
};
