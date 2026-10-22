# Dependency audit

Every branch push, pull request, and manual workflow run audits the complete Bun lockfile, including build and test dependencies. Run `bun run audit:dependencies` locally. CI blocks unpatched high and critical advisories and uploads the complete report, including lower severities. Registry failures and malformed reports fail the check.

CI installs the frozen lockfile with lifecycle scripts disabled. Workflow actions are pinned to immutable commit IDs. The audit gate has its own failure-behavior tests.

When an upstream package has no published fix, a local Bun patch may provide the repair. `dependency-patches.json`, when present, records the exact package version, upstream advisory, patch path, and SHA-256. The gate verifies that every resolved copy has that exact patched version, checks the patch checksum and installation declaration, and runs a behavioral security regression against the installed package. Only then does it classify that specific advisory as locally repaired. Other advisories on the same package still block. A plain advisory ignore list is not supported.

After changing dependencies, regenerate `bun.lock`, run the audit and affected application checks, and review the lockfile diff. Remove a local patch and its policy entry when a published dependency update repairs the issue, then rerun the security regression before deleting it.
