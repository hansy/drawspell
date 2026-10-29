import { createServerFn } from "@tanstack/react-start";

import {
  archidektDeckToDecklist,
  parseArchidektDeckId,
  type ArchidektDeck,
} from "@/services/deck-import/archidektImport";

type ArchidektDeckRequest = { url: string };
type ArchidektDeckResponse = { name: string | null; decklist: string };

const archidektDeckValidator = (input: ArchidektDeckRequest) => input;

// Archidekt's API doesn't allow browser requests from other sites, so the
// deck is fetched here and returned as plain decklist text.
export const fetchArchidektDeck = createServerFn({ method: "POST" })
  .inputValidator(archidektDeckValidator)
  .handler(async (ctx): Promise<ArchidektDeckResponse> => {
    const deckId = parseArchidektDeckId(ctx.data?.url ?? "");
    if (!deckId) throw new Error("That isn't an Archidekt deck link.");

    const response = await fetch(`https://archidekt.com/api/decks/${deckId}/`, {
      headers: { accept: "application/json" },
    });
    if (response.status === 404) {
      throw new Error("Archidekt couldn't find that deck. Check it's public.");
    }
    if (!response.ok) {
      throw new Error(`Archidekt didn't respond (${response.status}). Try again or paste the list.`);
    }
    const deck = (await response.json()) as ArchidektDeck;
    return {
      name: typeof deck.name === "string" ? deck.name : null,
      decklist: archidektDeckToDecklist(deck),
    };
  });
