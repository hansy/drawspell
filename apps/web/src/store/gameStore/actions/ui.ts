import { battlefieldCameraKey, useBattlefieldCameraStore } from "@/store/battlefieldCameraStore";
import type { BattlefieldGridSizing, GameState } from "@/types";
import { snapBattlefieldZoom } from "@/lib/battlefieldZoom";
import type { DispatchIntent } from "@/store/gameStore/dispatchIntent";
import { debugLog, type DebugFlagKey } from "@/lib/debug";
import type { GetState, SetState } from "./types";

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
      a.baseCardWidthPx === b.baseCardWidthPx &&
      a.camera === b.camera
  );

export const createUiActions = (
  set: SetState,
  get: GetState,
  _deps: Deps
): Pick<GameState, "setActiveModal" | "setBattlefieldViewScale" | "setBattlefieldGridSizing"> => ({
  setActiveModal: (modal) => {
    set({ activeModal: modal });
  },

  setBattlefieldViewScale: (playerId, scale, automatic = false) => {
    if (!Number.isFinite(scale)) return;
    const clamped = snapBattlefieldZoom(scale);
    const current = get().battlefieldViewScale[playerId];
    if (!automatic) {
      const state = get();
      useBattlefieldCameraStore.getState().markManual(battlefieldCameraKey(
        state.sessionId, state.myPlayerId, playerId, state.players[playerId]?.battlefieldCameraEpoch,
      ));
    }
    if (current === clamped) return;

    debugLog(BATTLEFIELD_DND_DEBUG_KEY, "battlefield-scale-set", {
      playerId,
      requestedScale: scale,
      previousScale: current ?? 1,
      nextScale: clamped,
    });

    set((state) => ({
      battlefieldViewScale: { ...state.battlefieldViewScale, [playerId]: clamped },
    }));
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
