import { describe, expect, it, vi } from "vitest";
import type { ScryfallCard } from "@/types/scryfall";
import { createLocalizedCardResolver } from "../localizedCards";
import { localizedCardPresentation } from "../localizedPresentation";

const oracle = "11111111-2222-3333-4444-555555555555";
const source = {
  object: "card", id: "original-en", oracle_id: oracle, lang: "en", name: "Test Card",
  layout: "normal", set: "tst", collector_number: "7", type_line: "Creature",
  oracle_text: "Draw a card.", image_uris: { normal: "english.jpg", art_crop: "art.jpg" },
} as ScryfallCard;
const translated = { ...source, id: "translated-fr", lang: "fr", printed_name: "Carte test", printed_type_line: "Créature", printed_text: "Piochez une carte.", image_uris: { normal: "french.jpg" } };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const setup = (responses: (Response | Error)[], options: Parameters<typeof createLocalizedCardResolver>[0] = {}) => {
  const request = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
    const response = responses.shift();
    if (!response) throw new Error("No fixture response");
    if (response instanceof Error) throw response;
    return response;
  });
  const onResolved = vi.fn(async (_cards: ScryfallCard[]) => {});
  return { resolver: createLocalizedCardResolver({ request, onResolved, ...options }), request, onResolved };
};

