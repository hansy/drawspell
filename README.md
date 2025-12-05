# mtg monorepo

This repository now uses Bun workspaces with two apps:

- `apps/web`: TanStack React Start frontend (Cloudflare SSR).
- `apps/server`: Cloudflare Durable Object WebSocket worker.

## Usage

From the repo root:

```bash
bun install
bun run dev           # web app
bun run dev:server    # websocket worker
```

Other helpful scripts:

- `bun run build` / `bun run preview` – build and preview the web app
- `bun run deploy:web` – deploy the web app worker via `wrangler`
- `bun run deploy:server` – deploy the Durable Object worker
- `bun run ws:dev` – start the Durable Object worker from the web workspace

Vite env vars now live in `apps/web/.env`; `VITE_WEBSOCKET_SERVER` is required (no in-code fallback).
