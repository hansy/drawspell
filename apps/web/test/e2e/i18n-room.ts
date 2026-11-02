import assert from "node:assert/strict";
import { chromium, type Page } from "playwright-core";

// Requires the local web and room Workers (`bun run dev` + `bun run dev:server`).
const origin = process.env.E2E_WEB_ORIGIN ?? "https://ds.localhost";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(60_000);
page.on("pageerror", (error) => console.log("BROWSER ERROR", error.message));
const storePath = "/src/store/gameStore.ts";
const cardId = `i18n-${crypto.randomUUID()}`;
async function state(target: Page) {
  return target.evaluate(async (path) => {
    const s = (await import(path)).useGameStore.getState();
    return { player: s.myPlayerId, players: Object.keys(s.players).sort(), cards: s.cards, zones: s.zones, room: s.sessionId };
  }, storePath);
}
async function waitForPlayer(target: Page) {
  await target.evaluate(async (path) => {
    (window as any).__i18nStore = (await import(path)).useGameStore;
  }, storePath);
  await target.waitForFunction(() => {
    const s = (window as any).__i18nStore.getState();
    return Boolean(s.myPlayerId && s.players[s.myPlayerId] && Object.keys(s.zones).length);
  }, undefined, { timeout: 45_000 });
}
try {
  await page.goto(origin);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Start a game", exact: true }).click();
  await page.waitForURL("**/rooms/*");
  await page.getByRole("textbox", { name: "Username", exact: true }).fill("I18n host");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await waitForPlayer(page);
  const roomPath = new URL(page.url()).pathname;
  const roomId = roomPath.split("/").at(-1)!;
  const initial = await state(page);
  assert(initial.player);
  const source = await fetch("https://api.scryfall.com/cards/m21/1/en", { headers: { Accept: "application/json", "User-Agent": "Drawspell-i18n-smoke/1.0" } }).then((response) => response.json());
  const french = await fetch("https://api.scryfall.com/cards/m21/1/fr", { headers: { Accept: "application/json", "User-Agent": "Drawspell-i18n-smoke/1.0" } }).then((response) => response.json());
  await page.evaluate(async ({ path, source, cardId }) => {
    const s = (await import(path)).useGameStore.getState();
    const zone = Object.values(s.zones).find((zone: any) => zone.ownerId === s.myPlayerId && zone.type === "battlefield") as any;
    if (!zone) throw new Error("Missing battlefield");
    s.addCard({ id: cardId, name: source.name, scryfallId: source.id, ownerId: s.myPlayerId, controllerId: s.myPlayerId, zoneId: zone.id, tapped: false, faceDown: false, position: { x: 0.5, y: 0.5 }, rotation: 0, counters: [] });
  }, { path: storePath, source, cardId });
  await page.locator(`[data-card-id="${cardId}"] img`).first().waitFor();
  const tokensBefore = await page.evaluate((id) => localStorage.getItem(`drawspell:roomTokens:${id}`), roomId);
  assert(tokensBefore);
  const cardBefore = (await state(page)).cards[cardId];
  // This is the actual room menu's language selector, not a URL-only reload.
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.locator("select").selectOption("fr");
  await page.waitForURL(`**/fr${roomPath}`);
  await waitForPlayer(page);
  const after = await state(page);
  assert.equal(after.player, initial.player);
  assert.deepEqual(after.players, initial.players);
  assert.deepEqual(after.cards[cardId], cardBefore);
  assert.equal(await page.evaluate((id) => localStorage.getItem(`drawspell:roomTokens:${id}`), roomId), tokensBefore);
  await page.waitForFunction(({ id, url }) => document.querySelector(`[data-card-id="${id}"] img`)?.getAttribute("src") === url, { id: cardId, url: french.image_uris.normal }, { timeout: 45_000 });
  console.log("PASS room menu switches to French, resumes the same player/cards/tokens and displays French artwork");
  // Verify the inverse using a document navigation, matching the selector's semantics.
  await page.goto(`${origin}${roomPath}`);
  await waitForPlayer(page);
  const english = await state(page);
  assert.equal(english.player, initial.player);
  assert.deepEqual(english.cards[cardId], cardBefore);
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  console.log("PASS returning to the original English room URL preserves canonical gameplay state");
} catch (error) {
  console.log("FAILED AT", new URL(page.url()).pathname, (await page.locator("body").innerText()).slice(0, 1500));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
