import { readFileSync } from "node:fs";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { ORIGINS } from "@mtg/shared/constants/hosts";
import { languageRegistry } from "../../i18n/locales";
import { pageUrlForLocale } from "../../i18n/urls";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

const loadRoute = async (path: string) => {
  const { routeTree } = await import("../../routeTree.gen");
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: true,
  });
  await router.load();
  return router;
};

describe("search discovery", () => {
  it.each(["production", "staging", "development"])(
    "adds public-page canonicals only in production without inheriting them into rooms in %s",
    async (environment) => {
      vi.resetModules();
      vi.stubEnv("VITE_ENV", environment);

      for (const path of [
        "/",
        "/?invite=example",
        "/privacy",
        "/tos",
        "/rooms/example",
      ]) {
        const router = await loadRoute(path);
        const pathname = path.split("?")[0];
        expect(router.state.matches.at(-1)?.routeId).toBe(
          pathname === "/rooms/example" ? "/rooms/$sessionId" : pathname,
        );
        expect(
          router.state.matches.every((match) => match.status === "success"),
        ).toBe(true);
        const canonicals = router.state.matches
          .flatMap((match) => match.links ?? [])
          .filter((link) => link?.rel === "canonical");
        expect(canonicals).toEqual(
          environment === "production" && pathname !== "/rooms/example"
            ? [{ rel: "canonical", href: new URL(pathname, "https://drawspell.space").href }]
            : [],
        );
      }
    },
  );

  it("does not publish homepage canonicals on unknown paths", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ENV", "production");
    for (const path of ["/missing", "/docs/missing"]) {
      const router = await loadRoute(path);
      const links = router.state.matches.flatMap((match) => match.links ?? []);
      expect(links.filter((link) => link?.rel === "canonical")).toEqual([]);
      expect(router.state.matches.flatMap((match) => match.meta ?? []).some((meta) => meta?.name === "robots" && meta.content?.includes("noindex"))).toBe(true);
    }
  });

  it("publishes a valid sitemap containing only real public page routes on the trusted production origin", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ENV", "production");
    const xml = readFileSync("public/sitemap.xml", "utf8");
    const document = new DOMParser().parseFromString(xml, "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    expect(document.documentElement.localName).toBe("urlset");
    expect(document.documentElement.namespaceURI).toBe(
      "http://www.sitemaps.org/schemas/sitemap/0.9",
    );
    const locations = Array.from(
      document.querySelectorAll("url > loc"),
      (element) => element.textContent,
    );
    expect(locations).toEqual([
      "https://drawspell.space/",
      "https://drawspell.space/docs",
      "https://drawspell.space/privacy",
      "https://drawspell.space/tos",
    ].flatMap((url) => languageRegistry.map(({ locale }) => pageUrlForLocale(new URL(url), locale).href)));
    for (const location of locations) {
      const url = new URL(location ?? "");
      expect(url.origin).toBe(ORIGINS.production.web);
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      const { readLocalePath } = await import("../../i18n/urls");
      const pathname = readLocalePath(url.pathname).pathname;
      const router = await loadRoute(pathname);
      const pageMatch = router.state.matches.at(-1);
      expect(pageMatch?.status).toBe("success");
      expect(pageMatch?.routeId).toBe(pathname);
      const robots = router.state.matches
        .flatMap((match) => match.meta ?? [])
        .filter((meta) => meta?.name === "robots");
      expect(robots.some((meta) => meta?.content?.includes("noindex"))).toBe(false);
    }
  });

  it("references the production sitemap without changing the robots policy", () => {
    const robots = readFileSync("public/robots.txt", "utf8");
    expect(robots).toBe(
      "# https://www.robotstxt.org/robotstxt.html\nUser-agent: *\nDisallow:\n\nSitemap: https://drawspell.space/sitemap.xml\n",
    );
  });
});
