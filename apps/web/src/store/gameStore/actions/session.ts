import type { StoreApi } from "zustand";
import { v4 as uuidv4 } from "uuid";

import type { GameState } from "@/types";

import { clearLogs } from "@/logging/logStore";
import { handoffDebugLog, handoffDebugTokenSummary } from "@/lib/debug";
import { destroyAllSessions, destroySession } from "@/yjs/docManager";
import type { DispatchIntent } from "@/store/gameStore/dispatchIntent";
import { resetIntentState } from "@/store/gameStore/dispatchIntent";
import { clearRoomHostPending, writeRoomTokensToStorage } from "@/lib/partyKitToken";
import { useClientPrefsStore } from "@/store/clientPrefsStore";
import { clearIntentTransport } from "@/partykit/intentTransport";

type SetState = StoreApi<GameState>["setState"];
type GetState = StoreApi<GameState>["getState"];

const INITIAL_SESSION_ID = "";
const INITIAL_PLAYER_ID = "";

export const createSessionActions = (
  set: SetState,
  get: GetState,
  { dispatchIntent }: { dispatchIntent: DispatchIntent }
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
  | "overlayCapabilities"
  | "setOverlayCapabilities"
  | "roomTokens"
  | "setRoomTokens"
  | "lastResumeTokenBySession"
  | "cacheResumeTokenForSession"
> => ({
  playerIdsBySession: {},
  sessionVersions: {},
  sessionId: INITIAL_SESSION_ID,
  myPlayerId: INITIAL_PLAYER_ID,
  hasHydrated: false,
  viewerRole: "player",
  overlayCapabilities: [],
  roomTokens: null,
  lastResumeTokenBySession: {},

  resetSession: (newSessionId, playerId) => {
    const current = get();
    const freshSessionId = newSessionId ?? uuidv4();
    const freshPlayerId =
      playerId ?? current.playerIdsBySession[freshSessionId] ?? uuidv4();

    handoffDebugLog("session.reset", {
      previousSessionId: current.sessionId,
      nextSessionId: freshSessionId,
      previousPlayerId: current.myPlayerId,
      nextPlayerId: freshPlayerId,
      sameSessionId: current.sessionId === freshSessionId,
      samePlayerId: current.myPlayerId === freshPlayerId,
      hadPlayerTokenBeforeReset: Boolean(current.roomTokens?.playerToken),
      hadSpectatorTokenBeforeReset: Boolean(current.roomTokens?.spectatorToken),
      hadResumeTokenBeforeReset: Boolean(current.roomTokens?.resumeToken),
      playerTokenBeforeReset: handoffDebugTokenSummary(current.roomTokens?.playerToken),
      spectatorTokenBeforeReset: handoffDebugTokenSummary(
        current.roomTokens?.spectatorToken,
      ),
      resumeTokenBeforeReset: handoffDebugTokenSummary(current.roomTokens?.resumeToken),
    });

    clearLogs();
    resetIntentState();

    set((state) => ({
      players: {},
      playerOrder: [],
      cards: {},
      zones: {},
      handRevealsToAll: {},
      libraryRevealsToAll: {},
      faceDownRevealsToAll: {},
      battlefieldViewScale: {},
      battlefieldGridSizing: {},
      roomHostId: null,
      roomLockedByHost: false,
      roomOverCapacity: false,
      privateOverlay: null,
      overlayCapabilities: [],
      roomTokens: null,
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
    if (existing) return existing;
    const fresh = uuidv4();
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
      const nextResumeTokens = { ...state.lastResumeTokenBySession };
      delete nextResumeTokens[sessionId];
      return {
        playerIdsBySession: next,
        sessionVersions: nextVersions,
        lastResumeTokenBySession: nextResumeTokens,
      };
    });
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
      dispatchIntent({
        type: "player.leave",
        payload: { playerId, actorId: playerId },
        suppressDropToast: true,
      });

      try {
        destroySession(sessionId);
      } catch (_err) {}
      try {
        destroyAllSessions();
      } catch (_err) {}
      try {
        clearIntentTransport();
      } catch (_err) {}

      get().forgetSessionIdentity(sessionId);
      writeRoomTokensToStorage(sessionId, null);
      clearRoomHostPending(sessionId);
      useClientPrefsStore.getState().clearLastSessionId();
    }

    get().resetSession();
  },

  setHasHydrated: (next) => {
    set({ hasHydrated: next });
  },

  setViewerRole: (role) => {
    set({ viewerRole: role });
  },

  setOverlayCapabilities: (capabilities) => {
    set({ overlayCapabilities: [...capabilities] });
  },

  cacheResumeTokenForSession: (sessionId, resumeToken) => {
    const normalizedSessionId = sessionId.trim();
    const normalizedResumeToken = resumeToken.trim();
    if (!normalizedSessionId || !normalizedResumeToken) return;
    set((state) => {
      const nextResumeTokens = {
        ...state.lastResumeTokenBySession,
        [normalizedSessionId]: normalizedResumeToken,
      };
      handoffDebugLog("session.resumeToken.cached", {
        storeSessionId: state.sessionId,
        cacheSessionId: normalizedSessionId,
        resumeToken: handoffDebugTokenSummary(normalizedResumeToken),
        cachedResumeToken: handoffDebugTokenSummary(
          nextResumeTokens[normalizedSessionId],
        ),
      });
      return {
        lastResumeTokenBySession: nextResumeTokens,
      };
    });
  },

  setRoomTokens: (tokens) => {
    set((state) => {
      const nextRoomTokens = tokens ? { ...state.roomTokens, ...tokens } : null;
      const shouldLogTransition =
        Boolean(state.roomTokens?.resumeToken) ||
        Boolean(nextRoomTokens?.resumeToken) ||
        (Boolean(state.roomTokens) && !nextRoomTokens);
      if (shouldLogTransition) {
        handoffDebugLog("session.roomTokens.updated", {
          sessionId: state.sessionId,
          hadPlayerToken: Boolean(state.roomTokens?.playerToken),
          hadSpectatorToken: Boolean(state.roomTokens?.spectatorToken),
          previousResumeToken: handoffDebugTokenSummary(
            state.roomTokens?.resumeToken,
          ),
          hasPlayerToken: Boolean(nextRoomTokens?.playerToken),
          hasSpectatorToken: Boolean(nextRoomTokens?.spectatorToken),
          nextResumeToken: handoffDebugTokenSummary(nextRoomTokens?.resumeToken),
          clearedRoomTokens: Boolean(state.roomTokens) && !nextRoomTokens,
          cachedResumeToken: handoffDebugTokenSummary(
            state.lastResumeTokenBySession?.[state.sessionId],
          ),
        });
      }
      return { roomTokens: nextRoomTokens };
    });
  },
});
