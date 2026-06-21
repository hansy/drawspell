# Battlefield Card Movement Planning Doc

This document defines the intended behavior, implementation plan, and verification strategy for battlefield card tap, drag, drop, ghost, and zoom interactions.

## Current Status

This work started as a diagnostic-only investigation. The first implementation slices are now in progress and are intentionally small:

- tap center stability
- tapped drag overlay orientation
- ghost/drop truthfulness with a small lead
- always-visible thin-line grid
- visible grid aligned to the placement/snap grid

The diagnostic logging and DOM markers remain in place behind the `battlefieldDnd` debug flag.

Enable diagnostics with either:

```text
?debug=battlefieldDnd
```

or:

```js
localStorage.setItem("drawspell.debug.battlefieldDnd", "true");
```

Debug console entries use:

```text
[DEBUG-drawspell]:battlefieldDnd
```

The diagnostic pass was performed against a local Vite dev server at `http://localhost:5173`.

Use `localhost`, not `127.0.0.1`, for local room repros. The join-token origin allowlist accepts the configured development web origin and rejected `http://127.0.0.1:5173` during this investigation.

Console payloads are JSON-stringified so browser automation can capture structured values reliably. The page also keeps the last 1000 debug events in `window.__drawspellDebugEvents`.

Browser automation note: the Codex in-app browser exposes a read-only page evaluation scope, so direct writes to `window.__drawspellDebugEvents` are not available there. The debug helper mirrors the last 300 events into `<script id="__drawspell-debug-events" type="application/json">` so browser automation can read the same structured event stream. Console entries with the `[DEBUG-drawspell]:battlefieldDnd` prefix remain a fallback source of truth.

## Diagnostic Repro Notes

The repro used an in-room battlefield token and browser-driven pointer/tap/zoom interactions. The exact token and room identifiers are not behaviorally important, but the measurements below are from that live DOM repro, not just static code reading.

### Tap Measurement

Observed untapped card:

- DOM rect: `90 x 135`
- Center before tap: `648.3125, 270.5`
- Transform before tap: `none`

Observed after tap settles:

- DOM rect: `135 x 90`
- Center after tap: `665.03125, 270.5`
- Horizontal center delta: `+16.71875px`
- Store `card.position`: unchanged

Conclusion:

- The card is not being moved in state.
- The rendered visual center moves because layout and tapped transform are not using one stable center contract.

### Ghost Measurement

Observed during a tapped-card drag:

- First sampled move:
  - Pointer: `710, 296`
  - Drag overlay center: `710.03125, 318`
  - Ghost center: `665.03796875, 324.4`
  - Ghost was roughly `45px` behind horizontally.
- Later sampled move:
  - Pointer: `820, 355`
  - Drag overlay center: `820.03125, 377`
  - Ghost center: `865.67984375, 378.3`
  - Ghost was roughly `46px` ahead horizontally.

Conclusion:

- The issue is not a pure animation lag.
- The ghost is jumping between snapped canonical targets while the dragged overlay follows pointer-derived movement.
- The user experience still feels like lag/detachment because the ghost is not intentionally and subtly leading the dragged card.

### Tapped Drag Overlay Measurement

Observed during a tapped-card drag:

- Drag overlay card rect: `90 x 135`
- Drag overlay transform: `none`
- Ghost/final tapped shape: `135 x 90`

Conclusion:

- The visible dragged card is rendered as a vertical untapped card even though the source card is tapped.
- This is a render-path mismatch, not a store-state issue.

### Zoom/Grid Measurement

Observed after zooming out:

- `viewScale`: `1.0 -> 0.95 -> 0.9`
- Tapped card dimensions: `135 x 90 -> 128.25 x 85.5 -> 121.5 x 81`
- Grid steps stayed canonical rather than scaling with visible card dimensions.
- Grid rendered as dots.

Conclusion:

- Zoom changes card presentation.
- Grid density does not follow zoom.
- The visible grid does not explain the current snap feel.

### Hand-To-Battlefield Drag Measurement

Observed while dragging a card from hand into battlefield:

- Visible hand card rect: `144 x 216`
- Hand card frame rect: `90 x 135`
- Sortable source rect: `90 x 171`
- Hand card visual transform: `matrix(1.6, 0, 0, 1.6, 0, 0)`
- Pointer start: `649.59375, 700`
- Pointer was inside the visible hand card.
- Pointer was not inside the sortable source rect.
- Pointer was not inside the unscaled hand card frame.
- Visible card minus sortable:
  - left: `-27px`
  - width: `+54px`
  - height: `+45px`
  - centerY: `+22.5px`
- Visible card minus frame:
  - left: `-27px`
  - width: `+54px`
  - height: `+81px`
  - centerY: `+40.5px`

Observed at drag start:

- `dragAnchor`: `0.1625434027777778, 0.6990740740740741`
- Anchor error against visible card: `0px`
- Anchor error against hand sortable rect: about `36.36px`
- Anchor error against hand frame rect: about `59.48px`

Observed when first over battlefield:

- Pointer: `696, 373`
- Drag overlay wrapper rect: `101.25 x 135`
- Drag overlay card rect: `90 x 135`
- Overlay transform: `matrix(1.125, 0, 0, 1.125, 0, 0)`
- Pointer was outside the overlay/card:
  - local overlay point: `-1.765, 161.486`
  - local percent: `-0.0174, 1.1962`
- Overlay anchor error: about `69.54px`
- Overlay center from pointer: about `107.6px`
- Placement card size after entering battlefield: `90 x 135`
- Ghost lead vector from placement: about `1.42px, -9.90px`

Observed overlay sizing diagnostics:

- Source zone: `hand`
- `activeCardScale`: `1.6`
- `activeOverlayTargetScale`: `1`
- `dragBaseScale`: `1.125`
- `overlayScale`: `1.125`
- Overlay base size: `80 x 120`
- Battlefield over-zone card size: `90 x 135`

Conclusion:

- The hand drag starts from a visually scaled card, not from the unscaled hand frame.
- The visible hand card, sortable source, drag overlay, and battlefield placement size are four different geometries.
- The pointer is correctly anchored to the visible hand card at drag start, but the overlay switches to a different size basis during drag.
- This confirms the screenshot suspicion: by the time the cursor crosses into the battlefield, the real dragged overlay is already heavily offset from the cursor, while the battlefield ghost is computed from the cursor/anchor path.

## Confirmed Problems

### Hand-Origin Drag Geometry Splits Across Four Boxes

Dragging from hand to battlefield does not preserve one card geometry contract.

Confirmed cause:

- `Hand.tsx` renders a narrow sortable wrapper and an unscaled `90 x 135` hand frame.
- The child `Card` is visually scaled with `cardScale = 1.6`, producing a `144 x 216` visible card.
- The sortable wrapper uses `max-width`, not a stable width matching the visible card, so it can still measure as `90px` wide.
- `useGameDnD.ts` records the grab anchor from the active drag rect, which matches the visible scaled card at drag start.
- `MultiplayerBoardView.tsx` then renders the `DragOverlay` through separate overlay sizing:
  - hand source `activeCardScale = 1.6`
  - target/battlefield scale becomes `1`
  - calculated `dragBaseScale = 1.125`
  - resulting overlay scale `1.125`
- Once over the battlefield, placement uses battlefield card dimensions `90 x 135`.

Important files:

- `apps/web/src/components/game/seat/Hand.tsx`
- `apps/web/src/components/game/board/MultiplayerBoardView.tsx`
- `apps/web/src/components/game/board/CardDragOverlayView.tsx`
- `apps/web/src/hooks/game/dnd/useGameDnD.ts`
- `apps/web/src/lib/dndBattlefield.ts`

