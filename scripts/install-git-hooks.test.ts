import { describe, expect, test } from "bun:test";

import { HOOKS_PATH, installGitHooks } from "./install-git-hooks";

function fakeGit(hooksPath = "") {
  const writes: string[][] = [];
  const git = (args: string[]) => {
    if (args[0] === "rev-parse") return { exitCode: 0, stdout: "true" };
    if (args[1] === "--get") return { exitCode: hooksPath ? 0 : 1, stdout: hooksPath };
    writes.push(args);
    return { exitCode: 0, stdout: "" };
  };
  return { git, writes };
}

describe("git hook installation", () => {
  test("points an unconfigured checkout at the tracked hooks", () => {
    const { git, writes } = fakeGit();
    expect(installGitHooks(git, {})).toBe("installed");
    expect(writes).toEqual([["config", "core.hooksPath", HOOKS_PATH]]);
  });

  test("never replaces a hooks path someone already chose", () => {
    const { git, writes } = fakeGit(".husky");
    expect(installGitHooks(git, {})).toBe("skipped: core.hooksPath is already .husky");
    expect(writes).toEqual([]);
  });

  test("stays out of build machines", () => {
    const { git, writes } = fakeGit();
    expect(installGitHooks(git, { CI: "true" })).toBe("skipped: build environment");
    expect(installGitHooks(git, { WORKERS_CI: "1" })).toBe("skipped: build environment");
    expect(writes).toEqual([]);
  });
});
