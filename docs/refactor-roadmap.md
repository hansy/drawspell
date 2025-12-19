# Refactor Roadmap (mtg)

## Goals

- Modularize and better organize code (components vs hooks vs domain modules).
- Reduce duplication (DRY) and simplify logic.
- Separate “dumb”/presentational components from stateful logic.
- Improve test coverage around refactor hotspots.
- Keep behavior stable unless explicitly changed.

## Quick Architecture Snapshot

- `apps/web`: TanStack React Start + Zustand + Yjs for shared multiplayer state.
  - Zustand actions optimistically update local state and/or write through to Yjs.
  - `apps/web/src/yjs/yMutations.ts` is the “API” for Yjs map updates.
  - `apps/web/src/yjs/sync.ts` hydrates Zustand from Yjs (and marks remote updates).
- `apps/server`: Cloudflare Durable Object websocket relay for Yjs.

## Highest-Impact Hotspots (Findings)

### 1) Central store monolith

- ✅ Addressed: `apps/web/src/store/gameStore.ts` is now a thin composition root.
- Actions are split by domain in `apps/web/src/store/gameStore/actions/*`.
- Key wins:
  - Smaller, readable modules per concern (cards/movement/players/zones/deck/etc).
  - Shared helpers injected where needed (keeps actions testable).

### 2) Yjs mutation + sync surface area

- ✅ Addressed: `apps/web/src/yjs/yMutations.ts` is now a re-export “API surface”.
- Implementation is split by concern in `apps/web/src/yjs/mutations/*`.
- ✅ Addressed: `apps/web/src/yjs/docManager.ts` is now a small public API wrapper with internal modules in `apps/web/src/yjs/docManager/*` (unit-tested).
- Still a hotspot:
  - Snapshot sanitization is critical and still fairly large (now in `apps/web/src/yjs/sanitizeSharedSnapshot/index.ts`), but it is isolated and unit-tested.
  - Store actions + sync must stay aligned on “remote vs local” semantics to avoid feedback loops.

### 3) UI monoliths and mixed concerns

- ✅ Addressed: `apps/web/src/components/Game/Board/MultiplayerBoard.tsx` is now a thin wrapper over `useMultiplayerBoardController.ts` + `MultiplayerBoardView.tsx`.
- ✅ Addressed: `apps/web/src/components/Game/context/menu.ts` is now a re-export aggregator with focused modules under `apps/web/src/components/Game/context/menu/*`.
- ✅ Addressed: `apps/web/src/hooks/useGameDnD.ts` now delegates drag math to `apps/web/src/hooks/gameDnD/model.ts` (which uses `apps/web/src/lib/dndBattlefield.ts`) (unit-tested).
- ✅ Addressed: `apps/web/src/hooks/useGameShortcuts.ts` extracted matching/gating/run logic into `apps/web/src/hooks/gameShortcuts/model.ts` (unit-tested).
- ✅ Addressed: `apps/web/src/hooks/useGameContextMenu.ts` extracted related-card creation planning into `apps/web/src/hooks/gameContextMenu/model.ts` (unit-tested).
- ✅ Addressed: `apps/web/src/hooks/useGameContextMenu.ts` extracted related-parts fetching + related-card creation planning into `apps/web/src/hooks/gameContextMenu/relatedParts.ts` and `apps/web/src/hooks/gameContextMenu/relatedCardCreation.ts` (unit-tested).
- ✅ Addressed: `apps/web/src/hooks/useGameContextMenu.ts` further modularized state + wiring via `apps/web/src/hooks/gameContextMenu/useContextMenuState.ts`, `apps/web/src/hooks/gameContextMenu/actionAdapters.ts`, and `apps/web/src/hooks/gameContextMenu/createRelatedCard.ts` (unit-tested + hook-tested).
- ✅ Addressed: `apps/web/src/components/Game/Seat/Seat.tsx` is now a thin wrapper over `SeatView` + `seatModel` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/Seat/CommanderZone.tsx` is now a thin wrapper over `CommanderZoneView` + `useCommanderZoneController` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/Player/LifeBox.tsx` is now a thin wrapper over `LifeBoxView` + `useLifeBoxController` + `lifeBoxModel` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/Seat/Battlefield.tsx` extracted per-card layout/drag/highlight decisions into `apps/web/src/components/Game/Seat/battlefieldModel.ts` (unit-tested) and avoids per-card store subscriptions.
- ✅ Addressed: `apps/web/src/hooks/useElementSize.ts` centralizes the ResizeObserver + debounce sizing logic (unit-tested) and `Battlefield` now uses it.
- ✅ Addressed: `apps/web/src/components/Game/Seat/Hand.tsx` now uses `viewerPlayerId` from the `Seat` tree for face-down rendering (avoids per-card `useGameStore` subscriptions).
- ✅ Addressed: `apps/web/src/hooks/useMultiplayerSync.ts` extracted store hydration + local-player init into `apps/web/src/hooks/multiplayerSync/fullSyncToStore.ts` and `apps/web/src/hooks/multiplayerSync/ensureLocalPlayerInitialized.ts` (unit-tested), and cancels post-sync timers on cleanup.
- ✅ Addressed: `apps/web/src/components/Game/Card/CardFace.tsx` is now a thin wrapper over `CardFaceView` + `cardFaceModel` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/Card/CardFaceView.tsx` is now decomposed into focused presentational subcomponents (`CardFaceArtwork`, `CardFacePTBadge`, `CardFaceNameLabel`, `CardFaceCountersOverlay`, `CardFaceCustomTextOverlay`, `CardFaceRevealBadge`) with a regression suite in `CardFaceView.test.tsx`.
- ✅ Addressed: `apps/web/src/components/Game/Card/CardPreview.tsx` now delegates rendering to `CardPreviewView.tsx` and uses shared helpers (`apps/web/src/lib/cardPreviewPosition.ts`, `apps/web/src/lib/cardPT.ts`) (unit-tested).
  - ✅ Fixed hook-ordering bug in `CardPreview` (no hooks after early return).
  - ✅ Removed `zoneId.includes(...)` heuristics; zone-specific logic now uses `zones[zoneId].type`.
