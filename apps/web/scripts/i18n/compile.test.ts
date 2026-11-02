// @vitest-environment node
import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("incremental Paraglide generation", () => {
  it("keeps existing runtime files in place when input has not changed", async () => {
    const before = await stat("src/paraglide/runtime.js");
    const result = spawnSync("bun", ["scripts/i18n/compile.ts"], { encoding: "utf8", timeout: 30_000 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const after = await stat("src/paraglide/runtime.js");
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(after.ino).toBe(before.ino);
  }, 35_000);
});
