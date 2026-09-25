# User feedback: causes and target behavior — 2026-09-24

Companion to [the reproduction audit](user-feedback-reproduction-2026-09-24.md). The numbers match the player's report. Items #1 and #4 were implemented after this diagnosis: turn eligibility is now derived from positive life and a loaded deck; Reset Deck alone leaves eligibility unchanged; name and P/T labels follow the card's rotation. The remaining sections retain the original investigation context.

## Priority 1 — Turn can become stuck on a player at zero life (#1)

**Cause, confirmed:** `handlePlayerEndTurn` builds the rotation from every player in `playerOrder`, regardless of life, then accepts an end-turn intent only from `activePlayerId` (`apps/server/src/domain/intents/handlers/player.ts`). The turn picker also lists all players. With three players and the middle player at zero life, the server makes that player active and rejects an end-turn request from the next player as `not your turn`. A disconnected player cannot advance it. `Player` has no participation or eliminated state (`packages/shared/src/types/players.ts`).

**Implemented behavior:** A player is turn-eligible when their deck is loaded and their life is above zero. Passing turn skips everyone else. A life change to zero or below, deck unload, or player departure repairs the active turn immediately. Reset Deck keeps the deck loaded and does not change life, so it does not itself remove the player from rotation. If nobody is eligible, there is no active turn. The server owns this decision, and the picker uses the same eligibility rule. A positive-life concession remains a separate product need: it cannot be inferred reliably from Reset Deck.

**Acceptance check:** In a three-player Room, player 2 reaches zero life; player 1 passes to player 3, the picker does not offer player 2, and player 3 can continue. Reset Deck preserves eligibility according to the unchanged life and deck state.

## Priority 2 — Card spacing changes across viewport widths (#2)

**Cause, confirmed:** Shared positions are fractions of each viewer's battlefield width. `computeBattlefieldCardLayout` converts a normalized X to local pixels, then subtracts half a locally sized card (`apps/web/src/models/game/seat/battlefieldModel.ts`). Thus the pixel gap between centers changes with viewport width while card width need not. The live 2560/1440 px comparison showed the same four cards go from separated to about 17 px of overlap per adjacent pair.

**Target behavior:** All viewers should see the same relationships between cards, measured in card widths, for a given Room arrangement. Use one shared battlefield coordinate space and apply a single view transform to both card positions and card dimensions. Smaller viewports can fit or pan that space, but should not compress only the inter-card gaps. The pointer-to-world conversion, drag previews, and selection hit testing must use the same transform. Existing normalized card positions need a defined mapping to the new space so live Rooms do not visibly jump.

**Acceptance check:** Arrange four lands with one-card-width gaps on an ultrawide client. At 1440p, 1080p, narrow windows, and a different local zoom, the gap-to-card-width ratio stays stable and every card remains reachable.

## Priority 3 — Tapped and zoomed drops disagree with the visible grid (#3)

**Cause, confirmed at placement seam:** `snapCardEdgeToGrid` snaps `center - slotSize/2`, so the center's allowed phase changes when the slot footprint swaps width and height for a tapped card (`apps/web/src/lib/dndBattlefield.ts`). `getCanonicalBattlefieldPlacementGridSteps` also multiplies the grid step by `viewScale` (`packages/shared/src/positions.ts`), changing the lattice when zoom changes. At the same pointer location in the measured case, untapped and tapped cards snapped to different centers. A position placed at scale 1 was 13.5 px off the scale 0.8 snap lattice. Merely tapping a stationary card does not change its stored center.

**Target behavior:** A card center should use one persistent placement lattice regardless of tap orientation or local zoom. Tapping should only rotate the card around that center. The visible grid should be the projection of that exact placement lattice, and zoom should transform cards and grid together. Different footprints can affect collision or bounds, but not the origin or phase of placement. Coordinate this with the shared battlefield space in #2.

