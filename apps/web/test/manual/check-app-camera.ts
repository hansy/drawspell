import assert from "node:assert/strict";
import { chromium, type Page, type Locator } from "playwright-core";

// Run against `VITE_ENV=development bun run dev:all`. Uses isolated browser
// identities and local rooms; all mutations go through the real intent server.
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors: string[] = [];
async function finishJoin(page: Page, name: string) {
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page
    .getByRole("textbox", { name: "Username", exact: true })
    .fill(name)
    .catch(async (error) => {
      console.log(
        "Join failure",
        page.url(),
        (await page.locator("body").innerText()).slice(0, 1800),
        errors,
      );
      throw error;
    });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("[data-battlefield-camera]").first().waitFor();
  await page.waitForFunction(async () => {
    const path = "/src/store/gameStore.ts";
    const { useGameStore } = await import(path);
    const s = useGameStore.getState();
    return s.players[s.myPlayerId] && Object.keys(s.zones).length >= 6;
  });
}
try {
  const ownerContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 1000 },
  });
  const owner = await ownerContext.newPage();
  owner.on("pageerror", (error) =>
    console.log("Owner boot error", error.message),
  );
  await owner.goto("https://ds.localhost");
  await owner.waitForFunction(
    () => {
      const button = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Start a game"),
      );
      return (
        button &&
        Object.keys(button).some((key) => key.startsWith("__reactProps"))
      );
    },
    undefined,
    { timeout: 20000 },
  );
  await owner
    .getByRole("button", { name: "Start a game", exact: true })
    .click();
  await finishJoin(owner, "CameraOwner");
  console.log("Joined owner", owner.url());
  const invite = await owner.evaluate(async () => {
    const path = "/src/partykit/shareLinksClient.ts";
    const { requestShareLinks } = await import(path);
    return (await requestShareLinks()).playerInviteUrl;
  });
  const viewerContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1150, height: 900 },
  });
  const viewer = await viewerContext.newPage();
  await viewer.goto(invite);
  await finishJoin(viewer, "CameraViewer");
  console.log("Joined second viewer");
  // Pan the empty battlefield before its first placement. The second viewer
  // must adopt this starting view without changing either client's card data.
  const emptyBattlefield = await owner.evaluate(async () => {
    const path = "/src/store/gameStore.ts";
    const s = (await import(path)).useGameStore.getState();
    const zone = (Object.values(s.zones) as any[]).find(
      (z) => z.type === "battlefield" && z.ownerId === s.myPlayerId,
    );
    if (!zone)
      throw Error(
        JSON.stringify({
          id: s.myPlayerId,
          players: Object.keys(s.players),
          zones: s.zones,
        }),
      );
    return zone.id;
  });
  const emptyBox = await owner
    .locator(`[data-zone-id="${emptyBattlefield}"]`)
    .boundingBox();
  assert(emptyBox);
  await owner.mouse.move(
    emptyBox.x + emptyBox.width / 2,
    emptyBox.y + emptyBox.height / 2,
  );
  await owner.mouse.down({ button: "right" });
  await owner.mouse.move(
    emptyBox.x + emptyBox.width / 2 + 120,
    emptyBox.y + emptyBox.height / 2 + 60,
    { steps: 8 },
  );
  await owner.mouse.up({ button: "right" });
  await owner.waitForTimeout(150);
  const sample = await owner.evaluate(async () => {
    const path = "/src/store/gameStore.ts";
    const { useGameStore } = await import(path);
    const s = useGameStore.getState();
    const playerId = s.myPlayerId;
    if (!playerId)
      throw Error(
        `Missing live owner: ${JSON.stringify({
          players: Object.keys(s.players),
          resources: performance
            .getEntriesByType("resource")
            .map((e) => e.name)
            .filter((n) => n.includes("gameStore.ts")),
        })}`,
      );
    const zones = Object.values(s.zones).filter(
      (z: any) => z.ownerId === playerId,
    ) as any[];
    const zone = (type: string) => {
      let found = zones.find((z) => z.type === type);
      if (!found) {
        found = {
          id: `${playerId}-${type}`,
          ownerId: playerId,
          type,
          cardIds: [],
        };
        s.addZone(found);
        zones.push(found);
      }
      return found.id;
    };
    const anchor = s.battlefieldGridSizing[playerId]?.startingAnchor ?? {
      x: 0,
      y: 0,
    };
    const cards = [
      "battlefield",
      "battlefield",
      "hand",
      "hand",
      "library",
      "sideboard",
    ].map((type, index) => ({
      id: crypto.randomUUID(),
      name: `Camera test ${index}`,
      ownerId: playerId,
      controllerId: playerId,
      zoneId: zone(type),
      tapped: false,
      faceDown: false,
      position: { x: anchor.x + (index === 1 ? 0.16 : 0), y: anchor.y },
      rotation: 0,
      counters: [],
      typeLine: "Creature",
      power: "2",
      toughness: "2",
    }));
    s.addCards(cards);
    s.setDeckLoaded(playerId, true);
    return {
      playerId,
      battlefield: zone("battlefield"),
      hand: zone("hand"),
      library: zone("library"),
      sideboard: zone("sideboard"),
      cards,
    };
  });
  await owner
    .locator(
      `[data-zone-id="${sample.battlefield}"] [data-card-id="${sample.cards[0].id}"]`,
    )
    .waitFor();
  await viewer
    .locator(
      `[data-zone-id="${sample.battlefield}"] [data-card-id="${sample.cards[0].id}"]`,
    )
    .waitFor();
  await viewer.waitForFunction(async (id) => {
    const path = "/src/store/gameStore.ts";
    return Boolean(
      (await import(path)).useGameStore.getState().players[id]
        ?.battlefieldCameraAnchor,
    );
  }, sample.playerId);
  await owner.waitForTimeout(600);
  const box = async (locator: Locator) => {
    const result = await locator.boundingBox();
    assert(result, "Missing element geometry");
    return result;
  };
  const near = (a: number, b: number, tolerance = 2) =>
    assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
  const zone = (page: Page) =>
    page.locator(`[data-zone-id="${sample.battlefield}"]`);
  const card = (page: Page, index = 0) =>
    zone(page).locator(`[data-card-id="${sample.cards[index].id}"]`);
  const ownerZone = await box(zone(owner)),
    viewerZone = await box(zone(viewer));
  const initial = await box(card(owner)),
    remote = await box(card(viewer));
  near(initial.height, ownerZone.height / 3);
  near(remote.height, viewerZone.height / 3);
  near(
    (initial.x - ownerZone.x) / initial.height,
    (viewerZone.x + viewerZone.width - remote.x - remote.width) / remote.height,
    0.02,
  );
  near(
    (initial.y - ownerZone.y) / initial.height,
    (viewerZone.y + viewerZone.height - remote.y - remote.height) /
      remote.height,
    0.02,
  );
  await owner.mouse.move(
    ownerZone.x + ownerZone.width / 2,
    ownerZone.y + ownerZone.height / 2,
  );
  for (let i = 0; i < 8; i++) {
    await owner.mouse.wheel(0, -100);
    await owner.waitForTimeout(80);
  }
  await owner.waitForTimeout(200);
  assert(
    (await box(card(owner))).height > initial.height * 1.15,
    "Real app wheel zoom failed",
  );
  near((await box(card(viewer))).height, remote.height);
  await owner.mouse.down({ button: "right" });
  await owner.mouse.move(
    ownerZone.x + ownerZone.width / 2 + 80,
    ownerZone.y + ownerZone.height / 2 + 35,
    { steps: 5 },
  );
  await owner.mouse.up({ button: "right" });
  near((await box(card(viewer))).x, remote.x);
  assert.equal(await owner.locator('[role="menu"]').count(), 0);

  // Move a hand card through real DnD sensors into the zoomed, panned field.
  const handCard = owner.locator(
    `[data-zone-id="${sample.hand}"] [data-card-id="${sample.cards[2].id}"]`,
  );
  const hand = await box(handCard);
  await owner.mouse.move(hand.x + hand.width / 2, Math.min(hand.y + 45, 980));
  await owner.mouse.down();
  await owner.mouse.move(hand.x + hand.width / 2, hand.y - 20, { steps: 5 });
  await owner.mouse.move(
    ownerZone.x + ownerZone.width * 0.6,
    ownerZone.y + ownerZone.height * 0.6,
    { steps: 15 },
  );
  await owner.waitForTimeout(150);
  const ghost = await box(
    owner.locator(`[data-dnd-ghost-card-id="${sample.cards[2].id}"]`),
  );
  await owner.mouse.up();
  await card(owner, 2).waitFor();
  await card(viewer, 2).waitFor();
  await owner.waitForTimeout(400);
  const dropped = await box(card(owner, 2));
  near(dropped.x + dropped.width / 2, ghost.x + ghost.width / 2);
  near(dropped.y + dropped.height / 2, ghost.y + ghost.height / 2);
  const position = async (page: Page, id: string) =>
    page.evaluate(async (id) => {
      const path = "/src/store/gameStore.ts";
      const { useGameStore } = await import(path);
      return useGameStore.getState().cards[id].position;
    }, id);
  assert.deepEqual(
    await position(owner, sample.cards[2].id),
    await position(viewer, sample.cards[2].id),
  );
  assert.deepEqual(
    await position(owner, sample.cards[0].id),
    sample.cards[0].position,
    "Camera changed shared positions",
  );
  await card(owner, 2).dblclick();
  await viewer.waitForFunction(async (id) => {
    const path = "/src/store/gameStore.ts";
    return (await import(path)).useGameStore.getState().cards[id].tapped;
  }, sample.cards[2].id);
  await card(owner, 2).click({ button: "right" });
  await owner.waitForTimeout(400);
  await owner.getByText("Tap/Untap", { exact: true }).waitFor();
  await owner.keyboard.press("Escape");
  await owner
    .locator(`[data-zone-id="${sample.library}"]`)
    .click({ button: "right" });
  await owner.getByText("View Sideboard", { exact: true }).click();
  await owner.getByRole("heading", { name: /sideboard viewer/i }).waitFor();
  await owner.keyboard.press("Escape");
  await owner.screenshot({
    path: "/tmp/drawspell-app-owner.png",
    fullPage: true,
  });
  await viewer.screenshot({
    path: "/tmp/drawspell-app-viewer.png",
    fullPage: true,
  });
  await owner
    .getByRole("heading", { name: "Game Log" })
    .locator("..")
    .getByRole("button")
    .click();
  await owner.setViewportSize({ width: 390, height: 844 });
  await owner.waitForTimeout(400);
  const portraitBefore = await box(card(owner));
  await owner.getByTestId("portrait-seat-switcher-trigger").click();
  await owner
    .getByRole("menuitemradio", { name: "Switch to CameraViewer", exact: true })
    .click();
  await owner.getByTestId("portrait-seat-switcher-trigger").click();
  await owner
    .getByRole("menuitemradio", { name: "Switch to You", exact: true })
    .click();
  await owner.waitForTimeout(400);
  const portraitAfter = await box(card(owner));
  near(portraitBefore.x, portraitAfter.x);
  near(portraitBefore.y, portraitAfter.y);
  near(portraitBefore.height, portraitAfter.height);
  await owner.screenshot({
    path: "/tmp/drawspell-app-portrait.png",
    fullPage: true,
  });
  const beforeReload = await position(viewer, sample.cards[2].id);
  await viewer.reload();
  await card(viewer, 2).waitFor();
  assert.deepEqual(await position(viewer, sample.cards[2].id), beforeReload);
  console.log(
    "PASS: real room, different viewport sizes, first-placement anchor after panning, mirrored anchors, independent zoom/pan, hand drop matches ghost, shared position and tap sync, card menus, sideboard access, portrait camera retention, reconnect positions.",
  );
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
