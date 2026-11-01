import { toScryfallLanguage, type AppLocale, type ScryfallLanguage } from "@/i18n/locales";
import type { ScryfallCard } from "@/types/scryfall";
import { cacheCards, getCard } from "./scryfallCache";
import { scryfallRequest, type ScryfallRequest } from "./scryfallRequest";
import {
  buildScryfallHttpError,
  buildScryfallInvalidResponseError,
  buildScryfallNetworkError,
  type ScryfallFetchError,
  type ScryfallFetchResult,
} from "./scryfallErrors";

export type LocalizedCardResult = {
  card: ScryfallCard;
  status: "ready" | "unavailable" | "temporary";
  printing: "original" | "same-printing" | "oracle-printing";
  errors: ScryfallFetchError[];
};

const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const DAY = 24 * 60 * 60 * 1_000;

const isCard = (value: unknown): value is ScryfallCard => {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<ScryfallCard>;
  return card.object === "card" && typeof card.id === "string" &&
    typeof card.name === "string" && typeof card.lang === "string" &&
    typeof card.layout === "string" && typeof card.set === "string" &&
    typeof card.collector_number === "string" &&
    (card.card_faces === undefined || (Array.isArray(card.card_faces) && card.card_faces.every(
      (face) => face && typeof face.name === "string",
    )));
};

/** Avoid mismatched faces/art altering the interpretation of the active face. */
const matchesIdentity = (source: ScryfallCard, candidate: ScryfallCard, language: ScryfallLanguage) =>
  candidate.lang === language &&
  (source.oracle_id ? candidate.oracle_id === source.oracle_id : candidate.name === source.name) &&
  candidate.layout === source.layout &&
  (candidate.card_faces?.length ?? 0) === (source.card_faces?.length ?? 0) &&
  (source.card_faces ?? []).every((face, index) => candidate.card_faces?.[index]?.name === face.name);

/** Viewer-local data only. Never write a localized printing or its name to game state. */
export function createLocalizedCardResolver({
  request = scryfallRequest,
  onResolved = cacheCards,
  now = () => Date.now(),
  maxEntries = 500,
  positiveTtlMs = 30 * DAY,
  missingTtlMs = 60 * 60 * 1_000,
  transientTtlMs = 15_000,
}: {
  request?: ScryfallRequest;
  onResolved?: (cards: ScryfallCard[]) => Promise<void>;
  now?: () => number;
  maxEntries?: number;
  positiveTtlMs?: number;
  missingTtlMs?: number;
  transientTtlMs?: number;
} = {}) {
  const entries = new Map<string, { result: LocalizedCardResult; expiresAt: number }>();
  const pending = new Map<string, Promise<LocalizedCardResult>>();

  const read = async (url: string): Promise<ScryfallFetchResult<unknown | null>> => {
    try {
      const response = await request(url, { headers: { Accept: "application/json" } });
      if (response.status === 404) return { ok: true, data: null };
      if (!response.ok) return { ok: false, error: buildScryfallHttpError({ endpoint: "translation", url, response }) };
      try {
        return { ok: true, data: await response.json() };
      } catch (error) {
        return { ok: false, error: buildScryfallInvalidResponseError({ endpoint: "translation", url, error }) };
      }
    } catch (error) {
      return { ok: false, error: buildScryfallNetworkError({ endpoint: "translation", url, error }) };
    }
  };

  const lookup = async (original: ScryfallCard, language: ScryfallLanguage): Promise<LocalizedCardResult> => {
    const fallback = (status: "unavailable" | "temporary", errors: ScryfallFetchError[] = []): LocalizedCardResult =>
      ({ card: original, status, printing: "original", errors });
    const invalid = (url: string) => fallback("temporary", [
      buildScryfallInvalidResponseError({ endpoint: "translation", url, error: new Error("Unexpected localized card identity or faces") }),
    ]);
    const resolved = async (card: ScryfallCard, printing: LocalizedCardResult["printing"]): Promise<LocalizedCardResult> => {
      // The ordinary card cache is keyed by the translated card's actual printing ID.
      await onResolved([card]).catch(() => undefined);
      return { card, status: "ready", printing, errors: [] };
    };

    const collectorUrl = `https://api.scryfall.com/cards/${encodeURIComponent(original.set)}/${encodeURIComponent(original.collector_number)}/${language}`;
    const samePrinting = await read(collectorUrl);
    if (!samePrinting.ok) return fallback("temporary", [samePrinting.error]);
    if (samePrinting.data !== null) {
      const candidate = samePrinting.data;
      if (!isCard(candidate) || !matchesIdentity(original, candidate, language) ||
          candidate.set.toLowerCase() !== original.set.toLowerCase() ||
          candidate.collector_number !== original.collector_number) return invalid(collectorUrl);
      return resolved(candidate, "same-printing");
    }

    // Search only by exact Oracle identity. User/card names never become query syntax.
    if (!original.oracle_id || !UUID.test(original.oracle_id)) return fallback("unavailable");
    const params = new URLSearchParams({
      q: `oracleid:${original.oracle_id} lang:${language}`,
      include_multilingual: "true",
      unique: "prints",
      order: "released",
      dir: "desc",
    });
    const searchUrl = `https://api.scryfall.com/cards/search?${params}`;
    const search = await read(searchUrl);
    if (!search.ok) return fallback("temporary", [search.error]);
    if (search.data === null) return fallback("unavailable");
    const cards = (search.data as { data?: unknown })?.data;
    if (!Array.isArray(cards) || !cards.every(isCard)) return invalid(searchUrl);
    const candidate = cards.find((card) => matchesIdentity(original, card, language));
    // A non-empty response for this exact query with the wrong identity is a bad response.
    if (!candidate && cards.length > 0) return invalid(searchUrl);
    return candidate ? resolved(candidate, "oracle-printing") : fallback("unavailable");
  };

  const resolve = async (original: ScryfallCard, locale: AppLocale): Promise<LocalizedCardResult> => {
    const language = toScryfallLanguage(locale);
    if (original.lang === language) return { card: original, status: "ready", printing: "original", errors: [] };
    const key = `${original.id}:${language}`;
    const cached = entries.get(key);
    if (cached && cached.expiresAt > now()) {
      entries.delete(key);
      entries.set(key, cached);
      return cached.result.printing === "original" ? { ...cached.result, card: original } : cached.result;
    }
    entries.delete(key);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const promise = lookup(original, language).then((result) => {
      // Transient failures get only a short retry cooldown, never a missing-language entry.
      const ttl = result.status === "ready" ? positiveTtlMs : result.status === "unavailable" ? missingTtlMs :
        Math.max(transientTtlMs, ...result.errors.map((error) => error.retryAfterMs ?? 0));
      entries.set(key, { result, expiresAt: now() + ttl });
      for (const [entryKey, entry] of entries) if (entry.expiresAt <= now()) entries.delete(entryKey);
      while (entries.size > Math.max(0, maxEntries)) entries.delete(entries.keys().next().value!);
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };

  return { resolve };
}

const localizedCards = createLocalizedCardResolver();

/** Call only for identities the viewer is permitted to see. Locale is explicit for SSR isolation. */
export async function getLocalizedCard(scryfallId: string, locale: AppLocale) {
  const original = await getCard(scryfallId);
  if (!original.card) return { ...original, original: null };
  const result = await localizedCards.resolve(original.card, locale);
  return { card: result.card, original: original.card, errors: result.errors };
}
