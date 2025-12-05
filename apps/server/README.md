# Cloudflare WebSocket Worker (Durable Object)

Run commands from `apps/server`:

- Dev: `wrangler dev --config wrangler.jsonc`
- Deploy: `wrangler deploy --config wrangler.jsonc`
- Endpoint: `wss://<worker-domain>/signal?room=<roomName>` (or `/websocket`; defaults to `room=default`)
- Behavior: echoes messages back to the sender and broadcasts to all other clients connected to the same `room` Durable Object instance.
- Durable Object binding: `WEBSOCKET_SERVER` → class `SignalRoom`.
