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
bun run cf-typegen
bun run deploy
bun run deploy:staging
```

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