- ✅ Addressed: `apps/web/src/components/Game/UI/AddCounterModal.tsx` is now a thin wrapper over `AddCounterModalView` + `useAddCounterController` + `addCounterModel` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/UI/LoadDeckModal.tsx` is now a thin wrapper over `LoadDeckModalView` + `useLoadDeckController` + `loadDeckModel` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/UI/LogDrawer.tsx` is now a thin wrapper over `LogDrawerView` + `useLogDrawerController` + `logDrawerModel` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/UI/ContextMenu.tsx` is now a thin wrapper over `ContextMenuView` + `useContextMenuController` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/UI/Sidenav.tsx` is now a thin wrapper over `SidenavView` + `useSidenavController` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/UI/OpponentLibraryRevealsModal.tsx` is now a thin wrapper over `OpponentLibraryRevealsModalView` + `useOpponentLibraryRevealsController` + `opponentLibraryRevealsModel` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/UI/ZoneViewerModal.tsx` extracted derived-card selection + grouping helpers into `apps/web/src/components/Game/UI/zoneViewerModel.ts` (unit-tested).
  - ✅ Extracted reorder helpers into `apps/web/src/components/Game/UI/zoneViewerReorder.ts` (unit-tested).
- ✅ Addressed: `apps/web/src/components/Game/UI/ZoneViewerModalView.tsx` decomposed into `ZoneViewerModalHeader` + `ZoneViewerGroupedView` + `ZoneViewerLinearView` (unit-tested).
- Remaining UI hotspots (largest, most coupled):
  - `apps/web/src/hooks/useMultiplayerSync.ts` (sync orchestration; improved but still a large hook)
  - `apps/web/src/hooks/useGameContextMenu.ts` (async side-effects + action wiring; improved but still the main menu hotspot)
- Some places use `useGameStore.getState()` inside render paths; prefer selectors/hooks unless the hot-path read is intentional and isolated.

### 4) Type escapes + implicit invariants

- Multiple `as any` / structural assumptions around Yjs snapshots and store state.
- Some “magic limits” (e.g. max reveal recipients) exist in multiple places or aren’t centralized.

## Work Plan (Most Impactful → Least)

### Phase 1: Finish store modularization (P0)

Target: make `gameStore.ts` a thin “composition root” with minimal logic.

- Extract action implementations into `apps/web/src/store/gameStore/actions/*`:
  - `session.ts` (done)
  - `players.ts` (done)
  - `zones.ts` (done)
  - `movement.ts` (done)
  - `cards.ts` (done)
  - `deck.ts` (done)
  - `counters.ts` (done)
  - `ui.ts` (done)
- Keep `useGameStore` public API stable.
- Add missing tests for newly extracted action modules (done: session + counters + UI).

### Phase 2: Refactor Yjs modules (P1)