Root cause:

- The drag system treats the visible hand card, sortable source slot, overlay render box, and battlefield placement box as interchangeable.
- They are not interchangeable.
- The pointer anchor is correct relative to the scaled visible hand card, but wrong relative to the overlay once the overlay changes scale and base dimensions.

Benchmark target:

- At drag start, pointer local percent should be identical for the visible card and overlay.
- Throughout drag, overlay anchor error should be `<= 1px`.
- If a hand card visually renders at `144 x 216`, the drag overlay should either preserve that geometry until the drop transition or explicitly switch through a measured, intentional transition that keeps the grabbed point under the cursor.
- On battlefield entry, the ghost may use battlefield placement dimensions, but the real dragged overlay must not detach from the pointer.

### Ghost Position Feels Detached

The ghost does not consistently track the dragged card. It can trail the card early in a drag and jump ahead later because the ghost is rendered at the snapped canonical battlefield position.

Confirmed cause:

- `computeBattlefieldPlacement` computes a live pointer/anchor-derived center.
- It then snaps that center through canonical battlefield grid math.
- `ghostPosition` is derived from `snappedCanonical`, so the ghost moves by grid steps rather than as a smooth near-card preview.

Important files:

- `apps/web/src/lib/dndBattlefield.ts`
- `apps/web/src/hooks/game/dnd/model.ts`
- `apps/web/src/hooks/game/dnd/useGameDnD.ts`
- `apps/web/src/components/game/zone/Zone.tsx`

Recent commits that contributed:

- `22651bc Refactor battlefield placement to canonical grid math`
  - Replaced separate ghost snapping with canonical snapped placement for `ghostPosition`.
- `8cfa8e0 Improve canonical battlefield card movement`
  - Added pointer and drag-anchor correction, but the ghost still uses snapped placement.

Root cause:

- The system collapsed "live dragged center", "drop preview center", and "final canonical position" into one snapped placement path.
- The pointer/anchor math computes a reasonable live center.
- The ghost then discards that live center and renders at the nearest canonical snap.
- With current grid spacing, the snap can be about `40px` from the live center in a simple tapped-card case.
- This makes a stationary drag sample fail the `<= 2px` no-lead benchmark and a moving drag sample fail the `8-12px` lead benchmark.

Design mistake:

- Snapping was treated as the preview model rather than final drop resolution.
- The preview needs its own explicit contract: truthful final target, but only barely ahead of the dragged card.

### Tapping Visually Moves A Card

Tapping does not mutate the stored battlefield `position`, but the rendered card center changes after tap.

Confirmed cause:

- Battlefield layout positions the card by an untapped base width and height.
- Tapped visual orientation is applied later as a CSS transform.
- The transform/layout combination changes the apparent center even when canonical position is stable.

Important files:

- `apps/web/src/models/game/seat/battlefieldModel.ts`
- `apps/web/src/models/game/card/cardModel.ts`
- `apps/web/src/hooks/game/card/useCardController.ts`

Confirmed non-cause:

- `tapCard` changes tapped state but does not directly change `card.position`.
- No `moveCard` should occur for tap-only interaction.

Root cause:

- Battlefield layout always subtracts the untapped base box:
  - `left = centerX - baseWidth / 2`
  - `top = centerY - baseHeight / 2`
- Tapped cards render with swapped visual dimensions and a `rotate(90deg)` transform later in the card container.
- Therefore the layout center and visual center are not the same thing.
- In the new contract tests, a tapped card center shifts `22.5px` horizontally with measured `90 x 135` untapped and `135 x 90` tapped dimensions.
- Zooming a tapped card also shifts the modeled center because the layout is based on the base box while visual dimensions scale afterward.

Design mistake:

- Tapped orientation is treated as a post-layout decoration instead of part of the battlefield card's visual geometry.

### Dragging A Tapped Card Shows A Vertical Real Card

The drag overlay for a tapped battlefield card renders the real card vertically.

Confirmed cause:

- Drag overlay renders `CardView` directly.
- Tapped rotation is applied by card container/controller styling, not by `CardView`.
- Therefore the overlay bypasses tapped visual state.

Important files:

- `apps/web/src/components/game/board/MultiplayerBoardView.tsx`
- `apps/web/src/components/game/card/CardView.tsx`
- `apps/web/src/models/game/card/cardModel.ts`

Recent commits that contributed:

- `38844e3 Improve battlefield drop ghost sizing and visuals`
  - Added explicit `ghost.size`, causing tapped single-card ghost rendering to use landscape dimensions instead of the old rotate fallback.
- `8cfa8e0 Improve canonical battlefield card movement`
  - Adjusted overlay transform origin, but overlay still renders raw `CardView` and bypasses tapped container transforms.

Root cause:

- Normal battlefield cards render through `<Card>`, which uses `useCardController` and `computeCardContainerStyle`.
- Tapped rotation is applied in `computeCardContainerStyle`.
- Drag overlays render `CardView` directly in `MultiplayerBoardView`.
- `CardView` does not apply tapped rotation.
- So the overlay can have the source card's data but not the source card's battlefield visual state.

Design mistake:

- The project has two card render paths that look similar but do not share the same geometry contract:
  - battlefield card path: `<Card>` plus controller styles
  - drag overlay path: raw `<CardView>` plus wrapper scale

### Grid Density Does Not Follow Zoom

Cards shrink as `viewScale` decreases, but grid step size remains based on canonical battlefield steps. The grid also renders as dots.

Confirmed cause:

- `computeBattlefieldGridProjection` uses canonical grid steps for `gridStepX` and `gridStepY`.
- `viewScale` affects origin offsets and card dimensions, not grid density.
- `BattlefieldGridOverlay` uses `radial-gradient(...)` dots.

Important files:

- `apps/web/src/models/game/seat/battlefieldModel.ts`
- `apps/web/src/components/game/seat/BattlefieldGridOverlay.tsx`

Recent commits that contributed:

- `8cfa8e0 Improve canonical battlefield card movement`
  - Added `computeBattlefieldGridProjection`, which uses canonical grid steps and only uses `viewScale` for origin/card-size alignment.

Root cause:

- `computeBattlefieldGridProjection` computes `gridStepX` and `gridStepY` from canonical battlefield steps only.
- `viewScale` changes card dimensions and origin offsets, but not grid step.
- The visible card shrinks while the visible grid stays equally coarse.
- The grid overlay uses a `radial-gradient(...)`, so the user sees dots even though the intended behavior is thin line guidance.

Design mistake:

- The snap model and visible grid model are not owned by one "grid density policy".
- Grid was treated as a projection of legacy canonical math rather than as an interaction affordance that must stay useful at each zoom level.

## Current System Failure Model

The movement system is not failing because one helper is wrong. It is failing because several locally reasonable refactors created incompatible contracts.

### Pipeline Today

Current drag/tap/zoom pipeline:

```text
stored canonical card.position
  -> computeBattlefieldCardLayout uses untapped base box
  -> <Card> applies scale and tapped rotation later
  -> dnd-kit measures a rendered/transformed active rect
  -> useGameDnD computes pointer + dragAnchor
  -> computeBattlefieldPlacement converts to canonical
  -> placement snaps to canonical grid immediately
  -> ghost renders at snapped position with explicit size
  -> DragOverlay renders raw CardView, not Card
  -> drag end writes snappedCanonical through moveCard
```

The broken handoffs:

- Layout handoff:
  - `computeBattlefieldCardLayout` returns top-left for an untapped box.
  - rendered card may be tapped, rotated, and scaled.
