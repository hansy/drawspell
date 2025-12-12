/**
 * WebRTC-based Yjs sync using your own signaling server.
 *
 * Uses y-webrtc for peer-to-peer communication with lower latency.
 * WebSocket is used as fallback relay when P2P connection fails.
 */
import { useEffect, useRef, useState } from 'react';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import { useGameStore } from '../store/gameStore';
import { bindSharedLogStore } from '../logging/logStore';
import {
  acquireSession,
  releaseSession,
  setSessionProvider,
  setSessionAwareness,
  setActiveSession,
  flushPendingMutations,
} from '../yjs/docManager';
import { sharedSnapshot, upsertPlayer, upsertZone, upsertCard, removeCard, reorderZoneCards } from '../yjs/yMutations';
import {
  clampNormalizedPosition,
  migratePositionToNormalized,
} from '../lib/positions';
import type { Card, Counter, Player, Zone } from '../types';

export type SyncStatus = 'connecting' | 'connected' | 'p2p';

// Limits for sanitization
const MAX_PLAYERS = 8;
const MAX_ZONES = MAX_PLAYERS * 10;
const MAX_CARDS = 800;
const MAX_COUNTERS = 24;
const MAX_NAME_LENGTH = 120;

// Client identification
const CLIENT_KEY_STORAGE = 'mtg:client-key';
const CLIENT_VERSION = 'web-2-webrtc';

// Flag to prevent feedback loops
let applyingRemoteUpdate = false;

export function isApplyingRemoteUpdate(): boolean {
  return applyingRemoteUpdate;
}

const genUuidLike = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getClientKey = () => {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.sessionStorage.getItem(CLIENT_KEY_STORAGE);
    if (existing) return existing;
    const next = crypto.randomUUID?.() ?? genUuidLike();
    window.sessionStorage.setItem(CLIENT_KEY_STORAGE, next);
    return next;
  } catch {
    return genUuidLike();
  }
};

// Sanitization helpers (same as useYjsSync)
const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
};

const normalizePosition = (pos: any) => {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
    return { x: 0.5, y: 0.5 };
  }
  const needsMigration = pos.x > 1 || pos.y > 1;
  const next = needsMigration ? migratePositionToNormalized(pos) : clampNormalizedPosition(pos);
  return { x: next.x, y: next.y };
};

const sanitizeCounters = (value: any): Counter[] => {
  if (!Array.isArray(value)) return [];
  const result: Counter[] = [];
  for (const c of value) {
    if (!c || typeof c.type !== 'string') continue;
    const count = clampNumber(c.count, 0, 999, 0);
    const counter: Counter = { type: c.type.slice(0, 64), count };
    if (typeof c.color === 'string') counter.color = c.color.slice(0, 32);
    result.push(counter);
    if (result.length >= MAX_COUNTERS) break;
  }
  return result;
};

const sanitizePlayer = (value: any): Player | null => {
  if (!value || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name.slice(0, MAX_NAME_LENGTH) : 'Player',
    life: clampNumber(value.life, -999, 9999, 40),
    color: typeof value.color === 'string' ? value.color : undefined,
    cursor: value.cursor,
    counters: sanitizeCounters(value.counters),
    commanderDamage: typeof value.commanderDamage === 'object' && value.commanderDamage !== null
      ? Object.fromEntries(
          Object.entries(value.commanderDamage).map(([k, v]) => [k, clampNumber(v, 0, 999, 0)])
        )
      : {},
    commanderTax: clampNumber(value.commanderTax, 0, 999, 0),
    deckLoaded: value.deckLoaded === true,
  };
};

const sanitizeZone = (value: any): Zone | null => {
  if (!value || typeof value.id !== 'string' || typeof value.type !== 'string' || typeof value.ownerId !== 'string') {
    return null;
  }
  const cardIds = Array.isArray(value.cardIds)
    ? value.cardIds.filter((id: any) => typeof id === 'string').slice(0, 300)
    : [];
  return { id: value.id, type: value.type as any, ownerId: value.ownerId, cardIds };
};

