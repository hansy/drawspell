import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { languageRegistry } from "../../src/i18n/locales";
import { pageUrlForLocale } from "../../src/i18n/urls";

// Run against `bun run build:production && bun run serve --host 127.0.0.1 --port 4173`.
const origin = process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors: string[] = [];
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.route("**/*posthog*/**", (route) => route.abort());
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|Minified React error/i.test(message.text())) errors.push(message.text());
  });
  for (const { locale } of languageRegistry) {
    for (const path of ["/", "/docs", "/privacy", "/tos", "/auth/login", "/missing-i18n-page"]) {
      const url = pageUrlForLocale(new URL(path, origin), locale);
      const response = await page.goto(url.href);
      assert.equal(response?.status(), path.startsWith("/missing") ? 404 : 200, url.href);
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      const selector = page.locator("header select");
      assert.equal(await selector.inputValue(), locale);
      assert.equal(await selector.locator("option").count(), 11);
      assert((await page.locator("h1").innerText()).trim().length > 0);
      if (["/", "/docs", "/privacy", "/tos"].includes(path)) {
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), pageUrlForLocale(new URL(path, "https://drawspell.space"), locale).href);
        assert.equal(await page.locator('link[hreflang]').count(), 12);
      } else {
        assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
        assert.match(await page.locator('meta[name="robots"]').getAttribute("content") ?? "", /noindex/);
      }
    }
    console.log(`PASS ${locale}: direct public/login/404 entry and metadata`);
  }
  await page.goto(`${origin}/docs?invite=example&gt=private&st=watch#authentication`);
  for (const locale of ["es", "zh-Hant", "en"] as const) {
    await page.locator("header select").selectOption(locale);
    await page.waitForURL((url) => url.pathname === (locale === "en" ? "/docs" : `/${locale}/docs`));
    const url = new URL(page.url());
    assert.equal(url.search, "?invite=example&gt=private&st=watch");
    assert.equal(url.hash, "#authentication");
    assert.equal(await page.locator("html").getAttribute("lang"), locale);
  }
  console.log("PASS language switching preserves query, fragment and English URLs");
  await page.goto(`${origin}/es/docs`);
  await page.locator('header a[href="/es"]').click();
  await page.waitForURL(`${origin}/es`);
  await page.goBack();
  await page.waitForURL(`${origin}/es/docs`);
  assert.equal(new URL(page.url()).pathname, "/es/docs");
  assert.equal(await page.locator("html").getAttribute("lang"), "es");
  console.log("PASS internal navigation and browser back preserve locale");
  for (const [from, to] of [["/en/docs?invite=x", "/docs?invite=x"], ["/ES/docs", "/es/docs"], ["/ZH-hans", "/zh-Hans"]]) {
    const response = await context.request.get(`${origin}${from}`, { maxRedirects: 0 });
    assert.equal(response.status(), 308, from);
    const location = new URL(response.headers().location);
    assert.equal(location.pathname + location.search, to);
  }
  for (const path of ["/es/api/auth/session", "/fr/_serverFn/missing", "/de/assets/missing.js", "/ja/sitemap.xml"]) {
    assert.equal((await context.request.get(`${origin}${path}`)).status(), 404);
  }
  await page.goto(`${origin}/es/rooms/i18n-smoke?gt=private&st=watch&invite=personal#cards`);
  await page.locator("select").first().selectOption("ja");
  await page.waitForURL("**/ja/rooms/i18n-smoke?gt=private&st=watch&invite=personal#cards");
  assert.equal(await page.locator("html").getAttribute("lang"), "ja");
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/de`);
  assert(await page.locator("header select").isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, [], "No hydration or browser errors expected");
  console.log("PASS canonicalization, excluded protocols, room entry switch and mobile selector; no hydration errors");
  await context.close();
} finally {
  await browser.close();
}
