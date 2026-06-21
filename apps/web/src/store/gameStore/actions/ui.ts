import type { StoreApi } from "zustand";

import type { BattlefieldGridSizing, GameState } from "@/types";
import type { DispatchIntent } from "@/store/gameStore/dispatchIntent";
import { debugLog, type DebugFlagKey } from "@/lib/debug";


type SetState = StoreApi<GameState>["setState"];
type GetState = StoreApi<GameState>["getState"];

type Deps = {
  dispatchIntent: DispatchIntent;
};

const BATTLEFIELD_DND_DEBUG_KEY: DebugFlagKey = "battlefieldDnd";

const areSizingEqual = (a: BattlefieldGridSizing | undefined, b: BattlefieldGridSizing) =>
  Boolean(
    a &&
      a.zoneWidthPx === b.zoneWidthPx &&
      a.zoneHeightPx === b.zoneHeightPx &&
      a.baseCardHeightPx === b.baseCardHeightPx &&
      a.baseCardWidthPx === b.baseCardWidthPx
  );

export const createUiActions = (
  set: SetState,
  get: GetState,
  { dispatchIntent }: Deps
): Pick<GameState, "setActiveModal" | "setBattlefieldViewScale" | "setBattlefieldGridSizing"> => ({
  setActiveModal: (modal) => {
    set({ activeModal: modal });
  },

  setBattlefieldViewScale: (playerId, scale) => {
    const clamped = Math.min(Math.max(scale, 0.5), 1);
    const current = get().battlefieldViewScale[playerId];
    if (current === clamped) return;

    debugLog(BATTLEFIELD_DND_DEBUG_KEY, "battlefield-scale-set", {
      playerId,
      requestedScale: scale,
      previousScale: current ?? 1,
      nextScale: clamped,
    });

    dispatchIntent({
      type: "ui.battlefieldScale.set",
      payload: { playerId, scale: clamped },
      applyLocal: (state) => ({
        battlefieldViewScale: {
          ...state.battlefieldViewScale,
          [playerId]: clamped,
        },
      }),
    });
  },

  setBattlefieldGridSizing: (playerId, sizing) => {
    set((state) => {
      if (!sizing) {
        if (!state.battlefieldGridSizing[playerId]) return {};
        debugLog(BATTLEFIELD_DND_DEBUG_KEY, "battlefield-grid-sizing-clear", {
          playerId,
          previousSizing: state.battlefieldGridSizing[playerId],
        });
        const next = { ...state.battlefieldGridSizing };
        Reflect.deleteProperty(next, playerId);
        return { battlefieldGridSizing: next };
      }
      if (areSizingEqual(state.battlefieldGridSizing[playerId], sizing)) {
        return {};
      }
      debugLog(BATTLEFIELD_DND_DEBUG_KEY, "battlefield-grid-sizing-set", {
        playerId,
        previousSizing: state.battlefieldGridSizing[playerId],
        nextSizing: sizing,
      });
      return {
        battlefieldGridSizing: {
          ...state.battlefieldGridSizing,
          [playerId]: sizing,
        },
      };
    });
  },
});
