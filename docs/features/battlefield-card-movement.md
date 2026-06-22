# Battlefield Card Movement

This document records the current movement contract, the diagnostics that shaped it,
and the tests that protect it. It supersedes the older planning notes about ghost
lead, free-flowing previews, and quarter-card stacking.

## Current Contract

### Coordinate Model

- Battlefield positions are canonical center points.
- Rendering, drag preview, drop commit, and store writes must convert explicitly
  between center, top-left, viewport, and battlefield coordinates.
- Card dimensions must come from the same battlefield geometry helpers at every
  zoom level.
- Tapped cards preserve the same canonical center as untapped cards; only their
  visual orientation changes.

### Tap

- Tapping a battlefield card toggles tapped state only.
- A tap must not move the card center, change the stored position, or create a
  drag/drop commit.
- Tapped cards render with landscape battlefield geometry, including during drag.

### Grid And Snap

- Battlefield grid lines are always visible.
- The grid is intentionally tied to card geometry: one card footprint is two
  columns by three rows.
- The placement indicator snaps one grid step at a time. It should not drift
  between grid cells.
- Drops commit to snapped center positions.
- Stacking is intentionally simple: if cards share the same snapped center, the
  incoming card bumps by one grid row until it reaches a free center. Recursive
  bumping remains so stacks resolve without overlap.
- The older rule that allowed vertical quarter-card stacking is retired.

### Drag Preview

- The old ghost-lead behavior is retired.
- The current preview is a filled cyan battlefield placement rectangle.
- The dragged card overlay stays cursor anchored.
- The placement rectangle represents the snapped final battlefield target. It may
  move discretely as the cursor crosses snap thresholds, while the dragged card
  follows the cursor.
- The real card should not lead the placement indicator, and the indicator should
  not be treated as another rendered card.

### Cross-Zone Handoff

Movement across zones has one visual owner at a time:

1. Source card is suppressed.
2. Drag overlay and battlefield placement indicator own the interaction.
3. Destination card renders.
4. Source suppression is released only after the destination is visible and the
   minimum handoff frame window has elapsed.

The important implementation details are:

- Suppression claims start at drag start, before dnd-kit teardown can briefly
  restore the source node.
- Claims track `cardId`, `sourceZoneId`, and `targetZoneId`.
- Source detection uses the element's rendered `data-zone-id`, not the mutable
  card model's `zoneId`. During cross-zone commits, the model can already point
  at the destination while stale DOM still exists in the source zone.
- A temporary source-zone CSS suppression rule guards the narrow post-drop window
  where React and dnd-kit can churn classes or replace nodes.
- Release is gated by destination render plus minimum frame count, with a bounded
  maximum so stale claims cannot live forever.

## Diagnostics

Diagnostics remain available because the earlier bugs were geometry and ownership
bugs, not simple event bugs.

Enable battlefield movement diagnostics with either:

```text
?debug=battlefieldDnd
```

or:

```js
localStorage.setItem("drawspell.debug.battlefieldDnd", "true");
```

Useful diagnostic events include:

- pointer and cursor coordinates during drag
- active card dimensions before drag, during overlay render, and after drop
- battlefield card center and snapped center
- placement rectangle dimensions and snapped center
- source and destination zone ids
- pending visual ownership claims
- source suppression and release decisions
- final committed drop position

The browser also mirrors structured debug events into
`#__drawspell-debug-events` for test and manual inspection.

## Regression Tests

The movement suite is built around fundamentals instead of screenshots:

- `apps/web/src/hooks/game/dnd/__tests__/model.unit.test.ts`
  verifies tap vs drag decisions, cursor anchoring, and drag model geometry.
- `apps/web/src/hooks/game/dnd/__tests__/commit.unit.test.ts`
  verifies snapped drop commits and zone handoff payloads.
- `apps/web/src/hooks/game/dnd/__tests__/visualOwnership.unit.test.ts`
  verifies pending cross-zone ownership, source suppression, rendered-zone
  detection, and release gating.
- `apps/web/src/lib/__tests__/dndBattlefield.unit.test.ts`
  verifies battlefield geometry, snapping, grid density, and recursive stack
  bumping.
- `apps/web/src/lib/__tests__/debug.unit.test.ts`
  verifies the diagnostic event buffer.
- `apps/web/src/components/game/seat/__tests__/BattlefieldGhostOverlay.component.test.tsx`
  verifies the filled snapped placement indicator.
- `apps/web/src/components/game/seat/__tests__/Hand.component.test.tsx`
  verifies hand drag behavior and cross-zone suppression.

Run the focused suite with:

```sh
bun run --cwd apps/web test -- src/hooks/game/dnd/__tests__/model.unit.test.ts src/hooks/game/dnd/__tests__/commit.unit.test.ts src/hooks/game/dnd/__tests__/visualOwnership.unit.test.ts src/lib/__tests__/dndBattlefield.unit.test.ts src/lib/__tests__/debug.unit.test.ts src/components/game/seat/__tests__/BattlefieldGhostOverlay.component.test.tsx src/components/game/seat/__tests__/Hand.component.test.tsx
```

Run type checking with:

```sh
bun run --cwd apps/web typecheck
```

## Issues Closed

- Ghost image lagging or leading inconsistently: replaced by a snapped placement
  rectangle while the dragged card stays cursor anchored.
- Tap moving a card: tap is now tested as state-only, with no center mutation.
- Moving a tapped card showing the vertical card: tapped drag geometry preserves
  landscape orientation.
- Grid density not matching zoom/card size: grid is tied to card geometry and
  remains visible as thin lines.
- Cards not aligning to the visible grid: both indicator and committed drops use
  the same snap math.
- Hand-to-battlefield drag offset after size changes: cursor anchoring is
  computed against the dragged overlay dimensions rather than the larger hand
  card dimensions.
- Brief flash in the old zone after cross-zone drop: source visual ownership is
  retained until the destination render is confirmed.

## Retired Behavior

Do not reintroduce these older assumptions without updating this contract and the
tests first:

- Ghost should barely lead the dragged card.
- Ghost should free-flow between grid lines.
- Battlefield stacking should use quarter-card vertical offsets.
- A card model's current `zoneId` is enough to identify the rendered source zone
  during a cross-zone drop.
- Source suppression can be released after a fixed number of frames without
  checking destination render state.
