import { describe, expect, it, vi } from "vitest";
import { createScryfallRequest } from "../scryfallRequest";
import { parseRetryAfterMs } from "../scryfallErrors";

function setup(responses: (Response | Error)[] = []) {
  let time = 1_000;
  const starts: number[] = [];
  const fetchImpl = vi.fn(async () => {
    starts.push(time);
    const result = responses.shift() ?? new Response("{}");
    if (result instanceof Error) throw result;
    return result;
  });
  const request = createScryfallRequest({
    fetchImpl,
    spacingMs: 120,
    now: () => time,
    sleep: async (ms) => { time += ms; },
  });
  return { request, starts, fetchImpl };
}

describe("shared Scryfall request queue", () => {
  it("spaces concurrent cache, collection, import, token and translation requests", async () => {
    const { request, starts } = setup();
    await Promise.all(Array.from({ length: 100 }, (_, i) => request(`https://api.scryfall.com/cards/${i}`)));
    expect(starts).toHaveLength(100);
    expect(starts.slice(1).every((start, i) => start - starts[i] >= 120)).toBe(true);
  });

  it("holds all queued callers after a 429 using Retry-After", async () => {
    const { request, starts } = setup([new Response("{}", { status: 429, headers: { "Retry-After": "3" } })]);
    await Promise.all([request("https://api.scryfall.com/cards/a"), request("https://api.scryfall.com/cards/b")]);
    expect(starts).toEqual([1_000, 4_000]);
  });

  it("survives failures and skips aborted queued work", async () => {
    const { request, starts } = setup([new Error("offline")]);
    const controller = new AbortController();
    controller.abort();
    const results = await Promise.allSettled([
      request("https://api.scryfall.com/cards/a"),
      request("https://api.scryfall.com/cards/b", { signal: controller.signal }),
      request("https://api.scryfall.com/cards/c"),
    ]);
    expect(results.map(({ status }) => status)).toEqual(["rejected", "rejected", "fulfilled"]);
    expect(starts).toEqual([1_000, 1_120]);
  });

  it("parses numeric and HTTP-date retry delays", () => {
    const date = Date.parse("2026-11-01T12:00:00Z");
    expect(parseRetryAfterMs(new Response("", { headers: { "Retry-After": "2" } }), date)).toBe(2_000);
    expect(parseRetryAfterMs(new Response("", { headers: { "Retry-After": "Sun, 01 Nov 2026 12:00:05 GMT" } }), date)).toBe(5_000);
    expect(parseRetryAfterMs(new Response("", { headers: { "Retry-After": "bad" } }), date)).toBeUndefined();
  });
});