- Overlay handoff:
  - battlefield card rendering and drag overlay rendering use different components and transforms.
- Preview handoff:
  - ghost uses snapped canonical placement, not the live dragged center plus explicit lead.
- Grid handoff:
  - visible grid does not adapt with zoom, but card size does.
- Store handoff:
  - store movement is mostly coherent, but it faithfully applies the already-bad visual plan.

### Why Previous Movement Overhauls Accumulated This

The important history:

- `1b2dafa Fix battlefield snapping grid`
  - Had separate concepts for snapped ghost placement and final canonical placement.
  - This was closer to the idea that ghost and final store math may need different visual/canonical handling.
- `fc09a82 refactor: align card sizing math with seat sizing`
  - Introduced more dynamic sizing and drag scale compensation.
  - This addressed seat/card size mismatch locally, but did not create a single geometry source of truth.
- `38844e3 Improve battlefield drop ghost sizing and visuals`
  - Added explicit `ghost.size`.
  - This fixed ghost dimensions in some cases but made tapped ghost rendering depend on whether `ghostSize` exists.
- `22651bc Refactor battlefield placement to canonical grid math`
  - Collapsed ghost placement onto the canonical snapped position.
  - This improved final/drop consistency but made the ghost jump to grid targets.
- `8cfa8e0 Improve canonical battlefield card movement`
  - Added pointer/drag-anchor correction and canonical group movement.
  - This improved part of the drag math, but because ghost rendering still used snapped placement, the pointer-aware center never became the visible preview.
  - It also added grid projection based on canonical steps, leaving zoom density unchanged.

Pattern:

- Each pass fixed one local mismatch:
  - sizing mismatch
  - ghost dimension mismatch
  - canonical final position mismatch
  - pointer anchor mismatch
  - group movement bounds
- None introduced a shared movement invariant that every layer had to satisfy.

The invariant we need now:

```text
pointer + anchor -> live card geometry -> intentional preview geometry -> final canonical drop -> store -> settled DOM
```

Every layer should either preserve this invariant or explicitly convert between its coordinate spaces.

## Diagnostic Instrumentation Added

All instrumentation is gated by `battlefieldDnd`. Normal gameplay remains quiet unless the flag is enabled.

### Shared Debug Helpers

File:

- `apps/web/src/lib/debug.ts`

Added:

- Runtime flag support through query params and localStorage.
- Structured console logging with JSON payloads.
- In-page rolling event buffer: `window.__drawspellDebugEvents`.
- DOM mirror for the last 300 debug events: `#__drawspell-debug-events`.
- DOM geometry summarizers for:
  - card elements
  - ghost elements
  - drag overlay wrappers
  - drag overlay card views
  - drag overlay tapped frames
  - hand sortable source elements
  - hand card frame elements
  - card preview elements
  - zone elements
  - arbitrary rects
- Pointer/rect relation summarizer:
  - pointer local coordinate
  - pointer local percent
  - center-from-pointer vector
  - anchor point
  - anchor error

### Hand And Overlay Layout Logs

Files:

- `apps/web/src/components/game/seat/Hand.tsx`
- `apps/web/src/components/game/board/MultiplayerBoardView.tsx`

Events:

- `hand-card-layout`
  - card id and zone id
  - dragging state
  - hand `cardScale`
  - base card height
  - resolved card width
  - hand slot/overlap width
  - sortable/card/frame DOM geometry
- `drag-overlay-sizing`
  - active card id and state
  - active zone
  - global board scale
  - active card scale
  - active view scale
  - over-card scale
  - overlay target scale
  - drag base scale
  - overlay base dimensions
  - final overlay scale
  - transform origin
  - card/source/overlay/ghost DOM geometry

### DnD Lifecycle Logs

File:

- `apps/web/src/hooks/game/dnd/useGameDnD.ts`

Events:

- `drag-start`
  - active card id
  - activator pointer
  - drag anchor
  - active initial/translated rects
  - card scale
  - card state
  - source card DOM geometry
  - zone DOM geometry
  - hand sortable/frame geometry
  - drag overlay/ghost/preview geometry when present
- `drag-move-compute`
  - pointer screen position
  - drag delta
  - active rects
  - over-zone rect and scale metadata
  - card state
  - source card geometry
  - drag overlay wrapper geometry
  - drag overlay card geometry
  - hand sortable/frame geometry
  - card preview geometry
  - ghost geometry before render
  - computed ghost state
  - placement internals:
    - center screen
    - pointer screen
    - drag anchor
    - tapped state
    - zone scale
    - view scale
    - over rect
    - card width/height
    - zone width/height
    - preview canonical
    - snapped canonical
    - ghost position
  - placement relations:
    - live dragged center in screen coordinates
    - ghost center in screen coordinates
    - snapped final center in screen coordinates
    - ghost relative to live dragged card
    - snapped final target relative to ghost
    - snapped final target relative to live dragged card
- `drag-move-ghost-rendered`
  - rendered ghost state
  - rendered ghost geometry
  - overlay geometry after render
  - source card geometry
- `drag-move-group-ghost-rendered`
  - group ghost state
  - per-card group ghost geometry
- `drag-end-plan`
  - pointer screen position
  - drag delta
  - over-zone metadata
  - active rects
  - drag anchor
  - computed drag end plan
  - card state before move
  - source card geometry before move
  - overlay geometry before move
  - ghost geometry before clear
- `drag-end-landed`
  - planned position
  - card state after move
  - rendered card geometry after move frame
  - zone geometry
- `drag-end-landed-settled`
  - settled card state
  - settled rendered geometry

### Tap Logs

File:

- `apps/web/src/hooks/game/card/useCardController.ts`

Events:

- `card-pointer-down`
  - pointer
  - card state
  - card geometry
  - zone geometry
  - interaction eligibility context
- `card-pointer-up`
  - pointer
  - card state
  - card geometry
  - zone geometry
  - active drag card id
- `tap-before`
  - pointer
  - selected ids and selection zone
  - card state before tap
  - card geometry before tap
  - zone geometry
- `tap-group-card-before`
  - per-card group tap state before tap
  - per-card geometry
- `tap-after-frame`
  - store state and DOM geometry on the next animation frame
- `tap-after-settled`
  - store state and DOM geometry after the tap animation has settled

### Battlefield Geometry Logs

File:

- `apps/web/src/components/game/seat/Battlefield.tsx`

Event:

- `battlefield-render-geometry`

Payload includes:

- zone id and owner id
- board scale
- `viewScale`
- zone size
- base card sizing
- card sizes by tapped/untapped state
- grid visibility, step, and origin
- active card id and tapped state
- zone DOM geometry
- per-card store state and DOM geometry

### Ghost Render Logs

Files:

- `apps/web/src/components/game/zone/Zone.tsx`
- `apps/web/src/components/game/seat/BattlefieldGhostOverlay.tsx`

Events:

- `single-ghost-rendered`
- `group-ghost-overlay-rendered`

Payload includes:

- ghost state
- card scale
- base sizing
- ghost DOM geometry
- zone DOM geometry
- per-card group ghost geometry

### Grid Logs

File:

- `apps/web/src/components/game/seat/BattlefieldGridOverlay.tsx`

Event:

- `grid-overlay-rendered`

Payload includes:

- visibility
- `gridStepX`
- `gridStepY`
- origin offsets
- computed CSS background style

### Zoom And Grid Sizing Logs

Files:

- `apps/web/src/hooks/game/board/useBattlefieldZoomControls.ts`
- `apps/web/src/store/gameStore/actions/ui.ts`

Events:

