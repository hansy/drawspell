# Drawspell Context

Drawspell is a multiplayer tabletop for Magic: The Gathering cards, with realtime shared room state and private card visibility. This context records project language for architecture discussions and module names.

## Language

**Room**:
A realtime tabletop space backed by one Yjs document and one PartyServer Durable Object.
_Avoid_: lobby, game session

**Yjs Document**:
The shared realtime public state for a Room.
_Avoid_: store, database

**Hidden State**:
Server-owned card identity and ordering data that must not be broadcast through the public Yjs Document.
_Avoid_: private store, secret state

**Private Overlay**:
Viewer-specific card data sent by the server to reveal the subset of Hidden State that viewer may see.
_Avoid_: private snapshot, visibility patch

**Game Log**:
A bounded, ordered, shared public, replayable record of visible gameplay events that occurred in a Room. Connection, authentication, and diagnostic events are outside the Game Log.
_Avoid_: activity log, audit log, debug log, history

**Game Log Event**:
One server-authored gameplay event recorded in the Game Log, such as drawing, discarding, moving a card, rolling dice, changing life, or ending a turn. It carries the public facts available when the event happened.
_Avoid_: log line, activity event, debug event, connection event

**Card Movement Resolution**:
The domain decision for how a card changes zone, controller, position, face-down status, reveal status, counters, and commander status during a move.
_Avoid_: move helper, drag logic

**Deck Import**:
The process that turns an external deck list and Scryfall card data into Drawspell cards.
_Avoid_: deck load, card import

**Discord Room Invite**:
A room invite provisioned from a Discord interaction and delivered to participants by DM.
_Avoid_: Discord game, slash-command room

## Relationships

- A **Room** has exactly one **Yjs Document**.
- A **Room** has server-owned **Hidden State** when cards are in hidden zones or face-down on the battlefield.
- A **Private Overlay** is derived from **Hidden State** for one viewer.
- A **Room** has one **Game Log** made of public **Game Log Events** for that Room's lifetime.
- The **Game Log** remains replayable during the Room's lifetime, including after players reconnect.
- Players and spectators see the same **Game Log**.
- The **Game Log** is not part of the **Yjs Document**.
- A **Game Log Event** may describe visible gameplay that does not change the **Yjs Document**.
- **Card Movement Resolution** determines how cards move between public zones and **Hidden State**.
- **Deck Import** creates cards that later participate in **Card Movement Resolution**.
- A **Discord Room Invite** provisions access to one **Room**.

## Example Dialogue

> **Dev:** "Should the client decide whether a face-down card keeps identity when it moves?"
> **Domain expert:** "No. **Card Movement Resolution** can describe the visible result, but **Hidden State** stays server-owned and the **Private Overlay** decides what each viewer sees."

## Flagged Ambiguities

- "session" appears in code for route IDs, persisted client identity, and multiplayer connection lifecycle. Use **Room** for the shared tabletop space and reserve "session" for local client lifecycle details.