**Acceptance check:** Place, tap, drag, untap, zoom in/out, and drag again. Each drop lands on the same visible lattice; stationary cards remain aligned after zoom; a second viewer sees the same arrangement.

## Priority 4 — Tapped top-seat P/T can read backward (#4)

**Cause, confirmed:** A top-seat card has a 180° outer rotation, tapping adds 90°, and name/P/T labels add their own 180° rotation (`Battlefield.tsx`, `cardModel.ts`, `CardFaceNameLabel.tsx`, `CardFacePTBadge.tsx`). On a tapped top-seat card, artwork faces 270° and labels face 90°. The screenshot shows the resulting 6/6 ambiguity.

**Implemented behavior:** Remove the labels' separate 180° correction. Name and P/T now inherit the card's orientation in every seat, tapped or untapped. A top-seat card and its labels face down together; tapping turns them together.

**Acceptance check:** A 6/6 and 9/9 remain distinguishable on top and bottom seats in both tap states, during animation, and at minimum zoom.

## Open bug — Reported selection freeze after double-click (#7)

The screenshot shows a failed drag selection, but local Chrome checks with cards and a production empty-board check did not recreate the double-click trigger. There is no defensible root cause yet. Retain the report as open and capture the exact pointer/event sequence before changing double-click behavior. The desired behavior is that a double-click on empty battlefield leaves marquee selection available on the next drag. Disabling double-click wholesale is premature because the failing event path has not been identified.

## Open bug — Intermittent interaction failure around reconnect (#8)

The first probe deliberately called the Yjs provider's `disconnect()` and later `connect()`. Follow-up wire instrumentation showed that this can leave `getYProvider()` absent and the intent transport closed. The attempted action sent **no** intent frame; a reload recreated the session. That explains this *forced-disconnect probe*, but does not establish the cause of the players' intermittent full-board freeze. An ordinary browser offline/online cycle with a two-second settle recovered both connections; a life update was sent, acknowledged, and visible on both clients. Therefore the exact player bug remains unconfirmed. The current dispatcher drops an intent while the transport is closed and may suppress its reconnect warning during a grace period (`dispatchIntent.ts`), which is a possible contributor to the experience, not a verified explanation of the report.

**Target behavior:** The UI should show when the Room cannot accept actions, never imply that an uncommitted action succeeded, and resume interactions automatically after reconnection. Connection readiness should mean both sync and intent channels are usable. Capture a failing real reconnect with socket state, intent send/ack, and pointer events before choosing a fix.

## Confirmed feature gaps, after bugs (#5 and #6)

- **Bulk counters and P/T (#5):** Bulk counters are implemented for a controlled battlefield selection. The group menu mirrors the single-card menu: game-wide recently used types can be added to every selected card, active types have ± controls (showing “mixed” when counts differ), and the add-counter dialog accepts a count per card. Removing multiple counters prompts for a count and caps each card at zero. Bulk P/T adjustment remains open. P/T edits currently change card stats directly (`apps/web/src/lib/cardPT.ts`), so its future UI should describe their duration honestly rather than imply they expire at end of turn.
- **Shortcuts (#6):** `T` opens token creation, Space is free, and Shift+plus/minus controls zoom (`apps/web/src/models/game/shortcuts/gameShortcuts.ts`). An ergonomic target is `T` for tap selected cards, Space for pass turn when it is your turn, and conflict-free bindings for counter and P/T adjustment. Move token creation to another binding. Shortcuts must respect typing, menus, permissions, selection, and the active-turn rule. Decide whether plus/minus means counters or P/T before assigning both operations.

## Suggested sequence

1. Resolve the turn deadlock, including host recovery and eligibility semantics.
2. Design one battlefield coordinate/zoom model and address cross-viewport spacing and grid consistency together.
3. Correct label orientation and visual 6/9 clarity.
4. Continue targeted capture of #7 and #8 in parallel with those fixes; prioritize either immediately if its exact failure becomes reproducible.
5. Add bulk adjustments, then shortcuts that invoke the same actions.
