# Zoom and Destructive-Action Safeguards

Drawspell supports closer battlefield inspection and protects player intent when
an action would discard substantial Room state or information that cannot be
reconstructed from the current Room state.

## Battlefield Zoom

- Battlefield zoom ranges from `0.5x` through `2x`, inclusive.
- Zoom changes in `0.05` increments.
- `1x` remains the standard scale. It is not the mathematical midpoint of the
  range.
- Wheel, pinch, and keyboard zoom use the same bounds and increments.
- Entering a different Room starts at `1x`.
- Reconnecting to the same Room preserves that player's existing zoom.
- Client input, shared-state sanitization, and server intent handling enforce the
  same bounds.

## Confirmation Contract

A confirmation is required when a player explicitly requests an action that
removes substantial state or destroys information that cannot be reconstructed
from the current Room state. Confirmation guards the top-level player intent,
not lower-level operations used to perform it.

For example, an Explicit Shuffle asks for confirmation. A shuffle performed
inside Reset, Mulligan, Deck Import, or another composite action does not ask for
a separate confirmation.

All visible controls and keyboard shortcuts for the same action use the same
confirmation path. A reusable in-app dialog replaces native browser
`confirm()` calls.

The dialog:

- focuses Cancel as the safe default;
- closes without acting when the player presses Escape;
- presents the destructive action with distinct styling;
- suppresses repeated clicks and shortcuts while an intent is pending;
- closes before dispatching an accepted action; and
- dispatches an accepted action at most once.

There is no "Don't ask again" option. Refreshing, closing the tab, and external
browser navigation do not receive additional protection in this feature.

## Guarded Actions

| Player intent | Confirmation condition | Message |
| --- | --- | --- |
| Reset | The player has an imported deck. | **Reset this deck?** Cards will return to their starting zones, tokens will be removed, card state will be cleared, and the Library will be shuffled. |
| Unload | The player has an imported deck. | **Unload this deck?** All of its cards and tokens will be removed from the Room. |
| Leave Room | A player explicitly leaves from inside the Room or from the landing-page resume card. | **Leave this Room?** Your player and cards will be removed from the Room. |
| Explicit Shuffle | The player explicitly chooses Shuffle and the Library contains at least two cards. | **Shuffle this Library?** Its current card order will be lost. |
| Remove tokens | One action will remove at least two selected tokens. | **Remove these N tokens?** This cannot be undone. |

Removing one token remains immediate so routine token cleanup is not burdened
by repeated confirmation.

## Leave Room

Leave Room has one domain meaning across the in-Room control, its shortcut, and
the landing-page resume card: remove the player and their owned game objects
from the Room, then remove that browser's local ability to resume it.

The landing-page action must send the authenticated server-side Leave Room
intent before clearing local Room tokens or identity. On success, it clears the
resume credentials and local Room runtime. If the server cannot complete the
departure, it preserves the credentials, keeps the resume option available, and
shows an error so the player can retry.

Spectators leave immediately without confirmation because they have no owned
deck, cards, or hidden ordering to discard. An automatic departure performed by
"Create new game" in reconnect or error flows is outside this feature because
it is not an explicit Leave Room request.

## Actions Without Confirmation

The following remain immediate or retain their existing interaction because
they are routine gameplay operations or already provide suitable friction:

- shuffling performed by Reset, Mulligan, Deck Import, or another composite
  action;
- Mulligan and its card-count dialog;
- removing a single token;
- spectator departure;
- random discard;
- clearing floating mana;
- removing counters; and
- changing commander status.

## Verification

- Exercise the `0.5x`, `1x`, and `2x` zoom boundaries through wheel, pinch, and
  keyboard input.
- Verify client, server, legacy mutation, and snapshot sanitization agree on the
  zoom bounds.
- Verify zoom starts at `1x` in a different Room and survives reconnection to the
  same Room.
- Exercise accept, Cancel, Escape, and duplicate-trigger behavior for the shared
  dialog.
- Verify every visible control and shortcut for a guarded action uses the shared
  confirmation path.
- Verify Explicit Shuffle confirms only with at least two Library cards and
  internal shuffles never open their own dialog.
- Verify single-token removal remains immediate and multi-token removal confirms
  with the correct count.
- Verify landing-page Leave Room removes server-owned player state before local
  credentials, and that failure preserves the ability to retry.
- Verify spectators can leave immediately.
