// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getLocale, deLocalizeUrl, localizeUrl } from "@/paraglide/runtime.js";
import { m } from "@/paraglide/messages.js";
import { languageRegistry } from "../locales";
import { pageUrlForLocale } from "../urls";

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: async (request: Request) => {
      const before = getLocale();
      await new Promise((resolve) => setTimeout(resolve, before === "es" ? 10 : 1));
      return Response.json({ before, after: getLocale(), title: m.not_found_title(), url: request.url });
    },
  },
}));
import server from "@/server";

describe("Paraglide request and URL integration", () => {
  it("isolates concurrent SSR requests and preserves the localized URL for Start", async () => {
    const responses = await Promise.all(Array.from({ length: 3 }, () => languageRegistry).flat().map(async ({ locale }) => {
      const url = pageUrlForLocale(new URL("https://drawspell.space/rooms/room%2Fid?gt=private&st=watch&invite=personal"), locale);
      const response = await server.fetch(new Request(url));
      return { locale, url, body: await response.json() as { before: string; after: string; title: string; url: string } };
    }));
    for (const { locale, url, body } of responses) {
      expect(body.before).toBe(locale);
      expect(body.after).toBe(locale);
      expect(body.title).toBe(m.not_found_title({}, { locale }));
      expect(body.url).toBe(url.href);
    }
  });

  it("canonicalizes explicit English/casing without losing invitation credentials", async () => {
    for (const [from, to] of [["/en/docs?invite=x", "/docs?invite=x"], ["/ZH-hans/rooms/id?gt=x", "/zh-Hans/rooms/id?gt=x"]]) {
      const response = await server.fetch(new Request(`https://drawspell.space${from}`));
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(`https://drawspell.space${to}`);
    }
  });

  it("does not create localized protocol or static aliases", async () => {
    for (const path of ["/es/api/auth/sign-in/magic-link", "/fr/_serverFn/function", "/de/assets/main.js", "/ja/sitemap.xml"]) {
      expect((await server.fetch(new Request(`https://drawspell.space${path}`))).status).toBe(404);
    }
  });

  it("round trips every accessible page in every locale using the real generated runtime", () => {
    for (const { locale } of languageRegistry) {
      for (const path of ["/", "/docs", "/privacy", "/tos", "/auth/login", "/developers", "/developer", "/developer/login", "/discord/install", "/rooms/room%2Fid", "/missing"]) {
        const url = new URL(`${path}?gt=private#section`, "https://drawspell.space");
        const translated = localizeUrl(url, { locale });
        expect(translated.href).toBe(pageUrlForLocale(url, locale).href);
        expect(deLocalizeUrl(translated).href).toBe(url.href);
      }
    }
  });
});

it("carries locale across unprefixed server function transport without localizing the protocol URL", async () => {
  const url = "https://drawspell.space/_serverFn/function-id";
  const response = await server.fetch(new Request(url, { headers: { "X-Drawspell-Locale": "ja" } }));
  expect(await response.json()).toMatchObject({ before: "ja", after: "ja", url });
  const api = await server.fetch(new Request("https://drawspell.space/api/v1/rooms", { headers: { "X-Drawspell-Locale": "ja" } }));
  expect(await api.json()).toMatchObject({ before: "en", after: "en" });
});
