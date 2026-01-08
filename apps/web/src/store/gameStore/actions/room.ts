import type { StoreApi } from "zustand";

import type { GameState } from "@/types";
import type { SharedMaps } from "@/yjs/yMutations";
import { patchRoomMeta } from "@/yjs/yMutations";
import { MAX_PLAYERS } from "@/lib/room";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog } from "@/commandLog";

type SetState = StoreApi<GameState>["setState"];
type GetState = StoreApi<GameState>["getState"];

type ApplyShared = (fn: (maps: SharedMaps) => void) => boolean;

type Deps = {
  applyShared: ApplyShared;
};

export const createRoomActions = (
  set: SetState,
  get: GetState,
  { applyShared }: Deps
): Pick<GameState, "setRoomLockedByHost"> => ({
  setRoomLockedByHost: (locked) => {
    const state = get();
    if (state.viewerRole === "spectator") return;
    if (!state.roomHostId || state.roomHostId !== state.myPlayerId) return;

    const playerCount = Object.keys(state.players).length;
    const isFull = playerCount >= MAX_PLAYERS;
    if (!locked && isFull) return;

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "room.lock.set",
          buildPayloads: () => ({ payloadPublic: { locked } }),
        });
        return;
      }
    }

    if (applyShared((maps) => {
      patchRoomMeta(maps, { locked });
    })) return;

    set({ roomLockedByHost: locked });
  },
});
