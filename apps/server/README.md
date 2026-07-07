# Server

## What is this?
Drawspell's realtime backend, built on PartyServer and Cloudflare Durable Objects. It hosts the authoritative Yjs document for each room, applies intents, and manages hidden state. Path: `apps/server`.

## Responsibilities and boundaries
- Owns the authoritative Yjs state for a room and persists it in Durable Object storage.
- Applies intents and permission checks, and sends private overlays to viewers.
- Issues and validates player/spectator room tokens.
- **Does not** render UI or fetch Scryfall data; those are handled by `apps/web`.

## Public API
- PartyServer room name: `rooms` (see `src/server.ts` and `apps/web/src/partykit/config.ts`).
- Connection roles via query params: `role=sync` (Yjs provider) and `role=intent` (intent channel). Tokens are passed via `gt` (player) or `st` (spectator), along with optional `playerId` and `viewerRole` (see `apps/web/src/partykit/intentSocket.ts` and `apps/web/src/hooks/game/multiplayer-sync/sessionResources.ts`).
- Message envelopes: `intent`, `ack`, `privateOverlay`, `logEvent`, `roomTokens` (see `apps/web/src/partykit/messages.ts` and `src/domain/types.ts`).
- Internal provisioning endpoint: `POST /rooms` with bearer service auth; idempotent per `interactionId`, returns `{ roomId, playerToken, playerInviteUrl, expiresAt, alreadyProvisioned }` where `playerInviteUrl` is absolute (`<known web origin>/rooms/<roomId>?gt=<playerToken>`), and stores pending Discord invite metadata in room Durable Object storage.
- Other non-Party requests return `404` (see `src/server.ts`).

### Internal Discord provisioning contract (`POST /rooms`)
- Auth: `Authorization: Bearer <DISCORD_SERVICE_AUTH_SECRET>`.
- Request body:
  - `interactionId: string` (idempotency key from Discord interaction payload)
  - `guildId: string`
  - `channelId: string`
  - `invokerDiscordUserId: string`
  - `participantDiscordUserIds: string[]`
- Behavior:
  - Derives deterministic room id from `interactionId`.
  - Returns `alreadyProvisioned: true` when the same interaction is replayed.
  - Stores invite metadata in room DO storage for join gating.

## Local development
Run these from `apps/server` (or prefix with `bun run --cwd apps/server` from the repo root):

```bash
bun run dev
bun run dev:app
bun run build
bun run deploy
bun run deploy:staging
bun run test
bun run typecheck
```

`bun run dev` runs through Portless at `https://server.ds.localhost`. The
underlying Wrangler command is `bun run dev:app`; Portless assigns an ephemeral
port through `PORT`, and the script passes that port to Wrangler.

## Configuration
- Durable Object binding `rooms` is defined in `wrangler.jsonc` and is required for local/dev/prod.
- Compatibility dates are set in `wrangler.jsonc` and `partykit.json`.
- Env vars:
  - `NODE_ENV` (required): must be `development`, `staging`, or `production`; used to resolve Drawspell hosts from `@mtg/shared/constants/hosts`.
  - `JOIN_TOKEN_SECRET` (required): HMAC secret used to validate join tokens. Must match `apps/web`.
  - `DISCORD_SERVICE_AUTH_SECRET` (required for Discord provisioning): shared secret used to authenticate internal `/rooms` calls.

For local dev, set secrets in `apps/server/.dev.vars` or via `wrangler secret put JOIN_TOKEN_SECRET`.
Development accepts websocket requests from any `Origin` and `Host` so multiple
agents can run separate Portless instances without editing allowlists. Staging
and production remain restricted to configured Drawspell origins.

## Durable Object duration checks
Use `bun run do:metrics` to inspect Cloudflare Durable Object duration around a
server deploy. The script reads `CLOUDFLARE_ACCOUNT_ID`/`CF_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`/`CF_API_TOKEN`; when no token is provided locally, it can
use Wrangler's OAuth config.

Daily post-deploy verification:

```bash
bun run do:metrics -- --account <cloudflare-account-id> --deployAt latest --checkDaily --durationLimitSec 86400 --pretty
```

The daily check compares a full pre-deploy day to the first full post-deploy day
and includes a `dailyCheck` object in stdout JSON. Exit codes:

- `0`: the settled daily check passed.
- `2`: Cloudflare data is not ready yet; inspect `dailyCheck.readyAt`.
- `3`: the daily check failed or Cloudflare returned a truncated metrics window.

## Key files
- [src/server.ts](src/server.ts)
- [src/domain/intents/applyIntentToDoc.ts](src/domain/intents/applyIntentToDoc.ts)
- [src/domain/hiddenState.ts](src/domain/hiddenState.ts)
- [src/domain/overlay.ts](src/domain/overlay.ts)
- [src/domain/permissions.ts](src/domain/permissions.ts)
- [scripts/do-metrics.ts](scripts/do-metrics.ts)
- [wrangler.jsonc](wrangler.jsonc)
- [partykit.json](partykit.json)

## Tests
`bun run test` (Vitest).

## Related docs
- [../../README.md](../../README.md)
- [../web/README.md](../web/README.md)
