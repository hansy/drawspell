import type { StoreApi } from "zustand";
import { v4 as uuidv4 } from "uuid";

import type { GameState } from "@/types";

import { clearLogs } from "@/logging/logStore";
import { deleteSessionIdentity, getOrCreateSessionIdentity } from "@/lib/sessionIdentity";
import { destroySession, getSessionHandles } from "@/yjs/docManager";
import { patchRoomMeta, removePlayer as yRemovePlayer, type SharedMaps } from "@/yjs/yMutations";

const resolveNextHostId = (maps: SharedMaps): string | null => {
  const ordered = maps.playerOrder.toArray().filter((id): id is string => typeof id === "string");
  for (const id of ordered) {
    if (maps.players.get(id)) return id;
  }
  const fallback = Array.from(maps.players.keys())
    .map((id) => String(id))
    .sort()[0];
  return fallback ?? null;
};

type SetState = StoreApi<GameState>["setState"];
type GetState = StoreApi<GameState>["getState"];

export const createSessionActions = (
  set: SetState,
  get: GetState
): Pick<
  GameState,
  | "playerIdsBySession"
  | "sessionVersions"
  | "sessionId"
  | "myPlayerId"
  | "hasHydrated"
  | "resetSession"
  | "ensurePlayerIdForSession"
  | "forgetSessionIdentity"
  | "ensureSessionVersion"
  | "leaveGame"
  | "setHasHydrated"
  | "viewerRole"
  | "setViewerRole"
> => {
  const initialSessionId = uuidv4();
  const initialPlayerId = uuidv4();

  return {
    playerIdsBySession: {},
    sessionVersions: {},
    hasHydrated: false,
    viewerRole: "player",
    sessionId: initialSessionId,
    myPlayerId: initialPlayerId,

    resetSession: (newSessionId) => {
      const freshSessionId = newSessionId ?? uuidv4();
      const identity = getOrCreateSessionIdentity(freshSessionId);
      const freshPlayerId = identity.playerId;

      clearLogs();

      set((state) => ({
        players: {},
        playerOrder: [],
        cards: {},
        zones: {},
        battlefieldViewScale: {},
        roomHostId: null,
        roomLockedByHost: false,
        roomOverCapacity: false,
        viewerRole: "player",
        sessionId: freshSessionId,
        myPlayerId: freshPlayerId,
        playerIdsBySession: {
          ...state.playerIdsBySession,
          [freshSessionId]: freshPlayerId,
        },
        sessionVersions: {
          ...state.sessionVersions,
          [freshSessionId]: (state.sessionVersions[freshSessionId] ?? 0) + 1,
        },
        globalCounters: {},
        activeModal: null,
      }));
    },

    ensurePlayerIdForSession: (sessionId: string) => {
      const existing = get().playerIdsBySession[sessionId];
      const identity = getOrCreateSessionIdentity(sessionId);
      if (existing === identity.playerId) return existing;
      const fresh = identity.playerId;
      set((state) => ({
        playerIdsBySession: { ...state.playerIdsBySession, [sessionId]: fresh },
      }));
      return fresh;
    },

    forgetSessionIdentity: (sessionId: string) => {
      set((state) => {
        const next = { ...state.playerIdsBySession };
        delete next[sessionId];
        const nextVersions = { ...state.sessionVersions };
        nextVersions[sessionId] = (nextVersions[sessionId] ?? 0) + 1;
        return { playerIdsBySession: next, sessionVersions: nextVersions };
      });
      deleteSessionIdentity(sessionId);
    },

    ensureSessionVersion: (sessionId: string) => {
      const current = get().sessionVersions[sessionId];
      if (typeof current === "number") return current;
      const next = 1;
      set((state) => ({
        sessionVersions: { ...state.sessionVersions, [sessionId]: next },
      }));
      return next;
    },

    leaveGame: () => {
      const sessionId = get().sessionId;
      const playerId = get().myPlayerId;

      if (sessionId) {
        const handles = getSessionHandles(sessionId);
        if (handles) {
          handles.doc.transact(() => {
            const maps: SharedMaps = {
              players: handles.players,
              playerOrder: handles.playerOrder,
              zones: handles.zones,
              cards: handles.cards,
              zoneCardOrders: handles.zoneCardOrders,
              globalCounters: handles.globalCounters,
              battlefieldViewScale: handles.battlefieldViewScale,
              meta: handles.meta,
            };
            const currentHostId = handles.meta.get("hostId");
            const isHost = typeof currentHostId === "string" && currentHostId === playerId;
            yRemovePlayer(maps, playerId);
            if (isHost) {
              patchRoomMeta(maps, { hostId: resolveNextHostId(maps) });
            }
          });
        }

        try {
          destroySession(sessionId);
        } catch (_err) {}

        get().forgetSessionIdentity(sessionId);
      }

      get().resetSession();
    },

    setHasHydrated: (next) => {
      set({ hasHydrated: next });
    },

    setViewerRole: (role) => {
      set({ viewerRole: role });
    },
  };
};
