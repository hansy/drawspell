# Battlefield cameras

Every battlefield has a large fixed grid and every viewer has an independent
camera onto it. Default zoom shows three card heights. Wider seats show more
columns; changing aspect ratio never compresses the gaps between cards.

## Coordinates and starting view

Card centers retain the existing `{ x, y }` payload. Those values now describe a
fixed reference space: multiply X by 1000 and Y by 600 to obtain world units.
An untapped card is 120 units high, with the physical 63:88 aspect ratio. The
placement lattice has 40-unit steps on both axes. Tapping changes orientation,
not position or snap spacing. Coordinates are finite and bounded to ±2.4 on each
stored axis; this is a 4,800 × 2,880 unit board, centered around the origin
(about 56 card widths by 24 card heights; 120 × 72 grid intervals).

The shared starting card center is `(0, 0)`, in the middle of that board. The
initial camera places it near the top-left of an upright seat, or bottom-right
of a seat rotated 180 degrees. Both axes reverse on rotated seats. The inset
allows the whole card, including a tapped card and its name, to remain visible.
Each camera computes a different center when necessary to keep this anchor in
the corresponding corner of its viewport.

Before the first battlefield placement, the owner can pan freely. The placement
intent carries the world point at the owner's viewing anchor; the server stores
it as `player.battlefieldCameraAnchor` only after a successful placement, in the
same transaction. Untouched cameras (including new viewers) use that shared
anchor. A viewer who has already panned or zoomed keeps their own camera. Card
coordinates are never rebased. Subsequent placements and an empty battlefield
do not change the anchor. Explicit deck reset/unload clears it and advances
`battlefieldCameraEpoch`, starting fresh local camera state for that battlefield.
Existing populated arrangements without metadata retain the original zero anchor.


Default camera scale is `usableHeight / (3 * 120)`. Local zoom multiplies that
scale uniformly for cards, grid spacing, labels, counters, and placement
previews. Resize changes the default scale, not world positions. Drag/drop and
box selection use the same camera and inverse conversion as rendering.

## Controls

- Hold the right mouse button on empty battlefield space and drag to pan. The
  grid appears immediately, using the same gray lines as card dragging. Card context menus remain available.
- Wheel zoom follows the pointer. Two-finger touch navigation pans and pinches
  around the gesture center. Card dragging remains a separate interaction.
- A minimal vertical slider and percentage appear only when that battlefield's
  zoom changes, then disappear after 900 ms without zoom input. Dragging the
  slider keeps it visible until release. Its midpoint marks the default 100%.
  There are no persistent camera controls or buttons.
- Keyboard zoom continues to target the viewer's own battlefield.
- Minimum zoom keeps the grid covering the entire viewport; maximum zoom is 2×
  default (1.5 card heights visible). Every input uses fixed five-percentage-point
  levels (90%, 95%, 100%, 105%, etc.). The viewport minimum rounds up to a valid
  level, so it never exposes a world edge. Wheel input accumulates 60 pixels of movement per step and applies at
  most one step every 60 ms. Pinch accumulates small movements at half sensitivity before snapping to the
  same levels. The slider maps each half linearly with Default in the middle;
  its arrow keys also move one level at a time.
  Zoom transitions ease over 160 ms using one camera for grid, cards, annotations,
  and hit testing. Repeated input continues from the current frame. Panning,
  touch navigation, resizing, and reduced-motion preferences bypass easing.

Panning stops flush at the board boundary: no exterior margin or black strips
can enter the container. Zoom, resize, mouse, and touch all use the same bounds.
With differing board and viewport aspect ratios, minimum zoom crops one axis;
panning can reveal the remaining extent. Keeping the grid covering the viewport takes priority over
showing the entire board at once.

Names and custom text disappear below a displayed card width of 64 CSS pixels.
P/T and counter values stay at least 12 CSS pixels while shown, then disappear
below a card width of 42 CSS pixels. Normal hover/tap inspection retains details.
The side controls, life totals, hand, and other zones are outside the camera.

## Sync and compatibility

Only card moves change shared positions. The first placement additionally saves
the starting anchor; ongoing zoom, pan, viewport measurements, and
annotation detail levels are local. Pan is kept in a separate view-only store,
keyed by room, viewer, battlefield owner, and reset epoch, so switching portrait seats does
not discard it. Current clients never dispatch `ui.battlefieldScale.set` and
ignore the old shared zoom map when hydrating. Full snapshots, private overlay
updates, and rejected-intent reconciliation preserve local zoom.

Already-normalized saved positions retain their exact values. The new default
camera may not include an old arrangement; zoom and pan reveal it without rewriting it.
Magnitude-based legacy-pixel detection has been removed from all live movement,
card write/read, duplication, and snapshot paths: values above 1 are now valid
world positions, not evidence of a legacy format. Truly old pixel-coordinate
imports need an explicit conversion rather than guessing from their values.

Ship client and server changes together and have active clients reload. Older
clients still interpret positions as viewport fractions and cannot correctly
render or write the extended grid. No production deployment is part of the
local implementation/preview.

## Local review

From `apps/web`, run:

```sh
bunx vite --config test/manual/vite.camera.config.ts
```

Open `http://127.0.0.1:4194/test/manual/battlefield-camera.html`. The fixture uses
the actual battlefield/camera/drag components with local sample cards in wide,
narrow, and rotated views. It opens no multiplayer connection. Sample card moves
are mirrored across the three windows; camera changes remain independent.

`bun test/manual/check-camera.ts` drives Chromium through initial alignment,
right-drag grid visibility and release, independent smooth zoom, temporary controls, drag/drop,
resize, and bounded panning.
It requires Chrome at the path in the script.

For the full application, run `VITE_ENV=development bun run dev:all` from the
repository root, with matching local `JOIN_TOKEN_SECRET` values in the web and
server `.dev.vars` files. From `apps/web`, `bun test/manual/check-app-camera.ts`
creates a local room and two independent browser identities with different
viewport sizes. It checks mirrored starting anchors, local cameras, hand-to-field
drops against their previews, shared movement/tapping, card menus, and sideboard
access, portrait camera retention, and reconnect positions. The sideboard is available in the owner’s library context menu, since
empty battlefield right-click now pans.

Regression tests cover coordinate round trips, viewport-independent spacing,
rotated anchors, panned/zoomed drops, group offsets, touch navigation, zoom
isolation, and server Yjs serialization/reload of signed positions.