- `battlefield-zoom-wheel`
- `battlefield-zoom-adjust`
- `battlefield-zoom-pinch`
- `battlefield-scale-set`
- `battlefield-grid-sizing-set`
- `battlefield-grid-sizing-clear`

Payload includes:

- player id
- wheel/pinch input
- current scale
- requested scale
- clamped/applied scale
- grid sizing before/after

### Store Movement Logs

File:

- `apps/web/src/store/gameStore/actions/movement/moveCard.ts`

Events:

- `move-card-request`
- `move-card-apply`

Payload includes:

- actor id
- from/to zone ids
- requested position
- resolved position
- movement options
- card state before movement
- from/to zone types

### DOM Markers Added

Files:

- `apps/web/src/components/game/board/MultiplayerBoardView.tsx`
- `apps/web/src/components/game/zone/Zone.tsx`
- `apps/web/src/components/game/seat/BattlefieldGhostOverlay.tsx`
- `apps/web/src/components/game/seat/BattlefieldGridOverlay.tsx`
- `apps/web/src/components/game/card/types.ts`

Markers:

- `data-dnd-drag-overlay-card-id`
- `data-dnd-drag-overlay-kind`
- `data-dnd-drag-overlay-card-view-id`
- `data-dnd-ghost-card-id`
- `data-dnd-ghost-kind`
- `data-battlefield-grid-overlay`

These markers exist so debug code and browser automation can reliably measure source cards, overlays, ghosts, and grid rendering.

## How To Interpret A Debug Trace

For a single drag, group events by `seq`.

Some render-followup events are scheduled with `requestAnimationFrame`. If a drag ends before a queued render log runs, a late `drag-move-ghost-rendered` may show `seq: null`. In that case, use the surrounding card id, pointer data, and immediately preceding `drag-move-compute` or `drag-end-plan` events to correlate the trace.

Expected flow:

1. `card-pointer-down`
2. `drag-start`
3. one or more `drag-move-compute`
4. one or more `drag-move-ghost-rendered`
5. `drag-end-plan`
6. `move-card-request`
7. `move-card-apply`
8. `drag-end-landed`
9. `drag-end-landed-settled`

For a tap-only interaction, expected flow:

1. `card-pointer-down`
2. `card-pointer-up`
3. `tap-before`
4. `tap-after-frame`
5. `tap-after-settled`

A tap-only interaction should not produce:

- `drag-start`
- `drag-end-plan`
- `move-card-request`
- `move-card-apply`

Key comparisons:

- Pointer attachment:
  - Compare `pointerScreen` with `dragOverlayCardElement.rect`.
  - The original grab anchor should remain under the pointer.
- Ghost truthfulness:
  - Compare `placement.snappedCanonical`, `ghostState.position`, `drag-end-plan.position`, and `drag-end-landed.cardStateAfterMove.position`.
- Tap stability:
  - Compare `tap-before.cardElement.rect.centerX/Y` with `tap-after-settled.cardElement.rect.centerX/Y`.
  - Compare `cardStateBeforeTap.position` with `cardStateAfterTap.position`.
- Overlay correctness:
  - Compare tapped source card dimensions with `dragOverlayCardElement.rect`.
  - Tapped overlay should be landscape; untapped overlay should be portrait.
- Grid usefulness:
  - Compare `viewScale`, card dimensions, `gridStepX`, and `gridStepY`.

## Validation Already Run

The initial diagnostic changes were validated before functional fixes. After the first implementation slices, the focused movement contract tests and typecheck are green.

Typecheck:

```bash
bun run --cwd apps/web typecheck
```

Result:

- Passed.

Focused movement/grid tests:

```bash
bun run --cwd apps/web test -- src/lib/__tests__/dndBattlefield.unit.test.ts src/hooks/game/dnd/__tests__/model.unit.test.ts src/models/game/seat/__tests__/battlefieldModel.unit.test.ts src/components/game/seat/__tests__/BattlefieldGridOverlay.component.test.tsx src/yjs/__tests__/sanitizeSharedSnapshot.unit.test.ts src/store/__tests__/gameStore.moveCard.unit.test.ts src/components/game/board/__tests__/CardDragOverlayView.component.test.tsx src/lib/__tests__/positions.unit.test.ts
```

Result:

- 8 test files passed.
- 71 tests passed.

Full web test suite:

```bash
bun run --cwd apps/web test
```

Result:

- 106 test files passed.
- 659 tests passed.
- Existing React `act(...)` warnings appeared in portrait seat toolbar tests, but there were no failures.

## Diagnostic Diff Scope

The current diagnostic and first implementation diff touches these files:

- `apps/web/src/lib/debug.ts`
- `apps/web/src/hooks/game/dnd/model.ts`
- `apps/web/src/hooks/game/dnd/useGameDnD.ts`
- `apps/web/src/hooks/game/card/useCardController.ts`
- `apps/web/src/hooks/game/board/useBattlefieldZoomControls.ts`
- `apps/web/src/components/game/seat/Battlefield.tsx`
- `apps/web/src/components/game/seat/BattlefieldGridOverlay.tsx`
- `apps/web/src/components/game/seat/BattlefieldGhostOverlay.tsx`
- `apps/web/src/components/game/zone/Zone.tsx`
- `apps/web/src/components/game/board/MultiplayerBoardView.tsx`
- `apps/web/src/components/game/card/types.ts`
- `apps/web/src/store/gameStore/actions/ui.ts`
- `apps/web/src/store/gameStore/actions/movement/moveCard.ts`

Keep future slices narrowly scoped and update this list as new movement surfaces are touched.

## Movement Test Overhaul Status

The first benchmark-test pass replaced narrow implementation-detail tests with contract tests around the movement fundamentals.

Files changed or added:

- `apps/web/src/lib/__tests__/dndBattlefield.unit.test.ts`
  - Rewritten around battlefield placement contracts:
    - stationary ghost stays on dragged center
    - moving ghost leads by 8-12px
    - tapped preview dimensions match zoomed final placement
    - final snapped card edges align to visible grid lines for tapped and untapped cards
    - tapped and untapped snapped edges align at `viewScale` 1.0, 0.9, 0.75, and 0.5
    - mirrored battlefield ghost geometry remains in view coordinates while final Y is stored canonically
- `apps/web/src/hooks/game/dnd/__tests__/model.unit.test.ts`
  - Rewritten around DnD model contracts:
    - invalid drops produce no battlefield preview
    - stationary tapped-card preview stays on dragged center
    - tapped preview dimensions follow zoom
    - final drop plan uses snapped placement while the live ghost stays cursor anchored
    - selected group ghost geometry preserves per-card offsets and tapped/untapped dimensions
    - selected group ghost geometry preserves offsets on mirrored battlefields
    - mirrored drag-end plans write canonical, unmirrored coordinates
- `apps/web/src/models/game/seat/__tests__/battlefieldModel.unit.test.ts`
  - Rewritten around battlefield layout contracts:
    - tap preserves rendered center
    - zoom preserves rendered center
    - visible placement grid uses half-short-side square card steps
    - drag permission remains independent of visual state
- `apps/web/src/components/game/seat/__tests__/BattlefieldGridOverlay.component.test.tsx`
  - Added visible-grid contract:
    - grid renders thin lines instead of dot markers
- `apps/web/src/components/game/board/__tests__/CardDragOverlayView.component.test.tsx`
  - Added overlay contract:
    - tapped drag overlay renders in the same orientation as the real battlefield card
    - tapped overlay content is centered inside a landscape frame instead of drifting within a portrait box
- `apps/web/src/store/__tests__/gameStore.moveCard.unit.test.ts`
  - Added green store contract:
    - tapping preserves canonical battlefield position

