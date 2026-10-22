# Dependency audit

Every branch push, pull request, and manual workflow run audits the complete Bun lockfile, including build and test dependencies. Run `bun run audit:dependencies` locally. This uses Bun's built-in `bun audit --audit-level=high` command. High and critical findings fail the check; lower severities remain in the full native JSON report uploaded by CI. Registry failures fail the check.

CI installs the frozen lockfile with lifecycle scripts disabled. Workflow actions are pinned to immutable commit IDs. `bun audit` reports findings; it does not update dependencies. After changing dependencies, regenerate `bun.lock`, rerun the audit and affected application checks, and review the lockfile diff.

The audit workflow pins Bun 1.4.4. Use that version locally too; Bun 1.3.14 can return success for a registry error object instead of failing the audit.
