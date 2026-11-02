import { m } from "@/paraglide/messages.js";
import { scryfallRequest, type ScryfallRequest } from "@/services/scryfall/scryfallRequest";
import { ScryfallCard } from "@/types";

export interface FetchScryfallCardOptions {
  fetchImpl?: ScryfallRequest;
}

export const fetchScryfallCardByUri = async (
  uri: string,
  { fetchImpl }: FetchScryfallCardOptions = {}
): Promise<ScryfallCard> => {
  const fetcher = fetchImpl ?? scryfallRequest;
  const response = await fetcher(uri);
  if (!response.ok) {
    throw new Error(
      m.scryfall_card_scryfall_fetch_failed({ status: response.status, statusText: response.statusText })
    );
  }
  return (await response.json()) as ScryfallCard;
};

