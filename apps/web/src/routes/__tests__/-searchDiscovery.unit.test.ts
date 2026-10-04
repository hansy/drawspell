import { readFileSync } from "node:fs";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { ORIGINS } from "@mtg/shared/constants/hosts";
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
    "adds a homepage canonical only in production, with no inherited canonical in %s",
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
          environment === "production" && pathname === "/"
            ? [{ rel: "canonical", href: "https://drawspell.space/" }]
            : [],
        );
      }
    },
  );

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
      "https://drawspell.space/privacy",
      "https://drawspell.space/tos",
    ]);
    for (const location of locations) {
      const url = new URL(location ?? "");
      expect(url.origin).toBe(ORIGINS.production.web);
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      const router = await loadRoute(url.pathname);
      const pageMatch = router.state.matches.at(-1);
      expect(pageMatch?.status).toBe("success");
      expect(pageMatch?.routeId).toBe(url.pathname);
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
