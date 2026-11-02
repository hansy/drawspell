// @vitest-environment node
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const cli = resolve(require.resolve("@inlang/cli/package.json"), "../bin/run.js");
const plugin = require.resolve("@inlang/plugin-message-format");
const plural = [{ declarations: ["input count", "local category = count: plural"], selectors: ["category"], match: { "category=one": "{count} card", "category=other": "{count} cards" } }];

async function check(target: Record<string, unknown>) {
  const directory = await mkdtemp(resolve(tmpdir(), "drawspell-inlang-"));
  try {
    await mkdir(resolve(directory, "project.inlang"));
    await mkdir(resolve(directory, "messages"));
    await writeFile(resolve(directory, "project.inlang/settings.json"), JSON.stringify({
      baseLocale: "en", locales: ["en", "de"], modules: [plugin],
      "plugin.inlang.messageFormat": { pathPattern: "./messages/{locale}.json" },
    }));
    await writeFile(resolve(directory, "messages/en.json"), JSON.stringify({ greeting: "Hello {name}", cards: plural }));
    await writeFile(resolve(directory, "messages/de.json"), JSON.stringify(target));
    const result = spawnSync(process.execPath, [cli, "check", "--project", "./project.inlang", "--missing-translations", "--missing-variables", "--unknown-variables", "--missing-variants"], { cwd: directory, encoding: "utf8", timeout: 25_000 });
    if (result.error) throw result.error;
    return { code: result.status, output: result.stdout + result.stderr };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("real inlang semantic gate", () => {
  it("accepts a complete catalog", async () => {
    const result = await check({ greeting: "Hallo {name}", cards: plural });
    expect(result.output).toContain("No findings");
    expect(result.code).toBe(0);
  }, 30_000);
  it.each([
    ["missing translation", { cards: plural }],
    ["missing variable", { greeting: "Hallo", cards: plural }],
    ["unknown variable", { greeting: "Hallo {person}", cards: plural }],
    ["missing plural variant", { greeting: "Hallo {name}", cards: [{ ...plural[0], match: { "category=other": "{count} Karten" } }] }],
  ])("fails for a %s", async (_name, target) => {
    const result = await check(target);
    expect(result.code, result.output).not.toBe(0);
  }, 30_000);
});