describe("Scryfall viewer-local translation resolver", () => {
  it("uses original-language data without a request or a shared-state write", async () => {
    const { resolver, request, onResolved } = setup([]);
    const result = await resolver.resolve(source, "en");
    expect(result.card).toBe(source);
    expect(result.status).toBe("ready");
    expect(request).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("deduplicates same-print lookups and caches by source ID and language separately", async () => {
    const before = structuredClone(source);
    const spanish = { ...translated, id: "translated-es", lang: "es" };
    const { resolver, request, onResolved } = setup([json(translated), json(spanish)]);
    const [a, b] = await Promise.all([resolver.resolve(source, "fr"), resolver.resolve(source, "fr")]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ printing: "same-printing", status: "ready", card: translated });
    expect(request.mock.calls[0]).toEqual(["https://api.scryfall.com/cards/tst/7/fr", { headers: { Accept: "application/json" } }]);
    expect(onResolved).toHaveBeenCalledWith([translated]);
    await resolver.resolve(source, "fr");
    expect(request).toHaveBeenCalledTimes(1);
    expect((await resolver.resolve(source, "es")).card).toEqual(spanish);
    expect(source).toEqual(before);
  });

  it("encodes collector segments and maps Chinese to Scryfall codes", async () => {
    const original = { ...source, collector_number: "7★/A" };
    const zh = { ...original, id: "translated-zh", lang: "zhs" };
    const { resolver, request } = setup([json(zh)]);
    await resolver.resolve(original, "zh-Hans");
    expect(request.mock.calls[0]?.[0]).toBe("https://api.scryfall.com/cards/tst/7%E2%98%85%2FA/zhs");
  });

  it("falls back deterministically to another printing of the exact Oracle identity", async () => {
    const fallback = { ...translated, id: "other-print", set: "old", collector_number: "99" };
    const { resolver, request } = setup([json({}, 404), json({ data: [fallback] })]);
    const result = await resolver.resolve(source, "fr");
    expect(result.printing).toBe("oracle-printing");
    expect(result.card).toEqual(fallback);
    const search = new URL(String(request.mock.calls[1]![0]));
    expect(search.searchParams.get("q")).toBe(`oracleid:${oracle} lang:fr`);
    expect(search.searchParams.get("order")).toBe("released");
    expect(search.searchParams.get("dir")).toBe("desc");
    expect(search.searchParams.get("include_multilingual")).toBe("true");
  });

  it("negative-caches unavailable printings for a bounded time", async () => {
    let time = 0;
    const { resolver, request } = setup([json({}, 404), json({}, 404), json(translated)], { now: () => time, missingTtlMs: 100 });
    expect((await resolver.resolve(source, "fr")).status).toBe("unavailable");
    expect((await resolver.resolve(source, "fr")).card).toBe(source);
    expect(request).toHaveBeenCalledTimes(2);
    time = 101;
    expect((await resolver.resolve(source, "fr")).status).toBe("ready");
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([new Error("offline"), json({}, 500), json({}, 429)])("retries transient failure after cooldown rather than recording a missing translation: %s", async (failure) => {
    let time = 0;
    const { resolver, request } = setup([failure, json(translated)], { now: () => time, transientTtlMs: 100 });
    expect((await resolver.resolve(source, "fr")).status).toBe("temporary");
    await resolver.resolve(source, "fr");
    expect(request).toHaveBeenCalledTimes(1);
    time = 101;
    expect((await resolver.resolve(source, "fr")).status).toBe("ready");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("respects Retry-After before attempting translation again", async () => {
    let time = 0;
    const { resolver, request } = setup([new Response("{}", { status: 429, headers: { "Retry-After": "60" } }), json(translated)], { now: () => time });
    expect((await resolver.resolve(source, "fr")).status).toBe("temporary");
    time = 59_000;
    await resolver.resolve(source, "fr");
    expect(request).toHaveBeenCalledTimes(1);
    time = 60_001;
    expect((await resolver.resolve(source, "fr")).status).toBe("ready");
  });

  it.each([
    { ...translated, oracle_id: "wrong" },
    { ...translated, lang: "de" },
    { ...translated, layout: "transform" },
    { ...translated, collector_number: "different" },
    { ...translated, card_faces: [{ name: "other" }] },
    {},
  ])("rejects an unrelated/malformed localized printing", async (bad) => {
    const { resolver, onResolved } = setup([json(bad)]);
    expect(await resolver.resolve(source, "fr")).toMatchObject({ card: source, status: "temporary" });
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("does not treat token names or invalid Oracle IDs as search syntax", async () => {
    const { resolver, request } = setup([json({}, 404)]);
    const result = await resolver.resolve({ ...source, oracle_id: "bad OR *" }, "fr");
    expect(result).toMatchObject({ card: { id: source.id }, status: "unavailable" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("bounds and expires successful resolution entries", async () => {
    let time = 0;
    const { resolver, request } = setup([json(translated), json({ ...translated, id: "es", lang: "es" }), json(translated), json(translated)], { maxEntries: 1, now: () => time, positiveTtlMs: 100 });
    await resolver.resolve(source, "fr");
    await resolver.resolve(source, "es");
    await resolver.resolve(source, "fr");
    expect(request).toHaveBeenCalledTimes(3);
    time = 101;
    await resolver.resolve(source, "fr");
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("preserves face ordering and falls back field by field while keeping Oracle rules", () => {
    const original = { ...source, card_faces: [
      { name: "Front", type_line: "Creature", oracle_text: "Front rules", image_uris: { normal: "front.jpg" } },
      { name: "Back", type_line: "Land", oracle_text: "Back rules", image_uris: { normal: "back.jpg" } },
    ] };
    const localized = { ...original, lang: "fr", card_faces: [
      { ...original.card_faces[0], printed_name: "Recto", printed_text: "Règles du recto", image_uris: { normal: "recto.jpg" } },
      { name: "Back", printed_type_line: "Terrain" },
    ] };
    expect(localizedCardPresentation(original, localized, 0)).toMatchObject({ name: "Recto", printedText: "Règles du recto", oracleText: "Front rules", imageUris: { normal: "recto.jpg" } });
    expect(localizedCardPresentation(original, localized, 1)).toMatchObject({ name: "Back", typeLine: "Terrain", printedText: "Back rules", oracleText: "Back rules", imageUris: { normal: "back.jpg" } });
  });

  it("uses the combined translated image for split/adventure cards without face images", () => {
    const original = { ...source, card_faces: [{ name: "Left" }, { name: "Right" }] };
    const localized = { ...original, lang: "fr", image_uris: { normal: "split-fr.jpg" } };
    expect(localizedCardPresentation(original, localized, 1).imageUris.normal).toBe("split-fr.jpg");
  });

});
