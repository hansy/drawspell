import { describe, expect, it } from "vitest";
import { languageRegistry, toScryfallLanguage } from "../locales";
import { canonicalPageUrl, pageUrlForLocale, readLocalePath } from "../urls";

const routes = ["/", "/rooms/abc", "/rooms/a.b", "/docs", "/privacy", "/tos", "/auth/login", "/developers", "/developer", "/developer/login", "/discord/install", "/missing"];

describe("locale URL contract", () => {
  it.each(languageRegistry)("round trips every page in $locale without changing English", ({ locale }) => {
    for (const path of routes) {
      const original = new URL(`${path}?gt=a%2Fb&st=c%2Bd&invite=e%3Df#details`, "https://drawspell.space");
      const localized = pageUrlForLocale(original, locale);
      expect(localized.pathname).toBe(locale === "en" ? path : `/${locale}${path === "/" ? "" : path}`);
      expect(pageUrlForLocale(localized, "en").href).toBe(original.href);
      expect(localized.search).toBe(original.search);
      expect(localized.hash).toBe(original.hash);
      expect(original.pathname).toBe(path);
    }
  });

  it("replaces prefixes and canonicalizes English and supported casing", () => {
    expect(pageUrlForLocale(new URL("https://drawspell.space/en/docs"), "en").pathname).toBe("/docs");
    expect(pageUrlForLocale(new URL("https://drawspell.space/ZH-hANT/docs"), "zh-Hans").pathname).toBe("/zh-Hans/docs");
    expect(readLocalePath("/esoteric/docs").explicit).toBe(false);
    expect(readLocalePath("/xx/docs").pathname).toBe("/xx/docs");
  });

  it.each(["/api/auth/callback", "/api/v1/rooms", "/_serverFn/x", "/_server/x", "/__tsr/x", "/ws/room", "/assets/x.js", "/robots.txt", "/sitemap.xml", "/favicon.svg", "/es/api/auth/callback"])("does not localize protocol/static path %s", (path) => {
    const url = new URL(path, "https://drawspell.space");
    expect(pageUrlForLocale(url, "fr").href).toBe(url.href);
  });

  it("retains encoded route segments and removes secrets from canonical URLs", () => {
    const url = new URL("https://drawspell.space/es/rooms/a%2Fb?gt=secret&invite=secret#hand");
    expect(pageUrlForLocale(url, "de").pathname).toBe("/de/rooms/a%2Fb");
    expect(canonicalPageUrl(url, "fr").href).toBe("https://drawspell.space/fr/rooms/a%2Fb");
    expect(url.search).toContain("secret");
  });

  it("maps Chinese to Scryfall without leaking its codes into app locales", () => {
    expect(toScryfallLanguage("zh-Hans")).toBe("zhs");
    expect(toScryfallLanguage("zh-Hant")).toBe("zht");
    expect(languageRegistry).toHaveLength(11);
    for (const { locale } of languageRegistry) expect(Intl.getCanonicalLocales(locale)).toEqual([locale]);
  });
});
