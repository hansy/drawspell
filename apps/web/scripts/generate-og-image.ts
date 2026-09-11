import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const width = 1200;
const height = 630;
const root = new URL("../", import.meta.url);
const orbitSource = await readFile(
  new URL("src/components/landing/OrbitAnimation.tsx", root),
  "utf8",
);

const symbols = [...orbitSource.matchAll(
  /name: "([^"]+)",[\s\S]*?color: "([^"]+)",[\s\S]*?glow: "([^"]+)",[\s\S]*?path: "([^"]+)"/g,
)].map(([, name, color, glow, path]) => ({ name, color, glow, path }));

if (symbols.length !== 5) {
  throw new Error(`Expected 5 mana symbols, found ${symbols.length}`);
}

const positions = [
  [914, 108],
  [1083, 232],
  [1018, 432],
  [806, 432],
  [741, 232],
];

const symbolMarkup = symbols.map((symbol, index) => {
  const [x, y] = positions[index];
  return `
    <g transform="translate(${x - 42} ${y - 42}) scale(2.625)" aria-label="${symbol.name}">
      <path d="${symbol.path}" fill="${symbol.color}" fill-opacity=".18"
        stroke="${symbol.color}" stroke-width=".72" stroke-linejoin="round"
        filter="url(#glow-${index})" />
    </g>`;
}).join("");

const filters = symbols.map((symbol, index) => `
  <filter id="glow-${index}" x="-100%" y="-100%" width="300%" height="300%">
    <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="${symbol.color}" flood-opacity=".9"/>
    <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${symbol.color}" flood-opacity=".38"/>
  </filter>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Drawspell</title>
  <desc id="desc">Online Magic: The Gathering tabletop simulator. No downloads, no logins, 100% free.</desc>
  <defs>
    <radialGradient id="blue-haze" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#111b36" stop-opacity=".84"/>
      <stop offset="1" stop-color="#111b36" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="red-haze" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#39131b" stop-opacity=".64"/>
      <stop offset="1" stop-color="#39131b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#ffffff" stop-opacity=".12"/>
      <stop offset=".48" stop-color="#ffffff" stop-opacity=".025"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity=".1"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="28"/></filter>
    ${filters}
  </defs>

  <rect width="1200" height="630" fill="#09090d"/>
  <ellipse cx="840" cy="190" rx="470" ry="390" fill="url(#blue-haze)" filter="url(#soft)"/>
  <ellipse cx="75" cy="555" rx="330" ry="230" fill="url(#red-haze)" filter="url(#soft)"/>
  <path d="M0 0H1200V630H0Z" fill="none" stroke="url(#edge)" stroke-width="2"/>

  ${symbolMarkup}

  <g transform="translate(72 0)">
    <text x="0" y="236" fill="#e4e4e7" fill-opacity=".9"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      font-size="40" font-weight="600" letter-spacing="12">DRAWSPELL</text>
    <rect x="0" y="260" width="62" height="3" rx="1.5" fill="#8b91ba"/>
    <text x="0" y="318" fill="#d8d8df" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      font-size="25" font-weight="500" letter-spacing="-.2">Online Magic: The Gathering</text>
    <text x="0" y="353" fill="#d8d8df" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      font-size="25" font-weight="500" letter-spacing="-.2">tabletop sim</text>
    <g transform="translate(0 414)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="17" font-weight="600">
      <text x="0" y="0" fill="#a4a4ae">No downloads</text>
      <circle cx="127" cy="-6" r="2.5" fill="#666b8c"/>
      <text x="143" y="0" fill="#a4a4ae">No logins</text>
      <circle cx="237" cy="-6" r="2.5" fill="#666b8c"/>
      <text x="253" y="0" fill="#f0f0f4">100% free</text>
    </g>
  </g>
</svg>`.replace(/[ \t]+$/gm, "");

const svgPath = new URL("public/og_image.svg", root);
const pngPath = new URL("public/og_image.png", root);
const htmlPath = new URL("public/og_image.html", root);
await writeFile(svgPath, svg);
await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Drawspell OG image preview</title>
    <style>
      * { box-sizing: border-box; }
      html, body { min-height: 100%; }
      body {
        margin: 0;
        display: grid;
        place-items: center;
        padding: 32px;
        background: #050508;
      }
      .artboard {
        width: min(1200px, 100%);
        aspect-ratio: 1200 / 630;
        overflow: hidden;
        box-shadow: 0 24px 90px rgba(0, 0, 0, .6);
      }
      svg { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <main class="artboard">
      ${svg}
    </main>
  </body>
</html>`.replace(/[ \t]+$/gm, ""));

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(svgPath.href);
  await page.screenshot({ path: pngPath.pathname, omitBackground: false });
} finally {
  await browser.close();
}

console.log(`Generated ${htmlPath.pathname}, ${svgPath.pathname}, and ${pngPath.pathname}`);
