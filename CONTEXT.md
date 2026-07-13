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
The process that turns an external deck list and Scryfall card data into Drawspell cards for a player who does not already have an imported deck in the Room.
_Avoid_: deck load, card import

**Library Card Group**:
A set of interchangeable copies with the same canonical card name while viewing a Library, regardless of printing or artwork. Choosing the group chooses any one copy; the identity and position of that copy are not meaningful to the player.
_Avoid_: card stack, duplicate row

**Import Deck List**:
The editable deck list text being prepared for Deck Import. It may be pasted by a player, restored from that player's last user-provided import, or populated from a Curated Deck.
_Avoid_: draft deck list, deck text, pasted deck

**Curated Deck**:
A Drawspell-provided ready-to-import deck list with one or more format tags, such as commander or starter. A Curated Deck named after an official product represents that product's published deck list, not a simplified or modified variant. Choosing a Curated Deck fills the Import Deck List but does not start Deck Import; the player still presses Load Deck. If the Import Deck List is not empty after trimming whitespace, the player confirms before replacing it. Use standard only for decks intended to represent the official Standard format.
_Avoid_: sample deck, starter deck, pre-con

**Format Tag**:
A label that helps players choose a Curated Deck by play style or Magic format. A Curated Deck may have multiple Format Tags; UI grouping may choose one primary tag for presentation. Official Magic format names retain their official meaning; onboarding categories use distinct labels such as starter.
_Avoid_: legality marker, product type

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
- **Deck Import** starts from an **Import Deck List**.
- A **Library Card Group** contains one or more cards from one player's Library.
- **Deck Import** creates cards that later participate in **Card Movement Resolution**.
- **Deck Import** is rejected when the target player already has an imported deck in the **Room**.
- A **Curated Deck** is imported through **Deck Import**.
- A **Curated Deck** has one or more **Format Tags**.
- A **Discord Room Invite** provisions access to one **Room**.

## Example Dialogue

> **Dev:** "Should the client decide whether a face-down card keeps identity when it moves?"
> **Domain expert:** "No. **Card Movement Resolution** can describe the visible result, but **Hidden State** stays server-owned and the **Private Overlay** decides what each viewer sees."

## Flagged Ambiguities

- "session" appears in code for route IDs, persisted client identity, and multiplayer connection lifecycle. Use **Room** for the shared tabletop space and reserve "session" for local client lifecycle details.
