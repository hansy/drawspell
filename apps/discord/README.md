# Discord Worker

## What is this?
`apps/discord` is a Cloudflare Worker that handles Discord Interactions for `/drawspell create`, provisions room invites through the internal server binding, and fans out DM links to participants.

## Responsibilities and boundaries
- Verifies Discord interaction signatures.
- Parses `/drawspell create` options and normalizes recipients.
- Calls `POST /rooms` on `apps/server` through a Cloudflare Service Binding.
- Sends participant DMs through Discord REST APIs.
- **Does not** manage room state directly; room lifecycle is handled by `apps/server`.

## Local development
Run these from `apps/discord` (or prefix with `bun run --cwd apps/discord` from the repo root):

```bash
bun run dev
bun run test
bun run test:smoke
bun run cf:typegen
bun run typecheck
bun run build
```

## Configuration

### Required environment variables

| Name | Used by | Description |
| --- | --- | --- |
| `DISCORD_PUBLIC_KEY` | Worker runtime | Discord app public key for interaction signature verification. |
| `DISCORD_BOT_TOKEN` | Worker runtime + command registration script | Bot token used for DM fanout and command registration API calls. |
| `DISCORD_SERVICE_AUTH_SECRET` | Worker runtime | Shared bearer secret used when calling `apps/server` provisioning endpoint. |
| `DISCORD_APPLICATION_ID` | Registration script | Discord application ID used for slash command registration endpoints. |

### Optional environment variables

| Name | Used by | Description |
| --- | --- | --- |
| `DISCORD_COMMAND_GUILD_ID` | Registration script | Default guild for fast command rollout during testing. |
| `DISCORD_API_BASE_URL` | Registration script | Optional Discord API base URL override for command registration (defaults to `https://discord.com/api/v10`). |

### Service binding configuration
- The Worker expects a `SERVER` service binding in [`wrangler.jsonc`](wrangler.jsonc) that targets the matching server worker name.
- Default/prod binding targets `drawspell-server`.
- `env.development` binding targets `drawspell-server-development`, matching local `bun run dev` in `apps/server` (which runs `wrangler dev --env development`).

### Secrets setup with Wrangler
Set secrets per environment before deploy:

```bash
cd apps/discord
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_SERVICE_AUTH_SECRET
wrangler secret put DISCORD_APPLICATION_ID
```

For local development, use `apps/discord/.dev.vars` with equivalent keys for `wrangler dev`.
The command registration CLI now reads process env only.
Invite URL origin comes from the shared host map in `packages/shared/src/constants/hosts.ts`, selected by `apps/server` `NODE_ENV`.

Example local `apps/discord/.dev.vars`:

```dotenv
DISCORD_PUBLIC_KEY=your-public-key
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_SERVICE_AUTH_SECRET=your-service-auth-secret
DISCORD_APPLICATION_ID=your-application-id
```

### Worker `Env` type generation
- `src/worker.ts` uses generated Cloudflare worker types (`Env`) from `worker-configuration.d.ts`; it does not maintain a manual `Env` interface.
- Run `bun run cf:typegen` after changing `wrangler.jsonc` bindings/vars or when adding/removing secret keys used by the worker.
- Wrangler infers secret keys in generated `Env` from local `.dev.vars` during typegen, so missing keys there can produce incomplete `Env` types.
- `worker-configuration.d.ts` is gitignored; every contributor should regenerate it locally as needed.

## Deployment and command registration workflow

1. Deploy the worker:
```bash
bun run deploy
```
2. Export env vars for registration:
```bash
export DISCORD_BOT_TOKEN=your-bot-token
export DISCORD_APPLICATION_ID=your-application-id
```
3. Register `/drawspell` for a test guild (recommended first):
```bash
bun run register:commands -- --guild-id <DISCORD_GUILD_ID>
```
4. Register globally after validation:
```bash
bun run register:commands:global
```

Guild registration propagates quickly for operator testing; global registration can take longer to appear for all guilds.

## Smoke check
After deployment and command registration:

1. Run `bun run test:smoke` from `apps/discord`.
2. In Discord, run `/drawspell create` without tags and confirm the invoker receives a DM with the expected environment-specific web origin (`http://localhost:5173`, `https://drawspell-staging.service-fff.workers.dev`, or `https://drawspell.space`) in `/rooms/<roomId>?gt=<playerToken>`.

## Key files
- [src/worker.ts](src/worker.ts)
- [src/registerCommands.ts](src/registerCommands.ts)
- [src/__tests__/discordRoomCommand.integration.test.ts](src/__tests__/discordRoomCommand.integration.test.ts)
- [wrangler.jsonc](wrangler.jsonc)

## Related docs
- [../../README.md](../../README.md)
- [../server/README.md](../server/README.md)
