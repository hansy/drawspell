# Web App

## What is this?
Drawspell's web client, built with TanStack React Start and Vite. It renders the multiplayer board UI, manages client-side state, and connects to the realtime PartyServer. Path: `apps/web`.

## Responsibilities and boundaries
- Owns the UI, routing, and client-side stores (`src/store`, `src/components`, `src/routes`).
- Manages client sync setup (Yjs provider + intent socket) and local overlays.
- Fetches card data from Scryfall and caches it locally.
- **Does not** apply authoritative game rules or permissions; that happens in `apps/server`.

## Public API
- Routes: `/` and `/rooms/$sessionId` (see `src/routes`).
- Invite tokens are accepted via query params `gt` (player) and `st` (spectator) on the game route (see `src/lib/partyKitToken.ts`).
- PartyServer message types used by the client are defined in `src/partykit/messages.ts`.

## Local development
Run these from `apps/web` (or prefix with `bun run --cwd apps/web` from the repo root):

```bash
bun run dev
bun run build
bun run build:staging
bun run build:production
bun run preview
bun run test
bun run typecheck
bun run cf:typegen
bun run deploy
bun run deploy:staging
```

`bun run dev` runs through Portless at `https://ds.localhost`. The underlying
Vite command is `bun run dev:app` and uses Vite mode `localhost`, which loads
`apps/web/.env.localhost`.

## Configuration
- Drawspell web/server origins are resolved from `@mtg/shared/constants/hosts` using `import.meta.env.VITE_ENV`.
- `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST`: public analytics build vars loaded from `apps/web/.env*`.
- `JOIN_TOKEN_SECRET`: required runtime secret for issuing join tokens. Must match the secret used by `apps/server`. Set it with `wrangler secret put JOIN_TOKEN_SECRET` for production and `apps/web/.dev.vars` for local dev.
- Worker runtime deploy config lives in `wrangler.jsonc`. `VITE_ENV` is injected from Vite mode for browser code and also set in Cloudflare worker vars.

## Key files
- [src/routes/index.tsx](src/routes/index.tsx)
- [src/routes/rooms.$sessionId.tsx](src/routes/rooms.$sessionId.tsx)
- [src/components/game/board/MultiplayerBoardView.tsx](src/components/game/board/MultiplayerBoardView.tsx)
- [src/hooks/game/multiplayer-sync/sessionResources.ts](src/hooks/game/multiplayer-sync/sessionResources.ts)
- [src/store/gameStore.ts](src/store/gameStore.ts)
- [src/services/deck-import/](src/services/deck-import/)
- [src/services/scryfall/scryfallCache.ts](src/services/scryfall/scryfallCache.ts)
- [src/partykit/messages.ts](src/partykit/messages.ts)

## Tests
`bun run test` (Vitest; config in `vitest.config.ts`).

## Related docs
- [../../README.md](../../README.md)
- [../server/README.md](../server/README.md)
- [../../docs/features/curated-decks.md](../../docs/features/curated-decks.md)

## Developer API

`/auth/login` signs developers in by magic link. `/developers` creates and
revokes named API keys; `/docs` describes `POST /api/v1/rooms`. Personal room
invitations use `?invite=...` to reference private, server-stored starting decks.
The [API contract](../../docs/features/public-room-api-contract.md) records limits,
retry semantics, and the distinction between original assignments and imported cards.

Before deploying an environment:

1. Create its D1 database and set its `database_id` in `wrangler.jsonc`.
   IDs are intentionally omitted, which is supported by Wrangler automatic
   provisioning; no fictitious database IDs are deployed. Provision explicitly
   before the first release so migrations can run before requests reach the API.
   Apply `migrations` with `bunx wrangler d1 migrations apply DB --remote --env staging`
   (or `production`).
2. Set `BETTER_AUTH_SECRET` to a random secret of at least 32 characters. Set
   `ROOM_PROVISION_SECRET` on both web and server Workers to the same random value.
   Keep the existing matching `JOIN_TOKEN_SECRET` configuration.
3. Configure the `EMAIL` binding and a verified `EMAIL_FROM` sender for transactional
   delivery. `AUTH_URL` must be the exact website origin. Confirm the `SERVER`
   binding points at the matching room Worker environment.
4. Issue a dedicated developer key for Discord, configure `DRAWSPELL_API_KEY`
   there, and deploy its new `API` service binding after the web endpoint is ready.
   Keep the legacy server `/rooms` endpoint and its service secret for this
   compatibility release; remove them only after all Discord callers migrate.
   Already-issued room invitations remain supported.

For the local browser check, apply D1 migrations with
`bunx wrangler d1 migrations apply DB --local`. Configure the matching secrets in
ignored `.dev.vars` files and set `AUTH_URL=https://ds.localhost`. In the web file,
set a nonempty `AUTH_TEST_SECRET` to capture magic links in local D1 instead of
sending email. This capture is development-only and has no HTTP read endpoint.
Start the room Worker, then start the web Worker with `VITE_ENV=development bun run dev`.
From `apps/web`, run `bun run test:e2e:public-api` with Chrome installed
(or set `CHROME_PATH`). The check reads only the local mail outbox, creates test
rooms and a temporary developer account, and revokes its API key when successful.
Never enable the local mail capture in deployed development environments.
