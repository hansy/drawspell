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
      `Scryfall fetch failed (${response.status} ${response.statusText})`
    );
  }
  return (await response.json()) as ScryfallCard;
};

