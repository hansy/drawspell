# Discord Worker

## What is this?
`apps/discord` is a Cloudflare Worker that handles Discord Interactions for `/drawspell room`, provisions room invites through the internal server binding, and fans out DM links to participants.

## Responsibilities and boundaries
- Verifies Discord interaction signatures.
- Parses `/drawspell room` options and normalizes recipients.
- Calls `POST /internal/discord/rooms/provision` on `apps/server` through a Cloudflare Service Binding.
- Sends participant DMs through Discord REST APIs.
- **Does not** manage room state directly; room lifecycle is handled by `apps/server`.

## Local development
Run these from `apps/discord` (or prefix with `bun run --cwd apps/discord` from the repo root):

```bash
bun run dev
bun run test
bun run test:smoke
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
| `DISCORD_API_BASE_URL` | Worker runtime + registration script | Override Discord API base URL (defaults to `https://discord.com/api/v10`). |

### Service binding configuration
- The Worker expects a `SERVER` service binding in [`wrangler.jsonc`](wrangler.jsonc) that targets the deployed server worker.
- Update the bound service name per environment (for example, staging vs production) so Discord provisioning calls reach the matching `apps/server` deployment.

### Secrets setup with Wrangler
Set secrets per environment before deploy:

```bash
cd apps/discord
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_SERVICE_AUTH_SECRET
wrangler secret put DISCORD_APPLICATION_ID
```

For local development, use `apps/discord/.dev.vars` with equivalent keys. The command registration CLI automatically reads `.dev.vars` by default, and process env vars override file values.

## Deployment and command registration workflow

1. Deploy the worker:
```bash
bun run deploy
```
2. Register `/drawspell` for a test guild (recommended first):
```bash
bun run register:commands -- --guild-id <DISCORD_GUILD_ID>
```
3. Register globally after validation:
```bash
bun run register:commands:global
```

Optional: specify an alternate env file for registration:
```bash
bun run register:commands -- --env-file .dev.vars.staging --guild-id <DISCORD_GUILD_ID>
```

Guild registration propagates quickly for operator testing; global registration can take longer to appear for all guilds.

## Smoke check
After deployment and command registration:

1. Run `bun run test:smoke` from `apps/discord`.
2. In Discord, run `/drawspell room` without tags and confirm the invoker receives a DM with `/game/<roomId>?gt=<playerToken>`.

## Key files
- [src/worker.ts](src/worker.ts)
- [src/registerCommands.ts](src/registerCommands.ts)
- [src/__tests__/discordRoomCommand.integration.test.ts](src/__tests__/discordRoomCommand.integration.test.ts)
- [wrangler.jsonc](wrangler.jsonc)

## Related docs
- [../../README.md](../../README.md)
- [../server/README.md](../server/README.md)