Current focused command:

```bash
bun run --cwd apps/web test -- src/lib/__tests__/dndBattlefield.unit.test.ts src/hooks/game/dnd/__tests__/model.unit.test.ts src/models/game/seat/__tests__/battlefieldModel.unit.test.ts src/components/game/seat/__tests__/BattlefieldGridOverlay.component.test.tsx src/yjs/__tests__/sanitizeSharedSnapshot.unit.test.ts src/store/__tests__/gameStore.moveCard.unit.test.ts src/components/game/board/__tests__/CardDragOverlayView.component.test.tsx src/lib/__tests__/positions.unit.test.ts
```

Current result:

- 8 test files executed.
- 71 tests passing.

Typecheck result after adding these tests:

```bash
bun run --cwd apps/web typecheck
```

Result:

- Passed.

These tests are the current implementation benchmark. Future fixes should keep them green without weakening the thresholds.

## Intended Behavior

### Core Principle

Canonical battlefield position is the source of truth. Visual interactions should preserve that source of truth while making movement feel direct and predictable.

- Tap changes card orientation around its canonical center.
- Drag overlay follows the pointer and preserves the grab point.
- Ghost previews the final drop target and barely leads the dragged card.
- Drop writes the exact position represented by the final preview.
- Zoom changes screen projection, not canonical card centers.

## Ideal Measurement Benchmarks

These benchmarks define what "fixed" means. They should become the hard assertions in unit, component, and browser interaction tests.

### Coordinate Definitions

Use these names consistently in tests:

- `pointerScreen`: current pointer location in viewport pixels.
- `dragAnchor`: normalized grab point inside the card, where `{ x: 0.5, y: 0.5 }` is the card center.
- `cardVisualSize`: rendered card width and height at the current tapped state and zoom.
- `liveDraggedCenterScreen`: the center of the dragged real card implied by pointer plus grab anchor.
- `ghostCenterScreen`: rendered center of the ghost/drop preview in viewport pixels.
- `landedCenterScreen`: rendered center after the drop settles.
- `movementUnit`: normalized recent pointer movement direction.
- `leadVector`: `ghostCenterScreen - liveDraggedCenterScreen`.

For a non-mirrored field:

```text
liveDraggedCenterScreen.x = pointerScreen.x + (0.5 - dragAnchor.x) * cardVisualSize.width
liveDraggedCenterScreen.y = pointerScreen.y + (0.5 - dragAnchor.y) * cardVisualSize.height
```

For scaled board containers, multiply the visual-size offset by the board/zone scale used by the rendered viewport.

### Tap Benchmarks

Tap-only interaction:

- `card.position` before tap equals `card.position` after tap exactly.
- No `move-card-request` event.
- No `move-card-apply` event.
- No `drag-start` event.
- Rendered center delta after animation settles:
  - `abs(after.centerX - before.centerX) <= 1px`
  - `abs(after.centerY - before.centerY) <= 1px`
- Expected dimensions:
  - untapped at `viewScale = 1`: `90 x 135` in the measured baseline
  - tapped at `viewScale = 1`: `135 x 90` in the measured baseline
- Dimension changes are allowed; center movement is not.

Group tap:

- Every affected card satisfies the same center stability threshold.
- Unaffected cards do not change tapped state or center.

### Drag Overlay Benchmarks

During drag, the overlay is the real card under the user's control.

- Grab point attachment:
  - `abs(pointerScreen.x - overlayGrabPointScreen.x) <= 1px`
  - `abs(pointerScreen.y - overlayGrabPointScreen.y) <= 1px`
- Overlay center:
  - `abs(overlayCenterScreen.x - liveDraggedCenterScreen.x) <= 1px`
  - `abs(overlayCenterScreen.y - liveDraggedCenterScreen.y) <= 1px`
- Overlay dimensions match expected card dimensions for the current tapped state and zoom within `1px`.
- Tapped overlay is landscape:
  - `overlay.width > overlay.height`
- Untapped overlay is portrait:
  - `overlay.height > overlay.width`
- Overlay visual state matches card state:
  - face-down state preserved
  - tapped orientation preserved
  - current zoom preserved

### Ghost Benchmarks

The ghost is the truthful drop preview and should barely lead the dragged card.

When pointer movement is above the movement threshold and the card is not constrained by bounds:

- Directional lead:
  - `dot(leadVector, movementUnit)` should be between `8px` and `12px`.
- Perpendicular drift:
  - `abs(cross(leadVector, movementUnit)) <= 2px`.
- Total ghost distance:
  - `distance(ghostCenterScreen, liveDraggedCenterScreen) <= 12.5px`.
- Ghost is ahead, not behind:
  - `dot(leadVector, movementUnit) > 0`.

When pointer movement is below the movement threshold:

- Lead should be zero or visually negligible:
  - `distance(ghostCenterScreen, liveDraggedCenterScreen) <= 2px`.

Near battlefield bounds:

- Lead may be reduced or clamped.
- Ghost must remain inside valid bounds.
- Ghost must not jump to the wrong side of the dragged card unless bounds make that unavoidable.

Drop truthfulness:

- `drag-end-plan.position` equals the canonical position represented by the final ghost.
- After drop settles, `card.position` equals `drag-end-plan.position`.
- `distance(landedCenterScreen, ghostCenterScreen at release) <= 1px`.

Tapped ghost:

- Tapped ghost is landscape.
- Untapped ghost is portrait.
- Ghost dimensions match expected final placed card dimensions at current zoom within `1px`.

### Zoom And Grid Benchmarks

Zoom should change card dimensions predictably. The visible placement grid should explain actual snap/drop targets without becoming visually overwhelming.

Card dimensions:

- At `viewScale = 1.0`, measured tapped dimensions are `135 x 90`.
- At `viewScale = 0.95`, tapped dimensions should be `128.25 x 85.5`.
- At `viewScale = 0.9`, tapped dimensions should be `121.5 x 81`.
- More generally:
  - `width(viewScale) = width(1.0) * viewScale`
  - `height(viewScale) = height(1.0) * viewScale`

Grid:

- Grid uses thin lines, not dots.
- Grid line positions align with actual snap/drop targets.
- Current trial grid step is card-relative:
  - `gridStepX = baseCardWidth * viewScale / 2`
  - `gridStepY = baseCardWidth * viewScale / 2`
- Grid step does not depend on tapped state.
- Grid step intentionally changes with `viewScale`, matching the user's expectation that zoom changes grid density.
- At every tested zoom, a moved card's saved canonical position should be a multiple of the current card-relative grid step unless battlefield bounds force clamping.
- A rendered landed card center should be within `1px` of the visible grid intersection represented by its saved canonical position.

This replaces the discarded `1%` normalized placement grid, which was mathematically clean but too visually dense. Existing cards with legacy off-grid positions are allowed to remain off-grid until moved, because silently snapping them during render/sync would make taps and unrelated updates move cards.

### Cross-Layer Consistency Benchmarks

For any drag sample:

- `computeDragMoveUiState` preview target matches rendered ghost.
- `computeDragEndPlan` target matches the final drag-move preview at release.
- `moveCard` requested position matches `computeDragEndPlan`.
- store position after move matches `moveCard` resolved position.
- rendered position after settle matches store position projection.

This is the fundamental chain tests need to protect:

```text
pointer + anchor -> live dragged center -> lead-adjusted preview -> final drop plan -> moveCard -> store state -> settled DOM
```

Any test that only covers one link in isolation is insufficient for movement quality.

## Why Existing Tests Did Not Catch This

The current tests mostly assert isolated math outputs and current implementation details. They do not assert the user-visible movement contract.

