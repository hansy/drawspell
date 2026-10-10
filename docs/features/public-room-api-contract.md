# Public Room API — Agreed Contract

Status: design agreed on 2026-10-09. Implementation authorized on 2026-10-09 and completed locally. Deployment remains pending.

This contract develops the decisions in [the planning notes](public-room-api-planning.md). Initial deck lists and bracket assessments are trusted submissions from the authenticated developer; imported card contents are not verified against those submissions.

## Developer access

- `/auth/login`: Better Auth magic-link sign-in.
- `/developers`: session-protected create/list/revoke of named API keys. Show the full secret only on creation; allow up to five active keys per developer.
- Authentication and key-list loading run on the server before rendering. Signed-out page requests redirect to `/auth/login` with HTTP 303; unauthenticated key API requests return 401. Suspended accounts receive 403. Private responses are not cached. Legacy `/developer` and `/developer/login` URLs redirect to their new locations.
- `/docs`: public authentication, room-creation, examples, limits, errors, and invitation documentation.
- API requests use `Authorization: Bearer <api-key>` with permission to create rooms. Developer browser sessions and room-player credentials remain separate.
- Room creation allows ten requests per minute per developer across their keys; rate-limited responses include `Retry-After`.

## Create a Room

URL: `POST https://drawspell.space/api/v1/rooms`.

Required headers:

```http
Authorization: Bearer <api-key>
Content-Type: application/json
Idempotency-Key: <unique-key-for-this-create-operation>
```

The retry key is required and scoped to the developer account, so rotating API credentials does not change the identity of a previous create operation.

Example request:

```json
{
  "spectatorsEnabled": false,
  "players": [
    {
      "externalId": "participant-123",
      "deck": {
        "decklist": "Commander:\n1 Atraxa, Praetors' Voice\nMain:\n1 Sol Ring",
        "bracket": 3
      }
    },
    {
      "externalId": "participant-456"
    }
  ]
}
```

The example list is abbreviated. The endpoint does not enforce format legality or completeness.

Schema:

| Field | Meaning |
| --- | --- |
| `spectatorsEnabled` | Optional boolean, defaults to `true`; fixed for the Room's lifetime. |
| `players` | Optional list of up to four personal invitation assignments. Omitted or empty means only a shared player invitation is needed. This list does not reserve seats or restrict other players from joining. |
| `players[].externalId` | Required nonempty string when a player entry is supplied; unique within the request. Used to correlate returned links, not as authentication or a Drawspell player ID. |
| `players[].deck` | Optional initial deck assignment. Without it, the player imports normally. |
| `players[].deck.decklist` | Required string when `deck` is supplied. Stored without card lookup; consumed by normal Deck Import after joining. |
| `players[].deck.bracket` | Optional integer from 1 through 5, supplied by the external site. Stored with the list, not displayed in the first version. |

Arbitrary metadata, preset display names, and update endpoints are outside the first version.

Request processing enforces authentication, bounded request/deck-list sizes, basic structure, and player-entry limits. It does not query Scryfall, assess a bracket, check card existence, or validate deck legality. Invalid request structure rejects the request as a whole; an unknown card name does not.

## Successful response

First creation returns `201 Created` with `Cache-Control: no-store`:

```json
{
  "roomId": "abc123",
  "spectatorsEnabled": false,
  "activationExpiresAt": "2026-10-09T18:10:00.000Z",
  "playerInviteUrl": "https://drawspell.space/rooms/abc123?gt=...",
  "players": [
    {
      "externalId": "participant-123",
      "joinUrl": "https://drawspell.space/rooms/abc123?invite=..."
    },
    {
      "externalId": "participant-456",
      "joinUrl": "https://drawspell.space/rooms/abc123?invite=..."
    }
  ]
}
```

- Always return the shared `playerInviteUrl`, including when personal invitations exist.
- Return `players: []` when no assignments were supplied.
- Include `spectatorInviteUrl` only when spectators are enabled. No disabled spectator credential is minted or sent through any other room response.
- `activationExpiresAt` is the deadline for the first player to activate the Room, not a fixed end time for an active Room. Retain the ten-minute activation window and normal activated Room lifecycle.
- Return invitation URLs rather than redundant raw credentials. Do not return stored deck lists in the creation response or broadcast all assignments to Room participants.
- Personal invitation tokens reference stored assignments; changing browser parameters cannot modify those stored assignments. They do not prove who the recipient is, guarantee a seat, or establish that imported cards match the assignment.

