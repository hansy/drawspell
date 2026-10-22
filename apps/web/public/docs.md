Source: https://drawspell.space/docs

# Drawspell API

Connect your app to Drawspell.

Base URL `https://drawspell.space/api/v1`

## Authentication

[Sign into the developer portal](https://drawspell.space/developers) and create an API key in your dashboard.

Send it in the `Authorization` header with every API request.

```
Authorization: Bearer YOUR_API_KEY
```

Manage up to five active keys in [your dashboard](https://drawspell.space/developers).

Missing, invalid, or revoked keys return `401 unauthorized`. Disabled accounts or insufficient permissions return `403 forbidden`.

## Create a room

Create a room with optional preloaded decks and personal invitations.

POST `/api/v1/rooms`

### Headers

**`Authorization` required**

Bearer API key. See [authentication](https://drawspell.space/docs#authentication).

**`Content-Type` required**

`application/json`

**`Idempotency-Key` required**

Unique per creation; 1–128 visible ASCII characters.

### Body

Send `{}` for a default room. Maximum 160 KiB; no unknown fields.

**`displaySpectatorLink` boolean · optional**

Defaults to true. Set false to hide the spectator link from players. The API still returns the link.

**`players` object\[\] · optional**

Up to four personal invitations. Each item contains:

**`players[].externalId` string · required**

Your player identifier. 1–128 characters; unique within this request.

**`players[].deck` object · optional**

Deck assigned to this player’s personal link.

**`players[].deck.decklist` string · required**

Deck text to preload. Up to 32 KiB.

**`players[].deck.bracket` integer · optional**

1–5. Stored without display.

### Response

**`playerInviteUrl` shared**

Anyone with the link can join an available seat.

**`players[].joinUrl` personal**

Send to the matching `externalId`. Loads their assigned deck; no seat reservation or identity check.

**`spectatorLink` string**

Always returned to the API caller. Anyone with this link can watch. When displaySpectatorLink is false, players cannot retrieve the link from the app.

**`activationExpiresAt` ISO date**

First player must join within 24 hours. Active games continue past this deadline.

### Safe retries

Reuse the same key and content for up to 24 hours. Replays return `200` with `Idempotency-Replayed: true`. Different content returns `409`; a room that is gone returns `410`.

### 10 requests / minute

Shared across your account’s keys, including retries and rejected requests. On `429`, wait for `Retry-After` seconds.

Error reference Statuses, codes, and a JSON example

API error codes
| Status | Code / action |
| --- | --- |
| 400 | `invalid_request` Check JSON, fields, and required headers. |
| 401 | `unauthorized` Use an active API key. |
| 403 | `forbidden` Account disabled or rooms:create permission missing. |
| 409 | `idempotency_conflict` Use a new key for different content. |
| 410 | `room_gone` Room expired or was deleted. Create a new one. |
| 413 | `body_too_large` Reduce the request to 160 KiB or less. |
| 415 | `unsupported_media_type` Send Content-Type: application/json. |
| 429 | `rate_limited` Wait for Retry-After seconds. |
| 503 | `service_unavailable` Retry with the same Idempotency-Key. |

## Code examples

### cURL

```bash
curl https://drawspell.space/api/v1/rooms \
  -H "Authorization: Bearer $DRAWSPELL_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: match-123" \
  --data '{
  "displaySpectatorLink": false,
  "players": [
    {
      "externalId": "player-1",
      "deck": {
        "decklist": "1 Sol Ring\n1 Command Tower",
        "bracket": 3
      }
    }
  ]
}'
```

### JavaScript

```javascript
const response = await fetch(
  'https://drawspell.space/api/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DRAWSPELL_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'match-123',
    },
    body: JSON.stringify({
      "displaySpectatorLink": false,
      "players": [
        {
          "externalId": "player-1",
          "deck": {
            "decklist": "1 Sol Ring\n1 Command Tower",
            "bracket": 3
          }
        }
      ]
    }),
  },
);

const room = await response.json();
if (!response.ok) throw new Error(room.error.message);
// Send room.players[0].joinUrl to player-1.
```

### Response

```json
{
  "roomId": "abc123",
  "displaySpectatorLink": false,
  "spectatorLink": "https://drawspell.space/rooms/abc123?st=…",
  "activationExpiresAt": "2026-10-10T18:00:00.000Z",
  "playerInviteUrl": "https://drawspell.space/rooms/abc123?gt=…",
  "players": [
    {
      "externalId": "player-1",
      "joinUrl": "https://drawspell.space/rooms/abc123?invite=…"
    }
  ]
}
```

### Error

```json
{
  "error": {
    "code": "idempotency_conflict",
    "message": "This Idempotency-Key was already used with different content."
  }
}
```