const sanitizeCard = (value: any, zones: Record<string, Zone>): Card | null => {
  if (!value || typeof value.id !== 'string' || typeof value.ownerId !== 'string' || typeof value.controllerId !== 'string') {
    return null;
  }
  const zoneId = typeof value.zoneId === 'string' && zones[value.zoneId] ? value.zoneId : null;
  if (!zoneId) return null;

  const position = normalizePosition(value.position);
  const faceIndex = typeof value.currentFaceIndex === 'number'
    ? Math.max(0, Math.min(value.currentFaceIndex, 4))
    : undefined;
  const rotation = clampNumber(value.rotation, 0, 360, 0);
  const counters = sanitizeCounters(value.counters);

  return {
    id: value.id,
    ownerId: value.ownerId,
    controllerId: value.controllerId,
    zoneId,
    tapped: Boolean(value.tapped),
    faceDown: Boolean(value.faceDown),
    currentFaceIndex: faceIndex,
    position,
    rotation,
    counters,
    name: typeof value.name === 'string' ? value.name.slice(0, MAX_NAME_LENGTH) : 'Card',
    imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : undefined,
    oracleText: typeof value.oracleText === 'string' ? value.oracleText : undefined,
    typeLine: typeof value.typeLine === 'string' ? value.typeLine : undefined,
    scryfallId: typeof value.scryfallId === 'string' ? value.scryfallId : undefined,
    scryfall: value.scryfall,
    isToken: value.isToken === true,
    power: typeof value.power === 'string' ? value.power : value.power?.toString(),
    toughness: typeof value.toughness === 'string' ? value.toughness : value.toughness?.toString(),
    basePower: typeof value.basePower === 'string' ? value.basePower : value.basePower?.toString(),
    baseToughness: typeof value.baseToughness === 'string' ? value.baseToughness : value.baseToughness?.toString(),
    customText: typeof value.customText === 'string' ? value.customText.slice(0, 280) : undefined,
  };
};

const sanitizePlayerOrder = (value: any, players: Record<string, Player>, max: number): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();
  const source = Array.isArray(value) ? value : [];
  for (const id of source) {
    if (typeof id !== 'string') continue;
    if (!players[id]) continue;
    if (seen.has(id)) continue;
    result.push(id);
    seen.add(id);
    if (result.length >= max) return result;
  }
  const remaining = Object.keys(players).sort();
  for (const id of remaining) {
    if (seen.has(id)) continue;
    result.push(id);
    if (result.length >= max) break;
  }
  return result;
};

/**
 * Build the WebRTC signaling URL from the WebSocket server URL.
 * Converts /signal to /webrtc endpoint.
 */
function buildWebRTCSignalingUrl(wsUrl: string): string {
  return wsUrl.replace('/signal', '/webrtc');
}

