# Public Room API — Planning

Status: design interview complete; contract agreed on 2026-10-09. Implementation authorized on 2026-10-09 and completed locally. Deployment remains pending.

The [agreed API contract and implementation sequence](public-room-api-contract.md) consolidate the request/response shape, endpoint placement, and retry lifetime. The user authorized implementation after accepting this design. Production deployment is not part of this implementation run.

Interview convention: the user accepts recommendations for questions they do not directly address. Explicit answers override the recommendation, including when the answer defers or removes the question from scope.

## Settled requirements

- Provide an authenticated public API for room creation and migrate suitable internal callers, including Discord, to the shared contract.
- Keep room initialization, token issuance, and admission rules shared with the normal app flow.
- A persisted Room setting controls spectator access. When disabled, no spectator credential or link is created or transmitted, the sharing option is absent, and the server rejects spectator admission even with player credentials.
- Room creation may include optional deck lists for individual players. The external site knows the lists beforehand and is responsible for their Bracket Tiers.
- Drawspell stores submitted deck lists and ratings. Browser-edited parameters cannot change the trusted initial assignment.
- The integrity guarantee covers the stored API-submitted list and Bracket Tier only. The ordinary browser-driven importer remains in use; the server does not prove that imported card objects match the stored list. Do not describe the actual imported deck as tamper-proof.
- Players may swap decks. A successful Deck Import emits “<player> loaded a deck” in all Rooms; no deck locking, mismatch detection, or automatic bracket invalidation is required.
- Developer access is self-service through a basic `/developers` page using Better Auth and magic links only, with API-key issuance and basic public documentation. Follow Poof's developer flow; OAuth is explicitly out of scope.
- Developer accounts can create named keys, see a secret once, list keys, and revoke them. Start with at most five active keys and ten room-creation requests per minute per developer, shared across their keys. Room players remain anonymous; developer login is only for API access management.
- Require an `Idempotency-Key` scoped to the developer account and retain retry records for 24 hours: identical retries return the original room and invitations, while different content with the same key returns a conflict. If the original Room expired or was deleted, return an expired-room error without recreating it; a new creation requires a new key. Retry retention does not extend Room lifetime.
- Supplying personal player invitations does not make the player list exclusive. Players can share a normal player invitation so additional people can join, subject to the existing four-player capacity.
- Do not add a bespoke single-use invitation claim/recovery system for the first version. Keep invitation reuse and device handling simple; exact integration with existing admission remains to be worked out.
- Room creation performs basic request-structure and input-size checks, stores the supplied deck lists, and returns invitation URLs. It performs no card lookup or deck-legality validation, and returns no per-player deck errors. Unknown cards and import failures are handled during the normal client-side Deck Import. Basic malformed or oversized requests and invalid authentication can still be rejected.
- If automatic Deck Import fails, the player stays in the Room with the supplied list visible in the ordinary import screen and can correct it or choose another deck. Reuse the normal import error UI rather than adding a special recovery flow.
- Store an optional Bracket Tier integer from 1 through 5 with a supplied deck, without adding bracket UI. Arbitrary metadata and preset display names are outside the first version.
- Spectator access is fixed at room creation for the Room's lifetime.
- Spectators default to enabled, matching normal app-created Rooms. API callers explicitly send `spectatorsEnabled: false` when spectators must be prevented.
- Retain the existing ten-minute activation window for an unused provisioned Room and the normal activated Room lifecycle (about 32 minutes without connected players before cleanup).

## Invitation contract

- A personal invitation per listed player refers to that player's stored initial assignment.
- A caller-provided external identifier correlates each returned invitation with its recipient; it does not authenticate the person.
- Creation without player assignments retains the shared player invitation flow.
- Reconnecting resumes the same player without repeating the initial Deck Import.

## Design tree

- API callers and authority
  - Self-service magic-link developer access, key management, initial quotas, and account-scoped idempotent retries are settled.
- Player admission
  - Shared invitations remain available alongside personal invitations; listed players are not an exclusive roster.
  - No additional single-use claim/recovery machinery is requested.
  - A personal invitation supplies a stored starting assignment through ordinary admission; reconnect does not repeat a completed preload. No seat reservation or external identity verification is added.
- Preloaded Deck lifecycle
  - Creation stores bounded, structurally acceptable input without card lookup; no per-player deck errors in its response.
  - Import errors are handled in the ordinary client import UI after joining; players can fix or replace the list.
  - The stored assignment is protected, but browser-submitted cards are not checked against it. The user explicitly accepted this scope; no additional deck-provenance verification is required.
- Bracket Tier presentation
  - No bracket UI in this version.
  - Optional integer 1–5 attached to a supplied deck. No arbitrary metadata or preset display names.
- Room configuration and lifecycle
  - Spectator access is immutable for the Room's lifetime.
  - Spectators are enabled by default; callers explicitly disable them.
  - Retain the current ten-minute activation window and normal Room cleanup.
  - Preload data follows Room cleanup; retry records have their own 24-hour lifetime.
- Migration
  - Web already runs on a Worker; place `/api/v1/rooms` alongside `/developers` and `/docs`, with a new service binding to the existing Room server.
  - Discord can migrate to that contract through a service binding; retain private web-to-Room transport and preserve already-issued invitations.
  - Room teardown clears all provisioning state, so 24-hour replay records must live outside Room storage and must not revive expired Rooms.

## Terminology

The glossary calls the operation **Deck Import**, while the player-facing event says “loaded a deck.” Keep those meanings aligned; **Preloaded Deck** describes the initial supplied list, and **Bracket Tier** belongs to that list rather than to the player.

## Reference findings

### Poof developer access

Inspected `/Users/hansy/projects/poof` on 2026-10-09. Poof has `/developer`, `/developer/login`, and `/docs`; its actual authentication currently uses magic links only, without OAuth providers. The user chose magic links only for Drawspell as well.

- `packages/auth/src/index.ts`: shared Better Auth configuration with Drizzle/D1, magic links, API-key management, and server-side Bearer verification. Developer sessions and API-key permissions are separate.
- `apps/web/src/routes/developer.tsx`: named keys, show the secret once, list and revoke; maximum five active keys.
- `apps/web/src/server/developer-auth.ts`: Cloudflare EMAIL binding delivers magic links.
- `apps/api/src/developer-api.ts`: account quota shared across keys (default ten requests/minute), account suspension checks, and IP limits.
- `apps/web/src/routes/docs.tsx`: ordinary TanStack Router documentation page; public `docs.md` and `llms.txt` also exist.

These are reference facts, not automatic adoption of every Poof feature. Its 4 KiB room-create body cap must be adjusted for optional Drawspell deck lists. Drawspell still rejects malformed overall requests, but does no card lookup and returns no per-player deck-validation results.

### Existing Deck Import

Drawspell's browser parses the deck list, checks library and commander counts, resolves cards through Scryfall, and verifies resolution before submitting card additions. The parser accepts unrecognized nonempty lines as card names; it does not provide strict per-line syntax errors. Unknown cards cannot be identified by basic type/size checks alone.

Creation performs no external lookup and returns no per-player deck errors. Card-resolution errors remain join-time import errors. A stored deck list must not be labeled as card-validated merely because it passed input bounds.

The current browser constructs card-addition batches and the server checks permissions but not their correspondence to an original deck list. Import batches, the loaded marker, and shuffle are separate intents. Merely storing a trusted list does not make that browser-driven import resistant to a modified client. This is distinct from protecting the original list and bracket against browser edits.
