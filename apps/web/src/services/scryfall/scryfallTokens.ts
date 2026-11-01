import { toScryfallLanguage, type AppLocale } from "@/i18n/locales";
import { scryfallRequest, type ScryfallRequest } from "@/services/scryfall/scryfallRequest";
import { ScryfallCard, ScryfallListResult } from "@/types/scryfall";
import { isAbortError } from "@/lib/errors";

export const TOKEN_SEARCH_PREFIX =
  "(type:token OR type:emblem OR set_type:token) (game:paper)";
export const MIN_TOKEN_SEARCH_CHARS = 3;
export const DEFAULT_TOKEN_SEARCH_DEBOUNCE_MS = 300;

export type TokenSearchResult = ScryfallListResult<ScryfallCard>;

export interface TokenSearchOptions {
  locale?: AppLocale;
  unique?: "cards" | "art" | "prints";
  signal?: AbortSignal;
  fetchImpl?: ScryfallRequest;
}

export interface DebouncedTokenSearchOptions extends TokenSearchOptions {
  debounceMs?: number;
}

export interface DebouncedTokenSearch {
  search: (query: string) => Promise<TokenSearchResult | null>;
  cancel: () => void;
}

const hasExplicitScryfallSyntax = (query: string) =>
  /(?:^|[\s(])-?[a-z_]+(?:[:=<>])/.test(query) ||
  /\b(?:AND|OR|NOT)\b/.test(query);

const quoteScryfallValue = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

export const buildTokenSearchQuery = (query: string) => {
  const trimmedQuery = query.trim();
  const userQuery = hasExplicitScryfallSyntax(trimmedQuery)
    ? trimmedQuery
    : `(name:"${quoteScryfallValue(trimmedQuery)}" OR type:"${quoteScryfallValue(trimmedQuery)}")`;

  return `${TOKEN_SEARCH_PREFIX} ${userQuery}`.trim();
};

export const buildTokenSearchUrl = (
  query: string,
  { unique = "cards", locale = "en" }: Pick<TokenSearchOptions, "unique" | "locale"> = {}
) => {
  const searchQuery = buildTokenSearchQuery(query.trim());
  const localizedQuery = locale === "en" ? searchQuery : `(${searchQuery}) lang:${toScryfallLanguage(locale)}`;
  const params = new URLSearchParams({ q: localizedQuery, unique });
  if (locale !== "en") params.set("include_multilingual", "true");

  return `https://api.scryfall.com/cards/search?${params.toString()}`;
};

export async function searchScryfallTokens(
  query: string,
  options: TokenSearchOptions = {}
): Promise<TokenSearchResult | null> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < MIN_TOKEN_SEARCH_CHARS) {
    return null;
  }

  const { unique, signal, fetchImpl, locale = "en" } = options;
  const fetcher = fetchImpl ?? scryfallRequest;
  const url = buildTokenSearchUrl(trimmedQuery, { unique, locale });

  let response = await fetcher(url, { signal });
  // Many tokens have no translated printing. Only a 404 is evidence of no results.
  if (response.status === 404 && locale !== "en") {
    response = await fetcher(buildTokenSearchUrl(trimmedQuery, { unique }), { signal });
  }
  if (!response.ok) {
    throw new Error(
      `Scryfall token search failed (${response.status} ${response.statusText})`
    );
  }

  return (await response.json()) as TokenSearchResult;
}

export function createDebouncedTokenSearch(
  options: DebouncedTokenSearchOptions = {}
): DebouncedTokenSearch {
  const { debounceMs = DEFAULT_TOKEN_SEARCH_DEBOUNCE_MS, ...searchOptions } =
    options;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: AbortController | null = null;
  let pendingReject: ((reason?: unknown) => void) | null = null;

  const cancelTimers = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const cancelInFlight = () => {
    if (inFlight) {
      inFlight.abort();
      inFlight = null;
    }
  };

  const rejectPending = (message: string) => {
    if (!pendingReject) return;
    const error = new Error(message);
    error.name = "AbortError";
    pendingReject(error);
    pendingReject = null;
  };

  const search = (query: string) => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < MIN_TOKEN_SEARCH_CHARS) {
      cancelTimers();
      cancelInFlight();
      rejectPending("Token search aborted: query too short");
      return Promise.resolve(null);
    }

    cancelTimers();
    cancelInFlight();
    rejectPending("Token search superseded");

    return new Promise<TokenSearchResult | null>((resolve, reject) => {
      pendingReject = reject;

      timer = setTimeout(async () => {
        timer = null;
        inFlight = new AbortController();

        try {
          const result = await searchScryfallTokens(trimmedQuery, {
            ...searchOptions,
            signal: inFlight.signal,
          });
          resolve(result);
        } catch (error) {
          if (isAbortError(error)) {
            return;
          }
          reject(error);
        } finally {
          inFlight = null;
          pendingReject = null;
        }
      }, debounceMs);
    });
  };

  const cancel = () => {
    cancelTimers();
    cancelInFlight();
    rejectPending("Token search cancelled");
  };

  return { search, cancel };
}

// Scryfall returns tokens by name, so "treasure" lists Dinosaur // Treasure
// before Treasure. Put exact matches first, then prefix matches, then
// single-faced tokens ahead of double-faced ones.
export const rankTokenResults = <T extends { name: string; printed_name?: string }>(
  query: string,
  cards: T[],
): T[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return cards;
  const score = (card: T) => {
    const name = (card.printed_name || card.name).toLowerCase();
    const faces = name.split(" // ");
    if (name === needle) return 0;
    if (faces.length === 1 && name.startsWith(needle)) return 1;
    if (faces.some((face) => face === needle)) return 2;
    if (faces.length === 1) return 3;
    return 4;
  };
  return cards
    .map((card, index) => ({ card, index, rank: score(card) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.card);
};
