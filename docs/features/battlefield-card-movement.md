# Battlefield Card Movement

This document records the current movement contract, the diagnostics that shaped it,
and the tests that protect it. It supersedes the older planning notes about ghost
lead, free-flowing previews, and quarter-card stacking.

## Current Contract

### Coordinate Model

- Battlefield positions are canonical card centers in a fixed world reference
  space. They are independent of viewport size, zoom, and pan.
- Each viewer uses a local camera per battlefield. Default shows three card
  heights, anchored near the corresponding starting corner inside the world.
- Rotated seats reverse both axes. Rendering, selection, drag preview, and drop
  commit share forward and inverse camera conversions.
- On desktop, battlefield bounds exclude the side column and hand bar.
- See [Battlefield cameras](battlefield-cameras.md) for coordinates, controls,
  compatibility, and review instructions.

### Tap

- Tapping changes only tapped state, never the canonical center.
- Tapped cards render with landscape geometry, including during drag.

### Grid And Snap

- A thin grid appears during a drag. Right-button panning makes it glow cyan.
- Snap centers have fixed 40-world-unit spacing on both axes. A 120-unit-tall
  card spans three rows; one-row stacking exposes one third of the card.
- Camera zoom scales both grid spacing and cards. Tapping and zoom never change
  the underlying snap points.
- The placement indicator previews the snapped, collision-resolved final center.
- If cards share a center, the incoming card bumps one world row until free.

### Drag Preview

- The old ghost-lead behavior is retired.
- The desktop bottom bar is a continuous compact drag-cue surface. Gaps between
  its zones keep the overlay at zone scale while continuing to reject drops.
- The current preview is a filled cyan card-sized placement outline.
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
- Grid density not matching zoom/card size: snapping uses a fixed world
  lattice; the local camera scales both the grid and card-sized outline.
- Cards not aligning to snap points: both indicator and committed drops use the
  same snap math.
- Hand-to-battlefield drag offset after size changes: cursor anchoring is
  computed against the dragged overlay dimensions rather than the larger hand
  card dimensions.
- Brief flash in the old zone after cross-zone drop: source visual ownership is
  retained until the destination render is confirmed.

## Retired Behavior

Do not reintroduce these older assumptions without updating this contract and the
tests first:

- Ghost should barely lead the dragged card.
- Ghost should free-flow between snap points.
- Battlefield stacking should use quarter-card vertical offsets.
- A card model's current `zoneId` is enough to identify the rendered source zone
  during a cross-zone drop.
- Source suppression can be released after a fixed number of frames without
  checking destination render state.
