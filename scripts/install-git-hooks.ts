#!/usr/bin/env bun

export const HOOKS_PATH = ".githooks";

type Git = (args: string[]) => { exitCode: number; stdout: string };

const runGit: Git = (args) => {
  const result = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  return { exitCode: result.exitCode, stdout: result.stdout.toString().trim() };
};

/**
 * Points this clone at the tracked hooks so pushes to main run the dependency
 * checks. Runs from `bun install`; it never replaces a hooks path someone chose
 * and stays out of build machines, which have no pushes to guard.
 */
export function installGitHooks(git: Git = runGit, environment: NodeJS.ProcessEnv = process.env) {
  if (environment.CI || environment.WORKERS_CI) return "skipped: build environment";
  if (git(["rev-parse", "--is-inside-work-tree"]).stdout !== "true")
    return "skipped: not a Git checkout";
  const current = git(["config", "--get", "core.hooksPath"]).stdout;
  if (current === HOOKS_PATH) return "already installed";
  if (current) return `skipped: core.hooksPath is already ${current}`;
  if (git(["config", "core.hooksPath", HOOKS_PATH]).exitCode !== 0) return "failed";
  return "installed";
}

if (import.meta.main) {
  const outcome = installGitHooks();
  if (outcome !== "already installed") console.error(`[git hooks] ${outcome}`);
}