- ✅ Split `yMutations.ts` by concern (see `apps/web/src/yjs/mutations/*`).
- ✅ Modularized doc lifecycle + batching into `apps/web/src/yjs/docManager/*` and added regression tests (`apps/web/src/yjs/docManager.test.ts`).
- ✅ Centralize shared limits (see `apps/web/src/yjs/sanitizeLimits.ts`, `apps/web/src/lib/limits.ts`).
- ✅ Split sync concerns: `apps/web/src/yjs/sync.ts` is now a small re-export, with logic in `apps/web/src/yjs/remoteUpdateFlag.ts` and `apps/web/src/yjs/sanitizeSharedSnapshot/index.ts` (unit-tested).
- Tighten types around snapshots/maps to reduce `as any`.
- ✅ Expanded `apps/web/src/yjs/yMutations.test.ts` to cover newly extracted modules (deck unload, zone ops, player scale clamp, card ops).

### Phase 3: Separate UI containers from presentational components (P2)

- ✅ Split `MultiplayerBoard` into `useMultiplayerBoardController.ts` (store access + orchestration) and `MultiplayerBoardView.tsx` (presentational), leaving `MultiplayerBoard.tsx` as a thin wrapper.
- ✅ Split `useGameDnD` battlefield math into `apps/web/src/lib/dndBattlefield.ts` (and made the hook a thin wrapper).
- ✅ Split `Seat` into `apps/web/src/components/Game/Seat/seatModel.ts` + `SeatView.tsx`.
- ✅ Split `CardFace` into `CardFaceView.tsx` + `cardFaceModel.ts`.
- ✅ Split `CardPreview` into `CardPreviewView.tsx` and extracted positioning + P/T delta helpers into `apps/web/src/lib/*` modules.
- ✅ Extracted `ZoneViewerModal` derived-data helpers into `apps/web/src/components/Game/UI/zoneViewerModel.ts`.
- ✅ Extracted `ZoneViewerModal` reorder helpers into `apps/web/src/components/Game/UI/zoneViewerReorder.ts`.
- ✅ Modularized `useMultiplayerSync` further (helpers extracted to `apps/web/src/lib/wsSignaling.ts`, `apps/web/src/lib/clientKey.ts`, and `apps/web/src/hooks/multiplayerSync/*` (e.g. `applyLocalPlayerInitPlan.ts`, `debouncedTimeout.ts`, `disposeSessionTransport.ts`, `fullSyncToStore.ts`, `ensureLocalPlayerInitialized.ts`) (unit-tested)).
- Add regression tests for extracted logic (prefer pure unit tests; keep UI rendering tests minimal).

### Phase 4: Split the context menu builder (P3)

- ✅ Done: `apps/web/src/components/Game/context/menu.ts` is now an aggregator with modules under `apps/web/src/components/Game/context/menu/*`.
- Keep `apps/web/src/components/Game/context/menu.test.ts` as the primary regression harness.

### Phase 5: Clean up remaining redundancies and type escapes (P4)

- Remove non-reactive store access inside render paths.
- Consolidate duplicated utilities (`safeStorage` already centralized).
- Replace `as any` in high-traffic code paths with safe adapters.
- ✅ Modularized logging registry into `apps/web/src/logging/eventRegistry/*` (unit-tested).
- ✅ Centralized log aggregation/building in `apps/web/src/logging/logEntryModel.ts` and refactored `apps/web/src/logging/logStore.ts` to use it (unit-tested).
- ✅ Added unit tests for reveal helpers in `apps/web/src/lib/reveal.test.ts`.
- ✅ Removed duplicated `SideZone` className string (`apps/web/src/components/Game/Seat/SideZone.tsx`).
- ✅ Removed unused `apps/web/src/components/Game/Board/BattlefieldGridOverlay.tsx`.

### Phase 6: Server worker modularization (P5)

- ✅ Done: `apps/server/index.ts` is now a thin entrypoint delegating to:
  - `apps/server/worker.ts`
  - `apps/server/signalRoom.ts`
  - `apps/server/env.ts` / `apps/server/constants.ts`
- Next: add minimal tests (or type-level assertions) for message handling if this becomes a change hotspot.

## Additional Findings / Nice-to-Haves (Lower Impact)

- `apps/web/src/services/scryfallCache.ts` is large (IndexedDB + fetch + batching). Consider splitting into `idb.ts` + `fetch.ts` + `cache.ts` and adding unit tests around serialization/batching.
- `apps/web/src/utils/deckImport.ts` is large but well-tested; refactor only if behavior changes are needed.
