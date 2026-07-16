# Performance audit

Updated: 2026-07-16

## Executive summary

The audit found three distinct critical paths: cold landing startup, full Yjs snapshot reconciliation, and high-card-count render fan-out. The landing route synchronously pulled analytics plus game/Yjs code into its main bundle, every shared-state update ran quadratic validation work at room-size limits, and selection/drop state repeatedly scanned large arrays per rendered card. These paths are now substantially cheaper, and repeatable client and browser benchmarks are part of the web package.

### Measured results

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Landing main JavaScript (decoded) | 742.19 kB | 392.77 kB | -47.1% |
| Landing main JavaScript (gzip) | 238.10 kB | 126.54 kB | -46.9% |
| Initial game-board chunk (decoded) | 492.45 kB | 413.60 kB | -16.0% |
| Initial game-board chunk (gzip) | 154.14 kB | 128.01 kB | -16.9% |
| Max-room snapshot sanitize, median | 43.66 ms | 2.75 ms | -93.7% |
| Max-room snapshot sanitize, median p95 across runs | 49.84 ms | 3.87 ms | -92.2% |
| 1,000 unchanged persistence updates | 1,000 writes / 53.05 ms | 1 write / 1.94 ms | -99.9% writes / -96.3% modeled time |
| Cold landing DOMContentLoaded, median | 246.9 ms | 199.4 ms | -19.2% |
| Cold landing load, median | 317.1 ms | 238.1 ms | -24.9% |
| Cold landing FCP/LCP, median | 300 ms | 268 ms | -10.7% |
| Cold landing JS heap, median | 4.73 MB | 3.54 MB | -25.1% |
| Cold landing script duration, median | 110.63 ms | 64.41 ms | -41.8% |
| Cold landing long tasks, median | 1 / 79 ms | 0 / 0 ms | eliminated at median |
| Battlefield commits per unrelated card update | 1 | 0 | eliminated |
| Battlefield commits per unrelated-zone selection | 1 | 0 | eliminated |
| 800-card / 400-selected membership pass, median | 0.8046 ms | 0.0425 ms | -94.7% |
| 800-card / 400-claim pending-drop membership, median | 1.3912 ms | 0.0719 ms | -94.8% |
| One-card full sync in an 800-card room | — | 3.6292 ms median / 4.4778 ms p95 | within frame budget |
| Remote-update scheduling delay | 50 ms after final update | next frame / 32 ms fallback | no trailing starvation |
| Modern mana font transfer | 408.28 kB WOFF | 187.40 kB WOFF2 | -54.1% |
| Emitted mana-related font artifacts | 3.53 MB | 187.40 kB | -94.7% |

Browser metrics are medians from five fresh Chrome contexts against local production previews. Local server and machine scheduling introduce normal run-to-run variance; bundle sizes and algorithmic benchmarks are the more deterministic gates.

## Changes applied and validated separately

1. **Made snapshot sanitization linear at room limits.** Reveal limits now use counters instead of repeatedly enumerating growing objects. Zone membership uses sets instead of repeated array scans, and invariant battlefield-grid work is hoisted. Existing sanitizer behavior tests pass.
2. **Deduplicated persisted identity writes.** The large game store persists only session identity fields, but Zustand invokes persistence for every state update. Identical serialized values now skip the synchronous storage write. Tests cover hydration, unchanged values, changes, and removal.
3. **Removed analytics from the critical bundle.** PostHog initializes two seconds after production hydration. No component consumes its React context, so direct delayed initialization avoids remounting the app.
4. **Decoupled the landing route from game/Yjs code.** Game-store and session cleanup modules load only for a prior in-page game runtime or a resume/leave edge case. Fresh visitors do not download them.
5. **Lazy-loaded closed game tools.** Deck import, token creation, zone browsing, opponent reveals, shortcuts, and sharing are separate chunks loaded when opened.
6. **Narrowed battlefield subscriptions.** Each battlefield now observes only the active drag card and source cards needed for its current group-drag ghosts. Ordinary selection changes stay within per-card boolean subscriptions; the parent observes selected IDs only while its own group drag is active. A React Profiler regression test records zero subtree commits for unrelated card and selection updates, down from one commit per update for each path.
7. **Indexed selection membership.** Selection arrays now acquire a weakly cached `Set` on first membership lookup. An 800-card render pass with 400 selected cards falls from 0.8046 ms median with repeated linear scans to 0.0425 ms with the production selector. Battlefield group-drag and ghost rendering also reuse indexed membership, and the inner card controller skips its duplicate lookup when selection state is already supplied by the wrapper.
8. **Frame-batched remote reconciliation.** Document updates now coalesce into one next-frame sync rather than a trailing 50 ms debounce. A 32 ms fallback keeps background or throttled tabs current, and teardown cancels both handles. This removes added interaction latency and prevents continuous updates from postponing publication indefinitely.
9. **Indexed pending-drop ownership.** Pending visual claims acquire a weakly cached zone/card index. The 800-card/400-claim pass falls from 1.3912 ms to 0.0719 ms median, and both battlefield and hand card selectors use the indexed lookup.
10. **Stabilized card-metadata prefetching.** Scryfall ID projection now shallow-reuses the prior list when card identity metadata is unchanged. Position, tap, counter, and reveal updates no longer repeat ID joining, deduplication, sorting, or fetch-effect setup.
11. **Split the remaining closed board surfaces.** Context menus, prompts, coin/dice tools, counter editing, and username editing now load on demand. This reduced the board entry by another 13.94 kB decoded / 3.83 kB gzip while keeping each optional chunk between 0.50 and 2.28 kB gzip.
12. **Selected the modern mana font.** A dependency-scoped Vite transform points `mana-font` at its existing WOFF2 asset and removes unused legacy face declarations. Modern font transfer is 54.1% smaller, and the build no longer emits redundant EOT, TTF, WOFF, SVG, or unused MPlantin assets.