export function useWebRTCSync(sessionId: string) {
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const [peers, setPeers] = useState(1);
  const cleanupRef = useRef<(() => void) | null>(null);
  const fullSyncTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof window === 'undefined') return;

    // Acquire session from module-level manager
    const handles = acquireSession(sessionId);
    setActiveSession(sessionId);

    const { doc, players, playerOrder, zones, cards, zoneCardOrders, globalCounters, battlefieldViewScale, logs } = handles;

    // Setup store
    const store = useGameStore.getState();
    const ensuredPlayerId = store.ensurePlayerIdForSession(sessionId);
    const sessionVersion = store.ensureSessionVersion(sessionId);
    const needsReset = store.sessionId !== sessionId || store.myPlayerId !== ensuredPlayerId;
    if (needsReset) {
      store.resetSession(sessionId, ensuredPlayerId);
    } else {
      useGameStore.setState((state) => ({ ...state, sessionId }));
    }

    // Build URLs
    const signalingUrl = (() => {
      const envUrl = (import.meta as any).env?.VITE_WEBSOCKET_SERVER as string | undefined;
      if (!envUrl) {
        console.error('[signal] VITE_WEBSOCKET_SERVER is required');
        return null;
      }
      const normalized = envUrl.replace(/^http/, 'ws').replace(/\/$/, '');
      return normalized.endsWith('/signal') ? normalized : `${normalized}/signal`;
    })();
    if (!signalingUrl) return;

    const webrtcSignalingUrl = buildWebRTCSignalingUrl(signalingUrl);

    // Bind log store
    bindSharedLogStore(logs);

    // Create awareness
    const awareness = new Awareness(doc);
    const clientKey = getClientKey();

    // WebRTC provider for P2P - use your own signaling server
    let webrtcProvider: WebrtcProvider | null = null;
    try {
      webrtcProvider = new WebrtcProvider(sessionId, doc, {
        signaling: [webrtcSignalingUrl],
        password: undefined,
        awareness,
        maxConns: 20,
        filterBcConns: true,
        peerOpts: {},
      });
    } catch (err) {
      console.warn('[webrtc] Failed to create WebRTC provider:', err);
    }

    // WebSocket provider as fallback relay
    const wsProvider = new WebsocketProvider(signalingUrl, sessionId, doc, {
      awareness: webrtcProvider ? undefined : awareness, // Only use awareness if no WebRTC
      connect: true,
      params: {
        userId: ensuredPlayerId,
        clientKey,
        sessionVersion: String(sessionVersion),
        clientVersion: CLIENT_VERSION,
      },
    });

    setSessionProvider(sessionId, wsProvider);
    setSessionAwareness(sessionId, awareness);

    // Full state sync
    const fullSyncToStore = () => {
      if (fullSyncTimer.current !== null) {
        clearTimeout(fullSyncTimer.current);
        fullSyncTimer.current = null;
      }
      applyingRemoteUpdate = true;
      try {
        const snapshot = sharedSnapshot({ players, playerOrder, zones, cards, zoneCardOrders, globalCounters, battlefieldViewScale } as any);

        const safePlayers: Record<string, Player> = {};
        let playerCount = 0;
        Object.entries(snapshot.players).forEach(([key, value]) => {
          if (playerCount >= MAX_PLAYERS) return;
          const p = sanitizePlayer(value);
          if (p) {
            safePlayers[key] = p;
            playerCount++;
          }
        });

        const safeZones: Record<string, Zone> = {};
        let zoneCount = 0;
        Object.entries(snapshot.zones).forEach(([key, value]) => {
          if (zoneCount >= MAX_ZONES) return;
          const z = sanitizeZone(value);
          if (z) {
            safeZones[key] = z;
            zoneCount++;
          }
        });

        const safeCards: Record<string, Card> = {};
        let cardCount = 0;
        Object.entries(snapshot.cards).forEach(([key, value]) => {
          if (cardCount >= MAX_CARDS) return;
          const c = sanitizeCard(value, safeZones);
          if (c) {
            safeCards[key] = c;
            cardCount++;
          }
        });

        Object.values(safeZones).forEach((zone) => {
          zone.cardIds = zone.cardIds.filter((id) => safeCards[id]);
        });

        const safeGlobalCounters: Record<string, string> = {};
        Object.entries(snapshot.globalCounters).forEach(([key, value]) => {
          if (typeof key === 'string' && typeof value === 'string') {
            safeGlobalCounters[key.slice(0, 64)] = value.slice(0, 16);
          }
        });

        const safeBattlefieldViewScale: Record<string, number> = {};
        Object.entries(snapshot.battlefieldViewScale ?? {}).forEach(([pid, value]) => {
          if (!safePlayers[pid]) return;
          safeBattlefieldViewScale[pid] = clampNumber(value, 0.5, 1, 1);
        });

        const safePlayerOrder = sanitizePlayerOrder(snapshot.playerOrder, safePlayers, MAX_PLAYERS);

        useGameStore.setState({
          players: safePlayers,
          zones: safeZones,
          cards: safeCards,
          globalCounters: safeGlobalCounters,
          playerOrder: safePlayerOrder,
          battlefieldViewScale: safeBattlefieldViewScale,
        });
      } finally {
        applyingRemoteUpdate = false;
      }
    };

    const SYNC_DEBOUNCE_MS = 16; // Lower debounce for P2P
    const scheduleFullSync = () => {
      if (fullSyncTimer.current !== null) {
        clearTimeout(fullSyncTimer.current);
      }
      fullSyncTimer.current = setTimeout(() => {
        fullSyncTimer.current = null;
        fullSyncToStore();
      }, SYNC_DEBOUNCE_MS) as unknown as number;
    };

    // Sync local store to Yjs
    const syncStoreToShared = () => {
      const state = useGameStore.getState();
      const sharedMaps = { players, playerOrder, zones, cards, zoneCardOrders, globalCounters, battlefieldViewScale } as any;
      doc.transact(() => {
        players.forEach((_value, key) => {
          if (!state.players[key as string]) players.delete(key);
        });
        Object.entries(state.players).forEach(([_key, value]) => upsertPlayer(sharedMaps, value));

        zones.forEach((_value, key) => {
          if (!state.zones[key as string]) {
            zones.delete(key);
            zoneCardOrders.delete(key as string);
          }
        });
        Object.entries(state.zones).forEach(([_key, value]) => upsertZone(sharedMaps, value));
        Object.entries(state.zones).forEach(([key, value]) => {
          reorderZoneCards(sharedMaps, key, value.cardIds);
        });

        cards.forEach((_value, key) => {
          if (!state.cards[key as string]) removeCard(sharedMaps, key as string);
        });
        Object.entries(state.cards).forEach(([_key, value]) => upsertCard(sharedMaps, value));

        globalCounters.forEach((_value, key) => {
          if (!state.globalCounters[key as string]) globalCounters.delete(key);
        });
        Object.entries(state.globalCounters).forEach(([key, value]) => globalCounters.set(key, value));

        battlefieldViewScale.forEach((_value, key) => {
          if (!state.battlefieldViewScale[key as string]) battlefieldViewScale.delete(key);
        });
        Object.entries(state.battlefieldViewScale).forEach(([key, value]) => {
          battlefieldViewScale.set(key, clampNumber(value, 0.5, 1, 1));
        });

        const allowedPlayers = new Set(Object.keys(state.players));
        const desiredOrder = (state.playerOrder ?? []).filter((id) => allowedPlayers.has(id)).slice(0, MAX_PLAYERS);
        Array.from(allowedPlayers).sort().forEach((id) => {
          if (desiredOrder.length >= MAX_PLAYERS) return;
          if (!desiredOrder.includes(id)) desiredOrder.push(id);
        });
        playerOrder.delete(0, playerOrder.length);
        if (desiredOrder.length) {
          playerOrder.insert(0, desiredOrder);
        }
      });
    };

    const handleDocUpdate = () => {
      if (applyingRemoteUpdate) return;
      scheduleFullSync();
    };

    doc.on('update', handleDocUpdate);

    // Awareness
    const pushLocalAwareness = () => {
      awareness.setLocalStateField('client', { id: ensuredPlayerId });
    };
    pushLocalAwareness();

    // Track peer count from multiple sources
    let webrtcPeerCount = 0;
    
    const updatePeerCount = () => {
      // Use the max of awareness states and WebRTC peers (plus 1 for self)
      const awarenessCount = awareness.getStates().size || 1;
      const rtcCount = webrtcPeerCount + 1; // +1 for self
      setPeers(Math.max(awarenessCount, rtcCount));
    };

    const handleAwareness = () => {
      updatePeerCount();
    };
    awareness.on('change', handleAwareness);
    updatePeerCount();

    // WebRTC events
    if (webrtcProvider) {
      webrtcProvider.on('synced', ({ synced }: { synced: boolean }) => {
        if (synced) {
          setStatus('p2p');
          flushPendingMutations();
          setTimeout(() => fullSyncToStore(), 50);
        }
      });

      webrtcProvider.on('peers', ({ webrtcPeers }: { webrtcPeers: any[] }) => {
        webrtcPeerCount = webrtcPeers.length;
        updatePeerCount();
        if (webrtcPeers.length > 0) {
          setStatus('p2p');
        }
      });
    }

    // WebSocket events (fallback)
    wsProvider.on('status', ({ status: s }: any) => {
      if (s === 'connected' && status === 'connecting') {
        setStatus('connected');
        flushPendingMutations();

        const localCards = Object.keys(useGameStore.getState().cards).length;
        if (cards.size === 0 && localCards > 0) {
          syncStoreToShared();
        }
        pushLocalAwareness();
      }
      if (s === 'disconnected' && status !== 'p2p') {
        setStatus('connecting');
      }
    });

    wsProvider.on('sync', (isSynced: boolean) => {
      if (!isSynced) return;
      flushPendingMutations();

      const localCards = Object.keys(useGameStore.getState().cards).length;
      if (cards.size === 0 && localCards > 0) {
        syncStoreToShared();
      }
      setTimeout(() => fullSyncToStore(), 50);
    });

    flushPendingMutations();

    // Cleanup
    const cleanup = () => {
      awareness.setLocalState(null);
      try {
        removeAwarenessStates(awareness, [awareness.clientID], 'disconnect');
      } catch {}

      awareness.off('change', handleAwareness);
      doc.off('update', handleDocUpdate);
      if (fullSyncTimer.current !== null) {
        clearTimeout(fullSyncTimer.current);
        fullSyncTimer.current = null;
      }

      bindSharedLogStore(null);
      setActiveSession(null);

      setTimeout(() => {
        if (webrtcProvider) {
          try { webrtcProvider.destroy(); } catch {}
        }
        wsProvider.disconnect();
        wsProvider.destroy();
        releaseSession(sessionId);
      }, 50);
    };

    cleanupRef.current = cleanup;

    return cleanup;
  }, [sessionId]);

  return { status, peers };
}
