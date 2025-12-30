/**
 * WebSocket-based Yjs sync via the Cloudflare Durable Object relay.
 *
 * This keeps transport simple and reliable: one server relay, one provider.
 */
import { useEffect, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import { useGameStore } from "@/store/gameStore";
import { bindSharedLogStore } from "@/logging/logStore";
import { getOrCreateClientKey } from "@/lib/clientKey";
import {
  acquireSession,
  cleanupStaleSessions,
  getSessionAwareness,
  getSessionProvider,
  releaseSession,
  setSessionProvider,
  setSessionAwareness,
  setActiveSession,
  flushPendingMutations,
} from "@/yjs/docManager";
import { type SharedMaps } from "@/yjs/yMutations";
import { isApplyingRemoteUpdate } from "@/yjs/sync";
import { buildSignalingUrlFromEnv } from "@/lib/wsSignaling";
import { useClientPrefsStore } from "@/store/clientPrefsStore";
import { createFullSyncToStore } from "./fullSyncToStore";
import {
  ensureLocalPlayerInitialized,
  type LocalPlayerInitResult,
} from "./ensureLocalPlayerInitialized";
import { computePeerCounts, type PeerCounts } from "./peerCount";
import {
  cancelDebouncedTimeout,
  scheduleDebouncedTimeout,
} from "./debouncedTimeout";
import { disposeSessionTransport } from "./disposeSessionTransport";

export type SyncStatus = "connecting" | "connected";
type JoinBlockedReason = NonNullable<LocalPlayerInitResult>["reason"] | null;

const CLIENT_VERSION = "web-3-ws";

export function useMultiplayerSync(sessionId: string) {
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const viewerRole = useGameStore((state) => state.viewerRole);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [peerCounts, setPeerCounts] = useState<PeerCounts>(() => ({
    total: 1,
    players: viewerRole === "spectator" ? 0 : 1,
    spectators: viewerRole === "spectator" ? 1 : 0,
  }));
  const [joinBlocked, setJoinBlocked] = useState(false);
  const [joinBlockedReason, setJoinBlockedReason] =
    useState<JoinBlockedReason>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const localPlayerIdRef = useRef<string | null>(null);
  const fullSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postSyncFullSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postSyncInitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptJoinRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    attemptJoinRef.current?.();
    const awareness = awarenessRef.current;
    const playerId = localPlayerIdRef.current;
    if (awareness && playerId) {
      awareness.setLocalStateField("client", { id: playerId, role: viewerRole });
    }
  }, [viewerRole]);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof window === "undefined") return;
    if (!hasHydrated) return;

    setJoinBlocked(false);
    setJoinBlockedReason(null);

    const envUrl = import.meta.env.VITE_WEBSOCKET_SERVER;
    const signalingUrl = buildSignalingUrlFromEnv(envUrl);
    if (!signalingUrl) {
      console.error("[signal] VITE_WEBSOCKET_SERVER is required");
      return;
    }

    cleanupStaleSessions();
    const handles = acquireSession(sessionId);
    setActiveSession(sessionId);

    const {
      doc,
      players,
      playerOrder,
      zones,
      cards,
      zoneCardOrders,
      globalCounters,
      battlefieldViewScale,
      logs,
      meta,
    } = handles;

    const sharedMaps: SharedMaps = {
      players,
      playerOrder,
      zones,
      cards,
      zoneCardOrders,
      globalCounters,
      battlefieldViewScale,
      meta,
    };

    // Setup store
    const store = useGameStore.getState();
    const ensuredPlayerId = store.ensurePlayerIdForSession(sessionId);
    localPlayerIdRef.current = ensuredPlayerId;
    const needsReset =
      store.sessionId !== sessionId || store.myPlayerId !== ensuredPlayerId;
    if (needsReset) {
      store.resetSession(sessionId, ensuredPlayerId);
    } else {
      useGameStore.setState((state) => ({ ...state, sessionId }));
    }
    const sessionVersion = useGameStore.getState().ensureSessionVersion(sessionId);

    bindSharedLogStore(logs);

    const awareness = new Awareness(doc);
    awarenessRef.current = awareness;
    const clientKey = getOrCreateClientKey({
      storage: window.sessionStorage,
      randomUUID:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID.bind(crypto)
          : undefined,
    });

    const provider = new WebsocketProvider(signalingUrl, sessionId, doc, {
      awareness,
      connect: true,
      params: {
        userId: ensuredPlayerId,
        clientKey,
        sessionVersion: String(sessionVersion),
        clientVersion: CLIENT_VERSION,
      },
    });

    setSessionProvider(sessionId, provider);
    setSessionAwareness(sessionId, awareness);

    const fullSyncToStore = createFullSyncToStore(sharedMaps, (next) => {
      useGameStore.setState(next);
    });

    const attemptJoin = () => {
      const role = useGameStore.getState().viewerRole;
      if (role === "spectator") {
        setJoinBlocked(false);
        setJoinBlockedReason(null);
        return;
      }
      const result = ensureLocalPlayerInitialized({
        transact: (fn) => doc.transact(fn),
        sharedMaps,
        playerId: ensuredPlayerId,
        preferredUsername: useClientPrefsStore.getState().username,
      });
      const blocked = result?.status === "blocked";
      setJoinBlocked(blocked);
      setJoinBlockedReason(blocked ? result!.reason : null);
    };
    attemptJoinRef.current = attemptJoin;

    const SYNC_DEBOUNCE_MS = 50;
    const scheduleFullSync = () => {
      scheduleDebouncedTimeout(fullSyncTimer, SYNC_DEBOUNCE_MS, fullSyncToStore);
    };

    const handleDocUpdate = () => {
      if (isApplyingRemoteUpdate()) return;
      scheduleFullSync();
    };
    doc.on("update", handleDocUpdate);

    // Awareness
    const pushLocalAwareness = () => {
      awareness.setLocalStateField("client", {
        id: ensuredPlayerId,
        role: useGameStore.getState().viewerRole,
      });
    };
    pushLocalAwareness();

    const handleAwareness = () => {
      setPeerCounts(computePeerCounts(awareness.getStates()));
    };
    awareness.on("change", handleAwareness);
    handleAwareness();

    provider.on("status", ({ status: s }: any) => {
      if (s === "connected") {
        setStatus("connected");
        flushPendingMutations();
        pushLocalAwareness();
      }
      if (s === "disconnected") {
        setStatus("connecting");
      }
    });

    provider.on("sync", (isSynced: boolean) => {
      if (!isSynced) return;
      flushPendingMutations();
      scheduleDebouncedTimeout(postSyncFullSyncTimer, 50, fullSyncToStore);
      scheduleDebouncedTimeout(postSyncInitTimer, 60, attemptJoin);
    });

    flushPendingMutations();

    return () => {
      awareness.setLocalState(null);
      awarenessRef.current = null;
      localPlayerIdRef.current = null;
      try {
        removeAwarenessStates(awareness, [awareness.clientID], "disconnect");
      } catch (_err) {}

      awareness.off("change", handleAwareness);
      doc.off("update", handleDocUpdate);
      cancelDebouncedTimeout(fullSyncTimer);
      cancelDebouncedTimeout(postSyncFullSyncTimer);
      cancelDebouncedTimeout(postSyncInitTimer);

      bindSharedLogStore(null);
      setActiveSession(null);

      disposeSessionTransport(sessionId, { provider, awareness }, {
        getSessionProvider,
        setSessionProvider,
        getSessionAwareness,
        setSessionAwareness,
      });

      releaseSession(sessionId);
      cleanupStaleSessions();

      attemptJoinRef.current = null;
    };
  }, [sessionId, hasHydrated]);

  return { status, peerCounts, joinBlocked, joinBlockedReason };
}
