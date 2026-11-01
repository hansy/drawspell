import { describe, it, expect, vi } from "vitest";
import { ScryfallCard } from "@/types/scryfall";
import {
  buildTokenSearchQuery,
  buildTokenSearchUrl,
  createDebouncedTokenSearch,
  MIN_TOKEN_SEARCH_CHARS,
  searchScryfallTokens,
} from "../scryfallTokens";

const mockTokenCard: ScryfallCard = {
  object: "card",
  id: "token-1",
  lang: "en",
  name: "Mock Token",
  layout: "token",
  uri: "https://api.scryfall.com/cards/token-1",
  scryfall_uri: "https://scryfall.com/card/token-1",
  type_line: "Token Creature — Mock",
  color_identity: [],
  keywords: [],
  legalities: {} as any,
  games: ["paper"],
  set: "tset",
  set_name: "Test Set",
  collector_number: "1",
  rarity: "common",
  prices: {},
  related_uris: {},
};

const mockListResponse = {
  object: "list" as const,
  total_cards: 1,
  has_more: false,
  data: [mockTokenCard],
};

describe("buildTokenSearchQuery", () => {
  it("searches both names and type lines for plain text", () => {
    expect(buildTokenSearchQuery("dungeon")).toBe(
      '(type:token OR type:emblem OR set_type:token) (game:paper) (name:"dungeon" OR type:"dungeon")'
    );
  });

  it("preserves explicit Scryfall filters", () => {
    expect(buildTokenSearchQuery("type:dungeon")).toBe(
      "(type:token OR type:emblem OR set_type:token) (game:paper) type:dungeon"
    );
  });
});

describe("buildTokenSearchUrl", () => {
  it("includes tokens, emblems, and token-set helpers", () => {
    const url = buildTokenSearchUrl("soldier");
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/cards/search");
    expect(parsed.searchParams.get("unique")).toBe("cards");
    expect(parsed.searchParams.get("q")).toBe(
      '(type:token OR type:emblem OR set_type:token) (game:paper) (name:"soldier" OR type:"soldier")'
    );
  });
});

describe("searchScryfallTokens", () => {
  it("skips calls when under the minimum length", async () => {
    const fetchMock = vi.fn();
    const result = await searchScryfallTokens(
      "a".repeat(MIN_TOKEN_SEARCH_CHARS - 1),
      {
        fetchImpl: fetchMock as any,
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

describe("createDebouncedTokenSearch", () => {
  it("debounces and only sends the latest request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockListResponse),
    });

    const { search } = createDebouncedTokenSearch({
      fetchImpl: fetchMock as any,
      debounceMs: 10,
    });

    const first = search("sold");
    const second = search("soldier");

    // First call should be superseded immediately
    await expect(first).rejects.toThrowError(/superseded/);

    // Wait for debounce window to elapse and the latest request to fire.
    await new Promise((resolve) => setTimeout(resolve, 15));

    await expect(second).resolves.toEqual(mockListResponse);
    await expect(first).rejects.toThrowError(/superseded/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(new URL(calledUrl).searchParams.get("q")).toBe(
      '(type:token OR type:emblem OR set_type:token) (game:paper) (name:"soldier" OR type:"soldier")'
    );
  });

  it("cancels a pending request cleanly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockListResponse),
    });

    const { search, cancel } = createDebouncedTokenSearch({
      fetchImpl: fetchMock as any,
      debounceMs: 50,
    });

    const pending = search("angel");
    cancel();

    await expect(pending).rejects.toThrowError(/cancelled/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("localized token search", () => {
  it("uses BCP 47 app locale mapping and keeps English requests unchanged", () => {
    const url = new URL(buildTokenSearchUrl("天使", { locale: "zh-Hant" }));
    expect(url.searchParams.get("q")).toContain("lang:zht");
    expect(url.searchParams.get("include_multilingual")).toBe("true");
    expect(new URL(buildTokenSearchUrl("angel", { locale: "en" })).searchParams.has("include_multilingual")).toBe(false);
  });

  it("falls back to original token search when no translated printing is found", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockListResponse)));
    await expect(searchScryfallTokens("soldier", { locale: "fr", fetchImpl })).resolves.toEqual(mockListResponse);
    expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get("q")).toContain("lang:fr");
    expect(new URL(fetchImpl.mock.calls[1][0]).searchParams.get("q")).not.toContain("lang:");
  });

  it("does not mistake a rate limit or outage for missing token translations", async () => {
    for (const status of [429, 503]) {
      const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status }));
      await expect(searchScryfallTokens("soldier", { locale: "de", fetchImpl })).rejects.toThrow(String(status));
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
});
