import { writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const width = 1200;
const height = 630;
const root = new URL("../", import.meta.url);

// The app's body font stack (src/styles.css), used by the SiteHeader wordmark.
const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif";
// SiteHeader wordmark: semibold, uppercase, tracking-[0.3em].
const wordmarkSize = 80;
const wordmarkTracking = wordmarkSize * 0.3;

// Corner brackets from the Drawspell mark, framing the card.
const brackets = [
  { id: "tl", d: "M60 148V82a22 22 0 0 1 22-22h66", stops: ["#7c3aed", "#c4b5fd"], axis: 'x1="0" y1="1" x2="1" y2="0"' },
  { id: "tr", d: "M1052 60h66a22 22 0 0 1 22 22v66", stops: ["#67e8f9", "#2563eb"], axis: 'x1="0" y1="0" x2="1" y2="1"' },
  { id: "bl", d: "M60 482v66a22 22 0 0 0 22 22h66", stops: ["#db2777", "#fda4af"], axis: 'x1="0" y1="0" x2="1" y2="1"' },
  { id: "br", d: "M1052 570h66a22 22 0 0 0 22-22v-66", stops: ["#fcd34d", "#ea580c"], axis: 'x1="0" y1="0" x2="1" y2="1"' },
];

const gradients = brackets.map(({ id, stops: [from, to], axis }) => `
    <linearGradient id="${id}" ${axis}>
      <stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>`).join("");

const bracketMarkup = brackets.map(({ id, d }) => `
    <path d="${d}" stroke="url(#${id})"/>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Drawspell</title>
  <desc id="desc">Play Magic: The Gathering in your browser. Free, no downloads, no logins.</desc>
  <defs>
    <radialGradient id="lift" cx="50%" cy="44%" r="55%">
      <stop offset="0" stop-color="#1a1824" stop-opacity=".9"/>
      <stop offset="1" stop-color="#1a1824" stop-opacity="0"/>
    </radialGradient>${gradients}
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>
      <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .55 0" result="g"/>
      <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="spark-glow" x="-200%" y="-200%" width="500%" height="500%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#ffffff" flood-opacity=".55"/>
      <feDropShadow dx="0" dy="0" stdDeviation="22" flood-color="#a78bfa" flood-opacity=".5"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="#09090c"/>
  <rect width="${width}" height="${height}" fill="url(#lift)"/>

  <g fill="none" stroke-width="5" stroke-linecap="round" filter="url(#glow)">${bracketMarkup}
  </g>

  <g transform="translate(600 192)" filter="url(#spark-glow)" fill="#ffffff">
    <path d="M0-40C3-6 6-3 40 0C6 3 3 6 0 40C-3 6-6 3-40 0C-6-3-3-6 0-40Z"/>
    <path d="M-50 22c.6-7 1.2-7.6 8-8c-6.8-.4-7.4-1-8-8c-.6 7-1.2 7.6-8 8c6.8.4 7.4 1 8 8Z" fill-opacity=".8"/>
  </g>

  <g text-anchor="middle" font-family="${fontFamily}">
    <!-- Tracking trails the last letter, so shift right by half of it to stay centered. -->
    <text x="${600 + wordmarkTracking / 2}" y="350" fill="#f4f4f5" font-size="${wordmarkSize}" font-weight="600" letter-spacing="${wordmarkTracking}">DRAWSPELL</text>
    <text x="600" y="420" fill="#a1a1aa" font-size="30" letter-spacing="-.2">Play Magic: The Gathering in your browser.</text>
    <text x="601.5" y="560" fill="#6b6b76" font-size="17" font-weight="600" letter-spacing="3">FREE · NO DOWNLOADS · NO LOGINS</text>
  </g>
</svg>
`;

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