Specific gaps:

- `apps/web/src/lib/__tests__/dndBattlefield.unit.test.ts`
  - Asserts that `ghostPosition` equals snapped canonical placement.
  - Does not assert ghost distance from pointer or dragged card.
  - Does not assert ghost lead direction or lead magnitude.
  - Does not assert final rendered ghost matches drop position.
- `apps/web/src/hooks/game/dnd/__tests__/model.unit.test.ts`
  - Verifies `computeDragMoveUiState` returns a ghost and `computeDragEndPlan` returns a canonical position.
  - Does not assert drag overlay geometry.
  - Does not assert pointer grab-point attachment.
  - Does not assert tapped overlay orientation.
  - Does not connect drag-move preview to final drop DOM.
- `apps/web/src/models/game/seat/__tests__/battlefieldModel.unit.test.ts`
  - Checks `left` and `top`, but not visual center stability after tapped transform.
  - Checks grid alignment to current canonical projection, not whether density is useful at zoom.
- `apps/web/src/models/game/card/__tests__/cardModel.unit.test.ts`
  - Checks transform string composition.
  - Does not measure the resulting bounding box or center.
- There are no end-to-end pointer interaction tests for battlefield movement.
- There are no negative event tests proving tap-only interaction does not start drag or call `moveCard`.
- There are no tests that compare source card, drag overlay, ghost, final plan, store state, and settled DOM in one trace.

The result is that tests can pass while the real UX is broken. They prove that the current implementation is deterministic, not that it is correct.

## Test Fundamentals To Add

### 1. Geometry Unit Tests

These should test pure helpers with no React or DOM dependency.

Required assertions:

- tap layout preserves center for tapped and untapped dimensions
- pointer + anchor computes live dragged center exactly
- ghost lead vector is `8-12px` in movement direction
- stationary ghost does not lead
- edge clamping reduces lead without violating bounds
- final drop canonical equals ghost canonical
- zoomed card dimensions scale linearly
- grid density policy produces bounded snap displacement at each zoom

### 2. Component DOM Tests

These should render actual React components in jsdom where possible.

Required assertions:

- double-click tap does not call `moveCard`
- double-click tap does not start DnD
- tapped card center is stable after animation is advanced or disabled
- tapped overlay receives the same orientation/dimensions as a tapped battlefield card
- grid overlay CSS uses line gradients, not radial dots

### 3. Browser Interaction Tests

These should use real pointer events in a browser-like environment because DnD, transforms, and bounding boxes are the failure surface.

Required scenarios:

- drag untapped card at `viewScale = 1.0`
- drag tapped card at `viewScale = 1.0`
- drag tapped card at `viewScale = 0.9`
- drag tapped card at `viewScale = 0.5`
- drag near battlefield edges
- tap card without moving pointer
- selected group drag

For each drag scenario, collect:

- pointer trace
- source card rect
- overlay rect
- overlay card rect
- ghost rect
- final landed rect
- final store position

Then assert the benchmark thresholds above.

### 4. Trace-Based Regression Tests

The debug event stream should be usable as a regression oracle.

For automated browser tests, parse events with prefix:

```text
[DEBUG-drawspell]:battlefieldDnd
```

Assert:

- tap traces have no drag/move events
- drag traces have a coherent `seq`
- ghost lead metrics are within threshold
- final landed position matches release ghost
- overlay orientation matches tapped state
- grid density and card size correspond to zoom

### 5. Test Naming Rule

Movement tests should be named as behavior contracts, not implementation details.

Good:

- `keeps the rendered card center stable when tapping`
- `keeps the grabbed point under the pointer while dragging`
- `keeps the ghost 8-12px ahead of the dragged card while moving`
- `lands the card at the final ghost target`

Bad:

- `returns snapped canonical ghost position`
- `composes transform parts in order`
- `projects canonical grid`

Implementation-detail tests are still useful, but they cannot be the only tests around battlefield movement.

### Tap Contract

Tapping a battlefield card should rotate the card in place.

- Stored `card.position` must not change.
- Rendered card center should stay fixed before and after tap within 1px.
- Tap should not start DnD.
- Tap should not call `moveCard`.
- Tap should not trigger collision resolution.
- Group tap should preserve the rendered center of every affected card.

If tapped rotation would visually exceed battlefield bounds, keep center stability unless product behavior explicitly requires tap-time clamping.

### Dragged Real Card Contract

The real dragged card is the card under the user's control.

- The point grabbed by the pointer should remain under the pointer throughout drag.
- Drag overlay should match the real card's battlefield visual state:
  - tapped cards stay landscape
  - untapped cards stay portrait
  - face-down state is preserved
  - art crop/rendering is preserved
  - zoom scale is preserved
  - dimensions match the card's current zoom and tapped state
- The original battlefield card should not visibly jump or re-layout during drag.

### Ghost Contract

The ghost is the drop-target preview, not the dragged real card.

- Ghost center should represent the drop position that will be written if released now.
- Ghost dimensions and orientation should match the final placed card.
- Ghost should be based on the same placement math as final drop resolution.
- Ghost should never disagree with final landed position.
- Ghost should barely lead the dragged card in the current movement direction.

Preferred lead rule:

- Lead amount is screen-space, around 8-12px.
- Lead direction comes from recent pointer velocity or current drag delta.
- Lead is zero when movement is below a small threshold.
- Lead is capped and should not accumulate.
- Lead must not lie about the final drop location.

Because the ghost must remain truthful, the implementation should make the lead part of preview/drop target selection rather than applying a purely decorative CSS offset. If a decorative offset is ever used, render a separate true landing indicator at the actual snapped target.

### Snap Contract

Snapping should feel intentional and bounded.

- Final stored battlefield positions may remain canonical snapped positions.
- The ghost may differ from the dragged real card by the snap distance.
- The difference should be predictable and visibly explained by the grid.
- The ghost should not jump due to stale overlay rects, mixed tapped dimensions, or transform mismatch.
- The dragged card itself should not be snapped while dragging; only the preview/drop target snaps.

### Zoom And Grid Contract

Zoom should scale card presentation and the visible placement affordance together.

- Card dimensions should scale predictably at all `viewScale` values.
- The visible grid should communicate actual snap targets.
- Grid should use thin lines instead of dots.
- Grid should remain visible for now.
- Grid density should use the current card-relative policy:
  - half base-card width on x
  - half base-card short side on y
  - scaled by `viewScale`
  - independent of tapped state
- At 90% zoom with `90 x 135` base cards, expected grid step is `40.5px x 40.5px`.
- At that same zoom, a tapped card is `121.5px x 81px`, so its final snapped box occupies exactly `3 x 2` grid cells. An untapped card occupies `2 x 3` grid cells.
- Zoom must not change canonical card positions.
- Zoom must not move rendered card centers except by the expected screen-space projection change.
- Legacy off-grid card centers should not be migrated by tap, render, or snapshot sanitization. They should become aligned when the user next moves them.

## Implementation Plan

### Phase 1: Preserve Center On Tap

Goal: tapping changes only orientation, not center.

Tasks:

1. Make battlefield card layout compute the visual box center consistently for tapped and untapped cards.
2. Ensure tapped rotation is applied around the intended center.
3. Add or update tests proving the rendered layout model preserves center across tap.
4. Verify with debug logs:
   - `tap-before`
   - `tap-after-frame`
   - `tap-after-settled`
   - no `move-card-request` during tap

Acceptance criteria:

- Store position is unchanged.
- DOM center delta after tap is <= 1px after animation settles.
- No move or drop logs occur for a tap-only interaction.

