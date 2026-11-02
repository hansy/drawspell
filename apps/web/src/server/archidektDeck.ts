import { m } from "@/paraglide/messages.js";
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
    if (!deckId) throw new Error(m.archidekt_deck_that_isn_t_an_archidekt_deck_link());

    const response = await fetch(`https://archidekt.com/api/decks/${deckId}/`, {
      headers: { accept: "application/json" },
    });
    if (response.status === 404) {
      throw new Error(m.archidekt_deck_archidekt_couldn_t_find_that_deck_check_it_s_public());
    }
    if (!response.ok) {
      throw new Error(m.archidekt_deck_archidekt_didn_t_respond_try_again_or_paste_the_list({ status: response.status }));
    }
    const deck = (await response.json()) as ArchidektDeck;
    return {
      name: typeof deck.name === "string" ? deck.name : null,
      decklist: archidektDeckToDecklist(deck),
    };
  });
