# Connection Resilience Plan

## Goals
- Stop noisy "Network connection lost" logs from aborted WebSocket upgrades.
- Prevent reconnect storms when the server restarts or drops.
- Avoid intent payload bursts after reconnects.
- Pause reconnection while the tab is hidden or the browser is offline.

## Non-Goals
- Consolidating sync + intent into a single socket (future).
- Server-side rate limiting beyond basic guardrails (future).

## Phases and Tasks

### Phase 1: Worker boundary guard (log noise)
- [ ] Wrap `routePartykitRequest()` in `apps/server/src/server.ts` with try/catch.
- [ ] Suppress only the "Network connection lost" error on WebSocket upgrades.
- [ ] Preserve existing behavior for all other errors.
- [ ] Validation: run server typecheck/tests.

### Phase 2: Intent transport hardening
- [ ] Add PartySocket socket options (disable auto-reconnect, disable enqueue).
- [ ] Prevent intent sends when the socket is not open.
- [ ] Ensure intent reconnect uses fresh tokens/role.
- [ ] Validation: run web typecheck/tests.

### Phase 3: Connection supervisor + backoff
- [ ] Introduce a shared backoff utility (full jitter + room-reset cooldown).
- [ ] Add offline/hidden gating (pause reconnect, teardown transports).
- [ ] Tear down both transports on any close and schedule reconnect via backoff.
- [ ] Reset backoff after a stable connection window.
- [ ] Add targeted tests for backoff and hook behavior.
- [ ] Validation: run full test + typecheck.

## Connection State Machine (Client)

States:
- stopped
- blocked-auth
- offline (hidden/offline)
- cooldown
- connecting
- connected

Transitions (high level):
- start -> connecting (unless offline/blocked)
- close -> cooldown (room reset uses longer delay)
- auth failure -> blocked-auth
- hidden/offline -> offline (disconnect)
- visible/online -> cooldown -> connecting
- connected stable for 10s -> reset backoff

## Backoff Policy
- Full jitter: delay = random(0, min(maxDelay, base * 2^attempt))
- base = 1000ms, maxDelay = 30000ms
- room reset (1013) => delay random(5000..15000) and increment attempt
- stable connection for 10s => reset attempt to 0

## Acceptance Criteria
- No "Uncaught Error: Network connection lost" spam on server restarts.
- Reconnect attempts are rate-limited with jitter and shared gating.
- Intent sends are dropped (not queued) while disconnected.
- Sync + intent reconnect together, not independently.
- Tests + typecheck green.
