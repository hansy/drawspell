# Dependency audit

Dependency checks run on the machine releasing the code, not in CI. `bun run check:dependencies` gates every push to `main` and every deploy:

- **Push to `main`:** `.githooks/pre-push` runs the checks whenever a push targets `main`, and stops the push if they fail. `bun install` points Git at `.githooks` (`scripts/install-git-hooks.ts`); it leaves an existing `core.hooksPath` alone and does nothing on build machines.
- **Deploys:** every root `bun run deploy:*` command (web, server, Discord, and their staging variants) runs the checks before building or deploying anything. Running an app's own `deploy` script from inside `apps/*` skips the gate, so deploy from the root.

The checks audit the complete Bun lockfile, including build and test dependencies, using Bun's built-in `bun audit --audit-level=high` command (`bun run audit:dependencies`). High and critical findings fail; lower severities are reported but do not block. Registry failures fail the check. Use `--no-verify` to skip the push hook only in an emergency, and run the checks before the next release.

The checks require the Bun pinned in `packageManager` (`scripts/require-audit-bun.mjs`). Bun 1.3.14 can return success for a registry error object instead of failing the audit, so older versions are refused; run `bun upgrade`. `bun audit` reports findings; it does not update dependencies. After changing dependencies, regenerate `bun.lock`, rerun the checks and affected application checks, and review the lockfile diff.