### Phase 2: Make Drag Overlay Match Battlefield Card State

Goal: the dragged real card remains visually identical to the card being dragged.

Tasks:

1. Stop rendering a bare `CardView` for battlefield drag overlays, or pass it the same transform/style contract used by normal battlefield cards.
2. Preserve tapped orientation, dimensions, transform origin, face-down state, art crop, and zoom scale.
3. Use pointer grab anchor as the transform origin or equivalent offset so the grabbed point stays under the pointer.
4. Verify overlay/card dimensions at every zoom level.

Acceptance criteria:

- Tapped card drag overlay is landscape.
- Untapped card drag overlay is portrait.
- Overlay dimensions equal expected zoomed dimensions.
- Pointer remains over the grabbed local point during drag.

### Phase 3: Split Live Drag Center From Drop Preview Center

Goal: make the movement model explicit.

Tasks:

1. Compute `draggedCenterScreen` from pointer plus grab anchor.
2. Convert that to an unsnapped canonical candidate.
3. Compute a movement direction from pointer velocity or drag delta.
4. Compute a lead-adjusted candidate for preview/drop target selection.
5. Snap the lead-adjusted candidate to the nearest valid canonical grid target for final drop resolution.
6. Return both:
   - live dragged card geometry
   - cursor-led ghost geometry
   - snapped final drop geometry
7. Use the snapped final drop geometry for persisted battlefield position.

Acceptance criteria:

- Drag overlay is smooth and attached to pointer.
- Ghost leads by roughly 8-12px when moving.
- Ghost does not lead while stationary.
- Final landed position matches the snapped final drop geometry.
- The live ghost remains cursor anchored; final snap distance is separately logged and bounded by the grid.
- The ghost never jumps because of tapped orientation mismatch.

### Phase 4: Rework Ghost Rendering

Goal: make the ghost visually match final placement.

Tasks:

1. Render ghost using a single source of card visual dimensions.
2. Ensure tapped ghost orientation matches the final tapped card.
3. Decide whether single-card ghost should remain a simple outline or render a translucent card-shaped preview.
4. Keep the ghost non-interactive.
5. Ensure group ghost uses the same geometry rules.

Acceptance criteria:

- Ghost dimensions match final placed card dimensions at current zoom.
- Ghost tapped state matches final placed card.
- Single and group ghosts use consistent geometry.

### Phase 5: Make Grid Match Snap

Goal: grid should explain snapping at all zoom levels without becoming a separate coordinate system.

Tasks:

1. Define one card-relative placement grid shared by visible grid and drop snapping.
2. Render thin lines instead of dots.
3. Keep grid line positions aligned with snap targets.
4. Confirm grid behavior for tapped and untapped active cards.
5. Confirm grid behavior at `viewScale` values from 1.0 down to 0.5.
6. Preserve legacy off-grid positions until the user intentionally moves the card.

Acceptance criteria:

- Grid uses thin lines.
- Grid is always visible for now.
- Grid step is half base-card width by half base-card short side at current `viewScale`.
- Grid does not change with tapped state.
- Final snapped card edges visually align with grid lines for tapped and untapped cards.
- Grid remains readable and not visually noisy.

## Debug Metrics To Keep

Keep these metrics until the implementation is stable:

- Pointer screen position.
- Pointer delta and recent movement direction.
- Drag anchor within the card.
- Active initial and translated rect.
- Visible source card rect.
- Draggable source rect.
- Source visual offset from draggable source.
- Anchor error against visible source, draggable source, overlay wrapper, and overlay card.
- Drag overlay wrapper rect.
- Drag overlay card rect.
- Battlefield card rect.
- Ghost rect.
- Zone rect.
- Current `viewScale`.
- Card dimensions for tapped and untapped states.
- Grid step and origin.
- Preview canonical position.
- Snapped canonical position.
- Final planned drop position.
- Store position after move.
- Rendered position after move settles.
- Tap before/after store position.
- Tap before/after rendered center.

## Verification Plan

### Manual Visual Checks

Run the app with:

```text
?debug=battlefieldDnd
```

Check:

- Tap an untapped card.
- Tap a tapped card.
- Drag an untapped card slowly.
- Drag an untapped card quickly.
- Drag a tapped card slowly.
- Drag a tapped card quickly.
- Drag at `viewScale` 1.0, 0.9, 0.75, and 0.5.
- Drop near grid boundaries.
- Drop near battlefield edges.
- Drag selected card groups.

### Automated Tests

Add or update focused tests around:

- `computeBattlefieldPlacement`
- `computeDragMoveUiState`
- `computeDragEndPlan`
- `computeBattlefieldCardLayout`
- `computeBattlefieldGridProjection`
- tapped overlay style/model helpers

Expected command set:

```bash
bun run --cwd apps/web typecheck
bun run --cwd apps/web test -- src/lib/__tests__/dndBattlefield.unit.test.ts src/hooks/game/dnd/__tests__/model.unit.test.ts src/models/game/seat/__tests__/battlefieldModel.unit.test.ts src/components/game/seat/__tests__/BattlefieldGridOverlay.component.test.tsx src/yjs/__tests__/sanitizeSharedSnapshot.unit.test.ts src/store/__tests__/gameStore.moveCard.unit.test.ts src/components/game/board/__tests__/CardDragOverlayView.component.test.tsx
bun run --cwd apps/web test
```

## Implementation Progress

### Completed Slices

1. Tap center stability.
   - Root cause: `sanitizeSharedSnapshot` re-snapped battlefield positions using `card.tapped`.
   - A card at tapped-grid position `{ x: 0.78, y: 0.7333333333333333 }` became `{ x: 0.76, y: 0.75 }` when untapped.
   - Fix: sanitization now preserves valid battlefield centers and only resolves exact occupied-position collisions.
   - Browser verification: double-click changed transform between `scale(0.9)` and `scale(0.9) rotate(90deg)` with center delta `0,0` and unchanged `left/top`.

2. Drag overlay orientation.
   - Root cause: `DragOverlay` rendered bare `CardView`, bypassing the battlefield card transform contract.
   - Additional root cause found during browser verification: tapped overlay content was landscape visually but still centered in a portrait/square drag box, so the visible card could sit behind the cursor/ghost even when placement math was correct.
   - Fix: `CardDragOverlayView` applies tapped/rotation transforms, keeps overlay opacity visible, and centers tapped content inside a landscape frame.
   - Browser verification: tapped overlay card rendered with `rotate(90deg)`, rect `121.5 x 81`, and opacity `1`.
   - Follow-up browser verification: active tapped drag at `viewScale = 1` measured source, overlay wrapper, tapped overlay card, and frame all at `135 x 90`, with overlay/card/frame centers matching exactly.
   - Follow-up browser verification also showed the sampled ghost ahead of the overlay by roughly `2.4px` during one live frame. This is directionally correct but below the ideal `8-12px` benchmark, likely because the overlay transform was sampled one frame ahead of the React-rendered ghost state.

3. Ghost/drop model.
   - Root cause: placement collapsed live drag center, ghost preview, and final drop target into snapped canonical placement.
   - Fix: placement now exposes `livePosition`, `liveCanonical`, `leadScreen`, `previewCanonical`, `ghostPosition`, `snappedCanonical`, and `snappedPosition`.
   - Live ghost lead is an explicit 10px screen-space vector in the movement direction, with no lead for stationary samples.
   - `ghostPosition` is cursor anchored; `snappedPosition` is the final drop target.

