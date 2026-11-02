import { m } from "@/paraglide/messages.js";
import type { FetchScryfallResult, ParsedCard } from "./types";
import { formatMissingCards } from "./formatMissingCards";
import { formatScryfallErrors } from "@/services/scryfall/scryfallErrors";

export const validateImportResult = (
  parsedDeck: ParsedCard[],
  result: FetchScryfallResult
): { ok: true; warnings: string[] } | { ok: false; error: string } => {
  const expectedCount = parsedDeck.reduce((sum, card) => sum + card.quantity, 0);

  if (result.errors.length) {
    const errorMessage = formatScryfallErrors(result.errors);
    if (result.cards.length === expectedCount && result.missing.length === 0) {
      return { ok: true, warnings: [...result.warnings, errorMessage] };
    }

    if (result.missing.length) {
      return {
        ok: false,
        error: m.deck_missing_with_error({ errorMessage, cards: formatMissingCards(result.missing) }),
      };
    }

    if (result.cards.length === 0) {
      return { ok: false, error: errorMessage };
    }

    return {
      ok: false,
      error: m.deck_count_with_error({ errorMessage, expectedCount, actualCount: result.cards.length }),
    };
  }

  if (result.missing.length) {
    return {
      ok: false,
      error: m.deck_missing({ cards: formatMissingCards(result.missing) }),
    };
  }

  if (result.cards.length === 0) {
    return {
      ok: false,
      error:
        m.deck_empty(),
    };
  }

  if (result.cards.length !== expectedCount) {
    return {
      ok: false,
      error: m.deck_count({ expectedCount, actualCount: result.cards.length }),
    };
  }

  return { ok: true, warnings: result.warnings };
};