## Joining and import behavior

Shared player invitations preserve normal admission without a preloaded assignment. Personal invitations authorize ordinary player entry and supply the associated starting list and optional bracket. Keep existing player identity, reconnect, and device-switch behavior; do not add one-time claim infrastructure.

The normal client Deck Import automatically starts for a newly admitted player with a supplied list. Reconnection must not overwrite an existing deck or rerun a previously completed preload, including after the player has chosen a replacement. If preload fails, stay in the Room and show the supplied list and ordinary import error, allowing correction or another deck.

All successful Deck Imports produce the same server-authored “<player> loaded a deck” Game Log Event, including preloads and ordinary app-room imports. Resetting or reconnecting is not another Deck Import. No card-to-assignment verification, deck lock, bracket display, or automatic bracket invalidation is added.

## Retries and lifetime

- Require an `Idempotency-Key` for each logical create operation.
- Within a 24-hour retention window, the same account and key with the same normalized request return the original response, without replacing settings, invitations, deck lists, or activation deadline. Replay uses `200 OK` and `Idempotency-Replayed: true`.
- The same key with different normalized content returns `409 Conflict`.
- If the original Room is expired or gone, a retry returns `410 Gone`; it must not recreate or reactivate that Room. The caller uses a new key for a new Room.
- After the retention window, the API makes no replay guarantee; callers should always generate a new key for a new operation.
- Retry bookkeeping must survive Room cleanup for the promised retention window. Provisioning recovery must also handle a timeout after a Room was created but before the response was recorded.

## Errors

Errors describe the request or operation; there is no per-player deck-validation result:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "players contains duplicate externalId values."
  }
}
```

Status mapping: `400` malformed JSON/schema/header, `401` absent or invalid key, `403` insufficient permission or suspended developer, `409` conflicting retry, `410` original Room expired/gone, `413` request exceeds size bounds, `415` unsupported content type, `429` rate limit, and `5xx` provisioning/service failure. Never echo submitted credentials or deck-list contents in diagnostics.

## Implementation sequence

Placement: host developer auth, key management, docs, and the public HTTP endpoint in the existing `apps/web` TanStack Start Worker. Add D1 for developer/auth and retry records, an email binding for magic links, and a service binding to `apps/server`. The Room Durable Object remains responsible for Room state, settings, invitations, and credentials. Discord will call the web API through a service binding using its own API credential, then continue delivering invitations through its existing flow. A private web-to-room provisioning boundary remains necessary; replacing the Discord-specific public contract does not mean exposing all internal transport routes.

1. Add developer identity/storage and magic-link delivery using Poof's established approach; build key management and session/permission boundaries. Keep Room participants anonymous.
2. Extract shared room provisioning/settings behavior from Discord-specific handling and the current lazy app initialization. Persist creation settings before credentials can be issued. Verify spectator rejection in both connection channels and optional spectator-link responses in the UI.
3. Add the authenticated versioned endpoint, request bounds, per-developer limits, and recoverable idempotent creation. Public callers and Discord should use the same contract; private Worker-to-Room transport may remain an implementation detail.
4. Add stored per-player assignments and personal join URLs, using existing admission and client Deck Import. Keep preload data private to the relevant invitation and bind stored bracket data to the original list.
5. Emit the generic successful Deck Import event from the server and render it in the ordinary Game Log. Check actual server acceptance before calling an import successful; the current client dispatches several intents without awaiting their acknowledgements.
6. Migrate Discord with compatible default behavior and retire its old external provisioning route after caller migration. Preserve already-issued invitations and stored room state during rollout.
7. Publish basic API docs and exercise the full developer-to-room flow in staging before any production rollout.

Focused verification includes invalid/revoked credentials, account-wide quota/key limits, duplicate/concurrent retry recovery, expired Room retries, spectator access through both token types/channels, unchanged default app/Discord flows, correct private assignment delivery, failed preload fallback, reconnect without repeat import, ordinary deck swaps, and one public load event per successful import.
