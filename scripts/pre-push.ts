#!/usr/bin/env bun
import { runDependencyChecks } from "./dependency-checks";

const ZERO_SHA = /^0+$/;

/** Files the dependency checks read; the pushed commit must match them on disk. */
export const DEPENDENCY_PATHS = [
  "package.json",
  "bun.lock",
  "scripts",
] as const;

/**
 * Commits a push sends to main, from the `<local ref> <local sha> <remote ref>
 * <remote sha>` lines git writes to a pre-push hook. Deleting main sends none.
 */
export function mainPushCommits(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(
      ([, localSha, remoteRef]) =>
        remoteRef === "refs/heads/main" && localSha !== undefined && !ZERO_SHA.test(localSha),
    )
    .map(([, localSha]) => localSha!);
}

function git(args: string[]) {
  return Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
}

async function main() {
  const commits = mainPushCommits(await Bun.stdin.text());
  if (commits.length === 0) return;

  const root = git(["rev-parse", "--show-toplevel"]).stdout.toString().trim();
  for (const commit of commits) {
    // The audit reads the working tree, so it only vouches for a commit whose dependency files match it.
    const diff = git(["diff", "--quiet", commit, "--", ...DEPENDENCY_PATHS]);
    if (diff.exitCode !== 0) {
      throw new Error(
        `The dependency files in ${commit.slice(0, 12)} differ from this checkout. ` +
          "Check out the commit you are pushing to main, then push again.",
      );
    }
  }
  console.error("[pre-push] Pushing to main: running dependency checks…");
  await runDependencyChecks(root);
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(`[pre-push] ${error instanceof Error ? error.message : String(error)}`);
    console.error("[pre-push] Push to main stopped. Use --no-verify only for an emergency.");
    process.exitCode = 1;
  });
}
