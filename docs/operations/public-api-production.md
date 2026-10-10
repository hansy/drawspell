# Public API production rollout

Deployed October 10, 2026. The web app, room server, and Discord worker use the public room API implementation.

## Resources

- Web: `drawspell-web-production`, https://drawspell.space
- Room server: `drawspell-server-production`, https://ws.drawspell.space
- Discord: `drawspell-discord-production`, https://discord.drawspell.space
- D1: `drawspell-developers-production`, ID `92e58273-8e41-4653-b2c8-7cbca9d3a948`; migrations 0001 and 0002 applied.
- Email Sending enabled for `drawspell.space`, with SPF, DKIM, return-path MX, and DMARC records published. Sender: `Drawspell <support@drawspell.space>`.

## Credentials

Production `BETTER_AUTH_SECRET` is installed on web. Matching `ROOM_PROVISION_SECRET` values are installed on web and server. Existing `JOIN_TOKEN_SECRET` values were preserved. No local auth test capture is enabled in production.

Discord uses a dedicated service account (`drawspell-service-discord`, reserved non-deliverable address `discord@service.drawspell.invalid`) and a key named `Discord room creation`. Its secret is stored as `DRAWSPELL_API_KEY` in the Discord worker. Rotate through Better Auth's server-side API-key API for this service account, update the worker secret, then revoke the previous key. This service account has no interactive email login.

The temporary `drawspell-service-deployment-smoke` account is suspended and its test key revoked. Test rooms use the standard idle/activation expiry. Retain the legacy server `/rooms` route and `DISCORD_SERVICE_AUTH_SECRET` for this compatibility release.

## Deployed versions

| Worker | Version |
| --- | --- |
| Web | `d5153b8c-773a-4ef9-bad3-c415a14eaeb3` |
| Server | `8d6edeec-c3fd-4483-8e99-71f8aef98f83` |
| Discord | `c82acc7c-e4dc-4092-ba89-3557355cae78` |

## Verification

All 1,350 automated tests, workspace typechecks, and the production build passed before deployment. Live checks passed for default room creation, personal invitations with and without decks, bracket metadata, disabled spectators, identical replay, conflicting replay, invalid fields, duplicate players, excess players, invalid brackets, and revoked credentials.

A production browser joined a personal invitation, received its deck, observed the server deck-load event, and confirmed no spectator credential in room-token storage. Public docs and the developer sign-in redirect rendered successfully. The dedicated Discord API key created a default room; unsigned Discord requests were rejected. No Discord messages were sent by deployment checks.

Magic-link inbox delivery remains unverified pending a user-provided test recipient.
