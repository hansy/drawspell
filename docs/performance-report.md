# Performance audit

Updated: 2026-07-16

## Executive summary

The audit found two distinct critical paths: cold landing startup and full Yjs snapshot reconciliation. The landing route synchronously pulled analytics plus game/Yjs code into its main bundle, while every shared-state update ran quadratic validation work at room-size limits. Both paths are now substantially cheaper, and repeatable client and browser benchmarks are part of the web package.

### Measured results

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Landing main JavaScript (decoded) | 742.19 kB | 392.74 kB | -47.1% |
| Landing main JavaScript (gzip) | 238.10 kB | 126.54 kB | -46.9% |
| Initial game-board chunk (decoded) | 492.45 kB | 426.92 kB | -13.3% |
| Initial game-board chunk (gzip) | 154.14 kB | 131.64 kB | -14.6% |
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
| 800-card / 400-selected membership pass, median | 1.1101 ms | 0.0645 ms | -94.2% |

Browser metrics are medians from five fresh Chrome contexts against local production previews. Local server and machine scheduling introduce normal run-to-run variance; bundle sizes and algorithmic benchmarks are the more deterministic gates.

## Changes applied and validated separately

1. **Made snapshot sanitization linear at room limits.** Reveal limits now use counters instead of repeatedly enumerating growing objects. Zone membership uses sets instead of repeated array scans, and invariant battlefield-grid work is hoisted. Existing sanitizer behavior tests pass.
2. **Deduplicated persisted identity writes.** The large game store persists only session identity fields, but Zustand invokes persistence for every state update. Identical serialized values now skip the synchronous storage write. Tests cover hydration, unchanged values, changes, and removal.
3. **Removed analytics from the critical bundle.** PostHog initializes two seconds after production hydration. No component consumes its React context, so direct delayed initialization avoids remounting the app.
4. **Decoupled the landing route from game/Yjs code.** Game-store and session cleanup modules load only for a prior in-page game runtime or a resume/leave edge case. Fresh visitors do not download them.
5. **Lazy-loaded closed game tools.** Deck import, token creation, zone browsing, opponent reveals, shortcuts, and sharing are separate chunks loaded when opened.
6. **Narrowed battlefield subscriptions.** Each battlefield now observes only the active drag card and source cards needed for its current group-drag ghosts. Ordinary selection changes stay within per-card boolean subscriptions; the parent observes selected IDs only while its own group drag is active. A React Profiler regression test records zero subtree commits for unrelated card and selection updates, down from one commit per update for each path.
7. **Indexed selection membership.** Selection arrays now acquire a weakly cached `Set` on first membership lookup. An 800-card render pass with 400 selected cards falls from 1.1101 ms median with repeated linear scans to 0.0645 ms with the production selector. Battlefield group-drag and ghost rendering also reuse indexed membership, and the inner card controller skips its duplicate lookup when selection state is already supplied by the wrapper.

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

## Remaining findings, ordered by likely impact

### 1. Incremental shared-state reconciliation

`createFullSyncToStore` still snapshots, sanitizes, merges the private overlay, reapplies pending intents, and publishes the full state for every Yjs update. The sanitizer is now fast and linear, but work still scales with the entire room rather than the changed entities.

Next experiment: collect changed Yjs keys per transaction, sanitize only affected records, and batch store publication to at most once per animation frame. Validate with a WebSocket/Yjs update benchmark covering one-card movement in a near-limit room.

### 2. Zustand subscription fan-out

The broad `Battlefield` card and selection subscriptions and repeated selection-array scans are now eliminated. The board controller still observes whole `cards` and `zones` records, and individual card wrappers scan pending-drop arrays with `some`. A single card update can therefore still invalidate the board controller, while pending-drop changes can repeat linear membership work per rendered card.

Next experiment: split controller subscriptions by board concern, pass stable IDs rather than reconstructed collections, and expose pending-drop claims as an indexed lookup. Measure React commit counts and input-to-paint time for dragging one card in 100-, 300-, and 800-card fixtures.

### 3. Board feature splitting and prefetch policy

The board entry is still 426.92 kB decoded / 131.64 kB gzip. DnD, realtime sync, card rendering, and the always-visible board shell are legitimately substantial, but several smaller dialogs and desktop-only surfaces remain eager.

Next experiment: capture a module graph with sourcemaps, split the remaining optional dialogs, then prefetch likely tools after the board becomes interactive so first-open latency remains low.

### 4. Mana font payload

The build emits multiple legacy formats plus a 1.91 MB SVG mana font. Browsers normally select one format, but the app lacks a modern WOFF2 subset and carries many symbols that may never be used in a session.

Next experiment: generate a WOFF2 subset for supported symbols, retain one compatibility fallback only if analytics justify it, and compare game-route font transfer and text-paint timing.

### 5. Image residency under large visible zones

Card artwork already uses `loading="lazy"` and `decoding="async"`, which is good. Large zone viewers can still create many image elements and retain decoded bitmaps. There is no virtualization boundary for very large linear/grouped views.

Next experiment: profile a 300-card library view, add windowing or content-visibility for offscreen cards, and compare decoded image memory, node count, and scroll long tasks.

## Measurement environment and caveats

- Apple M2, 16 GB RAM, macOS 26.5
- Bun 1.3.14
- Chrome 149.0.7827.155, headless
- Browser runs used five new contexts with cache isolation and a local production preview.
- Persistence latency uses a controlled 0.05 ms synchronous backing-write cost so results are stable; the write-count reduction is exact, while device-specific elapsed time will vary.
- Server microbenchmarks run in Bun and do not substitute for Cloudflare Durable Object wall-time metrics under network/storage load.
