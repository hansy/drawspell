#!/usr/bin/env bun
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The dependency gate every push to main runs (deploy scripts run the same
 * `check:dependencies` script): the pinned-Bun guard and script tests, then the
 * high-severity `bun audit`. It needs the registry, so a network failure stops
 * the push rather than skipping it.
 */
export const DEPENDENCY_CHECK_COMMAND = ["bun", "run", "check:dependencies"] as const;

export async function runDependencyChecks(cwd: string = REPOSITORY_ROOT) {
  const child = Bun.spawn([...DEPENDENCY_CHECK_COMMAND], {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await child.exited) !== 0) {
    throw new Error("Dependency checks failed; fix the audit findings before releasing.");
  }
}
