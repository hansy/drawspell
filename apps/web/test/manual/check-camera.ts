import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4194/test/manual/battlefield-camera.html");
  await page.locator('[data-card-id="wide-island"]').waitFor();
  await page.waitForTimeout(500);
  const card = (id: string) =>
    page.locator(`[data-zone-id="${id}"] [data-card-id="${id}-island"]`);
  const zone = (id: string) => page.locator(`[data-zone-id="${id}"]`);
  const box = async (l: ReturnType<typeof card>) => {
    const b = await l.boundingBox();
    if (!b) throw Error("Missing box");
    return b;
  };
  const initial = await box(card("wide")),
    narrow = await box(card("narrow")),
    rotated = await box(card("rotated"));
  const wideZone = await box(zone("wide")),
    narrowZone = await box(zone("narrow")),
    rotatedZone = await box(zone("rotated"));
  const near = (a: number, b: number) => {
    if (Math.abs(a - b) > 2) throw Error(`Geometry mismatch: ${a} vs ${b}`);
  };
  near(initial.width, narrow.width);
  near(initial.width, rotated.width);
  near(initial.x - wideZone.x, narrow.x - narrowZone.x);
  near(
    initial.x - wideZone.x,
    rotatedZone.x + rotatedZone.width - rotated.x - rotated.width,
  );
  near(
    initial.y - wideZone.y,
    rotatedZone.y + rotatedZone.height - rotated.y - rotated.height,
  );
  near(initial.height, wideZone.height / 3);
  if (await page.locator("[data-camera-controls]").count())
    throw Error("Zoom indicator persists before zooming");
  await page.mouse.move(wideZone.x + 500, wideZone.y + 200);
  await page.mouse.down({ button: "right" });
  if ((await page.locator('[data-camera-panning="true"]').count()) !== 1)
    throw Error("No panning state");
  if ((await page.locator("[data-battlefield-grid-overlay]").count()) !== 1)
    throw Error("No panning grid");
  await page.mouse.move(wideZone.x + 620, wideZone.y + 240, { steps: 8 });
  await page.mouse.up({ button: "right" });
  if (await page.locator("[data-camera-controls]").count())
    throw Error("Panning showed zoom controls");
  const panned = await box(card("wide"));
  near(panned.x - initial.x, 120);
  near(panned.y - initial.y, 40);
  near((await box(card("narrow"))).x, narrow.x);
  await page.reload();
  await card("wide").waitFor();
  await page.waitForTimeout(350);
  near((await box(card("wide"))).x, initial.x);
  await page.mouse.move(wideZone.x + 300, wideZone.y + 180);
  const zoomFrames = await page.evaluate(async () => {
    const surface = document.querySelector<HTMLElement>(
      '[data-zone-id="wide"]',
    )!;
    const rect = surface.getBoundingClientRect();
    surface.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -100,
        clientX: rect.x + 300,
        clientY: rect.y + 180,
        bubbles: true,
        cancelable: true,
      }),
    );
    const samples: { cardHeight: number; gridWidth: number }[] = [];
    for (let i = 0; i < 15; i++) {
      await new Promise(requestAnimationFrame);
      samples.push({
        cardHeight: surface
          .querySelector('[data-card-id="wide-island"]')!
          .getBoundingClientRect().height,
        gridWidth: surface
          .querySelector("[data-battlefield-boundary]")!
          .getBoundingClientRect().width,
      });
    }
    return samples;
  });
  if (
    !zoomFrames.some(
      (sample) =>
        sample.cardHeight > initial.height + 0.1 &&
        sample.cardHeight < initial.height * 1.05 - 0.1,
    )
  )
    throw Error("Zoom skipped intermediate animation frames");
  for (const sample of zoomFrames)
    if (Math.abs(sample.gridWidth / sample.cardHeight - 40) > 0.05)
      throw Error(`Cards and grid fell out of sync during zoom: ${JSON.stringify(sample)}`);
  await page.waitForTimeout(350);
  if ((await box(card("wide"))).height <= initial.height)
    throw Error("Wheel did not zoom");
  near((await box(card("narrow"))).height, narrow.height);
  if ((await page.locator("[data-camera-controls]").count()) !== 1)
    throw Error("Zoom indicator did not appear locally");
  if (await page.locator("[data-camera-controls] button").count())
    throw Error("Zoom indicator contains buttons");
  await page.waitForTimeout(950);
  if (await page.locator("[data-camera-controls]").count())
    throw Error("Zoom indicator did not hide");
  await page.reload();
  await card("wide").waitFor();
  await page.waitForTimeout(350);
  await page.screenshot({
    path: "/tmp/drawspell-camera-preview.png",
    fullPage: true,
  });
  // Use the real drag handlers, then check all views reproduce the same new position.
  const before = await box(card("wide"));
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    before.x + before.width / 2 + 10,
    before.y + before.height / 2 + 10,
    { steps: 3 },
  );
  await page.mouse.move(
    before.x + before.width / 2 + 142,
    before.y + before.height / 2 + 107,
    { steps: 10 },
  );
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const moved = await box(card("wide")),
    movedNarrow = await box(card("narrow"));
  if (Math.abs(moved.x - before.x) < 40) throw Error("Drag did not commit");
  near(moved.x - wideZone.x, movedNarrow.x - narrowZone.x);
  await page.mouse.move(0, 0);
  await page.setViewportSize({ width: 780, height: 1400 });
  await page.waitForTimeout(300);
  const resized = await box(card("wide")),
    resizedZone = await box(zone("wide"));
  near(resized.height, resizedZone.height / 3);
  // Both zoom endpoints and finite-board bounds apply to every viewport.
  const cameraView = page.locator("[data-battlefield-camera]").first();
  await page.mouse.move(resizedZone.x + 100, resizedZone.y + 200);
  await page.mouse.wheel(0, -100);
  const slider = cameraView.getByRole("slider");
  await slider.fill("-1");
  await page.waitForTimeout(300);
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: "/tmp/drawspell-camera-bounds.png",
    fullPage: true,
  });
  const wholeBoard = await box(
    cameraView.locator("[data-battlefield-boundary]"),
  );
  const currentZone = await box(zone("wide"));
  if (
    wholeBoard.x > currentZone.x + 1 ||
    wholeBoard.y > currentZone.y + 1 ||
    wholeBoard.x + wholeBoard.width < currentZone.x + currentZone.width - 1 ||
    wholeBoard.y + wholeBoard.height < currentZone.y + currentZone.height - 1
  )
    throw Error("Grid does not cover viewport at minimum zoom");
  await page.mouse.move(currentZone.x + 50, currentZone.y + 50);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(currentZone.x + 150, currentZone.y + 150);
  await page.mouse.up({ button: "right" });
  const afterMinimumPan = await box(
    cameraView.locator("[data-battlefield-boundary]"),
  );
  if (
    afterMinimumPan.x > currentZone.x + 1 ||
    afterMinimumPan.y > currentZone.y + 1 ||
    afterMinimumPan.x + afterMinimumPan.width <
      currentZone.x + currentZone.width - 1 ||
    afterMinimumPan.y + afterMinimumPan.height <
      currentZone.y + currentZone.height - 1
  )
    throw Error("Panning exposed an outside edge at minimum zoom");
  await slider.fill("1");
  await page.waitForTimeout(300);
  await page.mouse.move(0, 0);
  near((await box(card("wide"))).height, (currentZone.height * 2) / 3);
  await page.mouse.move(currentZone.x + 50, currentZone.y + 50);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(20000, 20000);
  await page.mouse.up({ button: "right" });
  const edge = await box(cameraView.locator("[data-battlefield-boundary]"));
  if (edge.x > currentZone.x + 1 || edge.y > currentZone.y + 1)
    throw Error("Panning escaped the finite board");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: three-card default, wide/narrow/rotated anchors, right-pan grid/release, smooth local zoom, temporary button-free indicator, drag/drop, viewport resize, zoom endpoints and finite panning.",
  );
} finally {
  await browser.close();
}