## Benchmark commands

Client hot paths:

```bash
bun run --cwd apps/web perf:bench
bun run --cwd apps/web perf:bench -- --json
```

Cold browser startup (requires a production preview and Chrome/Chromium):

```bash
bun run --cwd apps/web serve -- --host 127.0.0.1 --port 4173
bun run --cwd apps/web perf:browser
```

Overrides:

```bash
PERF_URL=http://127.0.0.1:4173/ PERF_RUNS=10 CHROME_PATH=/path/to/chrome \
  bun run --cwd apps/web perf:browser
```

Existing server stress fixtures remain available under `apps/server/scripts/`. Baseline medians observed during this audit:

| Server fixture | Median |
| --- | ---: |
| `library.view` intent | 0.0049 ms/intent |
| Hidden-card chunking | 2.61 ms/iteration |
| Card duplication | 0.80 ms/iteration |
| Overlay build with shared snapshot + zone lookup | 0.1215 ms/overlay |
| Library reveal synchronization | 1.10 ms/iteration |

## Remaining findings and completion thresholds

### 1. Shared-state reconciliation

`createFullSyncToStore` still validates the full snapshot because a single changed card can affect zone membership, counter legality, and collision-resolved placement of later cards. The new end-to-end maximum-room fixture measures this complete path at 3.6292 ms median / 4.4778 ms p95, safely below a 16.7 ms frame. Frame batching removes the previous 50 ms trailing delay.

Completion threshold: retain full validation while p95 remains below 8 ms. Only introduce transaction-key incremental sanitization if this gate regresses; it would require affected-zone dependency tracking and equivalence tests for collision placement, deletes, capacity limits, and private overlays.

### 2. Zustand subscription fan-out

The broad `Battlefield` card/selection subscriptions and repeated selection/drop scans are eliminated. The board controller still observes whole `cards` and `zones` records because seat layout, overlays, context actions, and zone viewers consume cross-seat state. Scryfall metadata derivation now remains stable across ordinary card mutations.

Completion threshold: perform the larger controller/seat ownership refactor only with an interactive 100/300/800-card drag fixture showing missed-frame or commit-duration regressions. Store publication itself measures 4.4778 ms p95 in the maximum-room microbenchmark.

### 3. Optional board payload

The board entry is 413.60 kB decoded / 128.01 kB gzip. Remaining static code is the always-visible shell: DnD, realtime sync, seats, cards, navigation, and the default-open desktop log. Closed tools are split into small on-demand chunks.

Completion threshold: keep the board entry below 135 kB gzip. Revisit only when a new optional feature increases the entry or when first-open telemetry justifies idle prefetching.

### 4. Mana font payload

The build now emits only the dependency's 187.40 kB WOFF2. A smaller subset is not currently safe because arbitrary Scryfall mana costs can use numeric, hybrid, Phyrexian, snow, variable, and special symbols.

Completion threshold: keep WOFF2 as the only emitted format. Subset only alongside an explicit supported-symbol contract and visual regression coverage.

### 5. Image residency under large visible zones

Card artwork uses `loading="lazy"` and `decoding="async"`, limiting network and decode pressure. Large linear zone viewers still create one card node per entry because cover-flow positioning, drag reorder, two-finger scrolling, and touch context menus depend on continuous geometry.

Completion threshold: add windowing only after a reproducible 300-card viewer trace demonstrates excessive decoded-image memory or scroll long tasks. A speculative virtualization change was deliberately avoided because it could break overlap, focus, and reorder geometry without measurable evidence.

## Validation

- Full web test suite: 127 files and 786 tests passed.
- TypeScript typecheck passed.
- Production build passed.
- Performance benchmark suite passed with machine-readable JSON output.
- Git whitespace validation passed.

## Measurement environment and caveats

- Apple M2, 16 GB RAM, macOS 26.5
- Bun 1.3.14
- Chrome 149.0.7827.155, headless
- Browser runs used five new contexts with cache isolation and a local production preview.
- Persistence latency uses a controlled 0.05 ms synchronous backing-write cost so results are stable; the write-count reduction is exact, while device-specific elapsed time will vary.
- Server microbenchmarks run in Bun and do not substitute for Cloudflare Durable Object wall-time metrics under network/storage load.
