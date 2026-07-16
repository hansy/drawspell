import { access } from "node:fs/promises";
import { chromium } from "playwright-core";

const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TARGET_URL = process.env.PERF_URL ?? "http://127.0.0.1:4173/";
const RUNS = Number(process.env.PERF_RUNS ?? 5);

type NumericRecord = Record<string, number>;

const round = (value: number) => Number(value.toFixed(2));

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const summarize = (runs: NumericRecord[]) =>
  Object.fromEntries(
    Object.keys(runs[0] ?? {}).map((key) => [
      key,
      round(median(runs.map((run) => run[key] ?? 0))),
    ]),
  );

const chromePath = process.env.CHROME_PATH ?? DEFAULT_CHROME_PATH;
await access(chromePath).catch(() => {
  throw new Error(
    `Chrome was not found at ${chromePath}. Set CHROME_PATH to a Chromium executable.`,
  );
});

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--disable-background-networking", "--disable-default-apps", "--no-first-run"],
});

const results: NumericRecord[] = [];
try {
  for (let runIndex = 0; runIndex < RUNS; runIndex += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      const metrics = {
        cumulativeLayoutShift: 0,
        largestContentfulPaint: 0,
        longTaskCount: 0,
        longTaskDuration: 0,
      };
      Object.defineProperty(window, "__drawspellPerformanceMetrics", {
        value: metrics,
      });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.largestContentfulPaint = entry.startTime;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
          if (!entry.hadRecentInput) metrics.cumulativeLayoutShift += entry.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.longTaskCount += 1;
          metrics.longTaskDuration += entry.duration;
        }
      }).observe({ type: "longtask", buffered: true });
    });

    const client = await context.newCDPSession(page);
    await client.send("Performance.enable");
    await page.goto(TARGET_URL, { waitUntil: "load" });
    await page.getByRole("button", { name: "Start a game" }).waitFor();
    await page.waitForTimeout(100);

    const pageMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const paints = Object.fromEntries(
        performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]),
      );
      const observed = (window as typeof window & {
        __drawspellPerformanceMetrics: {
          cumulativeLayoutShift: number;
          largestContentfulPaint: number;
          longTaskCount: number;
          longTaskDuration: number;
        };
      }).__drawspellPerformanceMetrics;
      const scripts = resources.filter((entry) => {
        try {
          return new URL(entry.name).pathname.endsWith(".js");
        } catch {
          return false;
        }
      });
      return {
        responseStartMs: navigation.responseStart,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadMs: navigation.loadEventEnd,
        firstContentfulPaintMs: paints["first-contentful-paint"] ?? 0,
        largestContentfulPaintMs: observed.largestContentfulPaint,
        cumulativeLayoutShift: observed.cumulativeLayoutShift,
        longTaskCount: observed.longTaskCount,
        longTaskDurationMs: observed.longTaskDuration,
        resourceTransferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
        scriptTransferBytes: scripts.reduce((sum, entry) => sum + entry.transferSize, 0),
        scriptDecodedBytes: scripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      };
    });
    const cdpMetrics = await client.send("Performance.getMetrics");
    const byName = Object.fromEntries(
      cdpMetrics.metrics.map((metric: { name: string; value: number }) => [metric.name, metric.value]),
    );

    results.push({
      ...pageMetrics,
      jsHeapUsedBytes: byName.JSHeapUsedSize ?? 0,
      jsHeapTotalBytes: byName.JSHeapTotalSize ?? 0,
      domNodes: byName.Nodes ?? 0,
      taskDurationMs: (byName.TaskDuration ?? 0) * 1_000,
      scriptDurationMs: (byName.ScriptDuration ?? 0) * 1_000,
      layoutDurationMs: (byName.LayoutDuration ?? 0) * 1_000,
      recalcStyleDurationMs: (byName.RecalcStyleDuration ?? 0) * 1_000,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  url: TARGET_URL,
  runs: RUNS,
  coldContextPerRun: true,
  median: summarize(results),
  samples: results.map((result) =>
    Object.fromEntries(Object.entries(result).map(([key, value]) => [key, round(value)])),
  ),
};

console.log(JSON.stringify(report, null, 2));