4. Drop truthfulness.
   - Root cause: `drag-end` used the release event's latest delta even when the rendered ghost was still the previous throttled drag-move preview.
   - Fix: the hook records the last rendered single-card snapped drop target and uses that position for the final plan.
   - Browser verification from the previous slice showed final `drag-end-plan.position`, store `card.position`, and settled DOM center matched the recorded snapped target within `0.01px`.

5. Grid visual style.
   - Root cause: the visible grid used dot markers and did not clearly describe placement.
   - Fix: overlay uses thin linear-gradient lines and remains visible for now.
   - Browser verification: grid rendered as linear gradients.

6. Grid and snap alignment.
   - Root cause: the first shared placement-grid attempt used a `0.01 x 0.01` normalized grid. It aligned mathematically but rendered as an overly dense graph-paper surface.
   - Current trial fix: `getCanonicalBattlefieldPlacementGridSteps()` now defines a shared card-relative grid: half base-card width on x and half base-card short side on y at the current `viewScale`, independent of tapped state.
   - `computeBattlefieldGridProjection()` renders that grid, and `computeBattlefieldPlacement()` snaps final drops to card-edge-aligned grid lines.
   - Expected browser scale in the current 90% zoom room: approximately `40.5px x 40.5px`, not the discarded `8.36px x 5.39px`, the tapped-misaligned `40.5px x 30.4px`, or the overly dense `40.5px x 20.25px`.
   - Tapped benchmark at 90% zoom: card dimensions `121.5px x 81px`, final snapped box `3 x 2` grid cells.
   - Untapped benchmark at 90% zoom: card dimensions `81px x 121.5px`, final snapped box `2 x 3` grid cells.
   - Important caveat: existing legacy off-grid cards remain off-grid until moved. This is intentional so tap, render, and snapshot sanitization do not silently move cards.

7. Zoom verification across levels.
   - Browser verification used wheel zoom on a tapped Treasure token.
   - Measured tapped dimensions and grid steps:
     - `viewScale 1.0`: card `135 x 90`, grid `45 x 45`
     - `viewScale 0.9`: card `121.5 x 81`, grid `40.5 x 40.5`
     - `viewScale 0.75`: card `101.25 x 67.5`, grid `33.75 x 33.75`
     - `viewScale 0.5`: card `67.5 x 45`, grid `22.5 x 22.5`
   - The card center remained fixed at every measured zoom level.

8. Group drag and mirrored geometry coverage.
   - Extracted `computeBattlefieldGroupGhostCards()` so selected group ghost geometry is testable outside the React hook.
   - Browser verification with two selected Treasure tokens at `viewScale = 0.5`:
     - tapped card size stayed `67.5 x 45`
     - untapped card size stayed `45 x 67.5`
     - both selected cards landed with identical screen delta `-97.2265625, -44.5`
     - mid-drag group ghosts rendered with the correct tapped and untapped dimensions.
   - Mirrored/opponent battlefield behavior is covered by model and placement unit tests. A live mirrored manual check still requires a second distinct client/player in the room.

9. Hand-origin drag anchor preservation.
   - Root cause: the hand card is visually scaled to `144 x 216`, but the sortable source measured `90 x 171` and the battlefield overlay target measured `90 x 135`.
   - The first anchor fix preserved the grab point relative to the visible source size but missed the visible source overhang relative to the sortable source.
   - Measured missing term: visible hand card left was `27px` left of the sortable source, so the overlay remained about `27px` right of the pointer even after resize-anchor math.
   - Fix: drag start stores both the normalized grab anchor and the visible source offset from the draggable source. Overlay rendering applies `sourceOffset + anchor * (sourceSize - targetSize)` before scale, using the actual visible target card dimensions.
   - Test benchmark from the measured hand repro:
     - pointer start `649.59375, 700`
     - source visual `144 x 216`
     - source offset `-27, 0`
     - target battlefield card `90 x 135`
     - drag anchor `0.1625434027777778, 0.6990740740740741`
     - expected overlay resize offset `-18.22265625, 56.625`
   - Browser verification after the fix:
     - `drag-start.sourceGeometry.sourceOffset` measured `-27, 0`
     - `drag-overlay-sizing.anchoredOverlay.offset` measured `-18.22265625, 56.625`
     - the overlay wrapper still had a small width mismatch from wrapper scaling, but the actual visible overlay card had anchor error `0px`
     - the pointer local percent on the visible overlay card matched the original hand-card grab anchor exactly.

10. Occupied-center placement simplification.
   - Previous behavior still carried legacy quarter-height and diagonal retry rules in several paths.
   - Fix: exact occupied centers now resolve by keeping `x` stable and bumping `y` by one visible placement-grid row.
   - Collision is intentionally center-based, not rectangle-overlap based.
   - Duplicate, related-token, snapshot-sanitize, local store, Yjs, and server movement paths now share the same visible placement-grid row benchmark.
   - Multiple created tokens now start from the same intended default center and use occupied-center resolution to stack down by rows.
   - Benchmarks:
     - if target center is free, saved center remains unchanged.
     - if one card already occupies the target center, the incoming card lands at `{ x: target.x, y: target.y + placementStepY }`.
     - if a blocker and one reserved moving card occupy the target sequence, the next moving card lands at `{ x: target.x, y: target.y + 2 * placementStepY }`.
     - duplicate initial placement remains one visible grid cell down/right from the source, but if that center is occupied, retries keep that duplicate column and move downward.

### Current Focused Test Set

```bash
bun run --cwd apps/web test -- src/lib/__tests__/dndBattlefield.unit.test.ts src/hooks/game/dnd/__tests__/model.unit.test.ts src/yjs/__tests__/sanitizeSharedSnapshot.unit.test.ts src/store/__tests__/gameStore.moveCard.unit.test.ts src/components/game/board/__tests__/CardDragOverlayView.component.test.tsx src/models/game/seat/__tests__/battlefieldModel.unit.test.ts src/components/game/seat/__tests__/BattlefieldGridOverlay.component.test.tsx src/lib/__tests__/positions.unit.test.ts src/lib/__tests__/battlefieldCollision.unit.test.ts src/hooks/game/context-menu/__tests__/model.unit.test.ts src/models/game/token-creation/__tests__/tokenCreationModel.unit.test.ts
bun run --cwd apps/web typecheck
bun run --cwd apps/server test -- src/domain/__tests__/positions.unit.test.ts src/domain/__tests__/movement.unit.test.ts
bun run --cwd apps/server typecheck
```

Latest focused result: web movement suite 11 files / 90 tests passing, server movement suite 2 files / 13 tests passing, web typecheck passing, server typecheck passing, and `git diff --check` passing.

## Recent Commits Relevant To The Regression

- `38844e3 Improve battlefield drop ghost sizing and visuals`
  - Added explicit ghost sizing and made tapped single-card ghost stop using the rotate fallback when `ghostSize` is present.
- `22651bc Refactor battlefield placement to canonical grid math`
  - Changed ghost position to derive from snapped canonical placement.
- `8cfa8e0 Improve canonical battlefield card movement`
  - Added pointer/drag-anchor correction and canonical group movement, while preserving snapped ghost behavior.

## Open Decisions

1. Should the ghost render as a simple outline or a translucent real card preview?
2. Does the current half-short-side square card-relative grid feel right, or should x/y move to full-width for an even coarser tabletop feel?
3. Should tapped cards near edges ever be clamped on tap, or should center stability always win?
4. Should the lead amount be fixed pixels, proportional to card size, or a hybrid with min/max caps?
5. Should snap target selection use pointer velocity, current delta from drag start, or a short moving average?
6. Should the single-card ghost be rendered from the same immediate transform path as the drag overlay, so live DOM samples consistently show the full 8-12px lead instead of a smaller lead when React state is one frame behind?
