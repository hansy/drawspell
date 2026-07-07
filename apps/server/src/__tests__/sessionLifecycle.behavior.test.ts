import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  EMPTY_ROOM_STARTED_AT_KEY,
  HIDDEN_STATE_META_KEY,
  ROOM_TOKENS_KEY,
} from "../domain/constants";

const superOnConnect = vi.fn();

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: any;
    storage: any;
    constructor(ctx: any, _env: any) {
      this.ctx = ctx;
      this.storage = ctx.storage;
    }
  },
  DurableObjectNamespace: class {},
}));

vi.mock("partyserver", () => ({
  routePartykitRequest: vi.fn(async () => null),
}));

vi.mock("y-partyserver", () => ({
  YServer: class {
    ctx: any;
    env: any;
    name: string;
    document: Y.Doc;
    constructor(ctx: any, env: any) {
      this.ctx = ctx;
      this.env = env;
      this.name = ctx?.id?.name ?? "room-test";
      this.document = new Y.Doc();
    }
    onConnect(...args: any[]) {
      return superOnConnect(...args);
    }
    onClose() {}
  },
}));

vi.mock("../domain/intents/applyIntentToDoc", () => ({
  applyIntentToDoc: vi.fn(() => ({
    ok: true,
    hiddenChanged: true,
    logEvents: [],
  })),
}));

import { Room, createEmptyHiddenState } from "../server";

beforeEach(() => {
  superOnConnect.mockClear();
});

const EMPTY_ROOM_IDLE_GRACE_MS = 120_000;
const EMPTY_ROOM_HARD_RESET_MS = 30 * 60_000;
const EMPTY_ROOM_TOTAL_RESET_MS =
  EMPTY_ROOM_IDLE_GRACE_MS + EMPTY_ROOM_HARD_RESET_MS;
const ROOM_TEARDOWN_CLOSE_CODE = 1013;
const INTENT_LOG_META_KEY = "intent-log:meta";
const INTENT_LOG_PREFIX = "intent-log:";

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createState = () => {
  const store = new Map<string, unknown>();
  let alarm: number | null = null;
  const storage = {
    get: vi.fn(async (key: string) => store.get(key)),
    put: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => store.entries()),
    setAlarm: vi.fn(async (scheduledTimeMs: number) => {
      alarm = scheduledTimeMs;
    }),
    getAlarm: vi.fn(async () => alarm),
    deleteAlarm: vi.fn(async () => {
      alarm = null;
    }),
  };
  return {
    id: { name: "room-test" },
    storage,
  } as any;
};

const createEnv = (): Env => ({
  rooms: {} as any,
  JOIN_TOKEN_SECRET: "test-secret",
  NODE_ENV: "development",
  DISCORD_SERVICE_AUTH_SECRET: "discord-secret",
});

const createHiddenLibraryCard = () => ({
  id: "c1",
  name: "Card c1",
  ownerId: "p1",
  controllerId: "p1",
  zoneId: "library-p1",
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
});

class TestConnection {
  id = "conn-1";
  uri = "wss://example.test";
  state: unknown;
  closed: Array<{ code?: number; reason?: string }> = [];
  sent: string[] = [];
  private listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(event: string, handler: (event: any) => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0;
  }

  close(code?: number, reason?: string) {
    this.closed.push({ code, reason });
    const handlers = this.listeners.get("close");
    if (!handlers) return;
    handlers.forEach((handler) => handler({ code, reason }));
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  setState(nextState: unknown) {
    this.state = nextState;
  }
}

describe("server lifecycle guards", () => {
  it("opts into hibernatable websocket handling", () => {
    expect((Room as any).options).toMatchObject({ hibernate: true });
  });

  it("logs perf metrics opportunistically without starting a recurring timer", () => {
    vi.useFakeTimers();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      vi.setSystemTime(1_000);
      const state = createState();
      const server = new Room(state, createEnv());
      (server as any).perfMetricsEnabledFlag = true;

      (server as any).capturePerfMetricsFlag(new URL("wss://example.test"));

      expect((server as any).perfMetricsTimer ?? null).toBeNull();
      expect(infoSpy).toHaveBeenCalledTimes(1);

      vi.setSystemTime(10_000);
      (server as any).maybeLogPerfMetrics("test-activity");
      expect(infoSpy).toHaveBeenCalledTimes(1);

      vi.setSystemTime(31_001);
      (server as any).maybeLogPerfMetrics("test-activity");
      expect(infoSpy).toHaveBeenCalledTimes(2);
    } finally {
      infoSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("counts hibernated sockets in perf metrics after in-memory state is reset", () => {
    vi.useFakeTimers();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      vi.setSystemTime(1_000);
      const state = createState();
      const server = new Room(state, createEnv());
      (server as any).perfMetricsEnabledFlag = true;
      const player = new TestConnection();
      player.id = "hibernated-player";
      player.state = {
        channel: "sync",
        playerId: "p1",
        viewerRole: "player",
      };
      const intent = new TestConnection();
      intent.id = "hibernated-intent";
      intent.state = {
        channel: "intent",
        playerId: "p1",
        viewerRole: "player",
        libraryView: {
          playerId: "p1",
          count: 3,
          lastPingAt: 1_000,
        },
      };
      const spectator = new TestConnection();
      spectator.id = "hibernated-spectator";
      spectator.state = {
        channel: "intent",
        viewerRole: "spectator",
      };
      (server as any).getConnections = () => [player, intent, spectator];

      (server as any).maybeLogPerfMetrics("wake");

      const metrics = infoSpy.mock.calls.find(
        ([message]) => message === "[party] perf metrics",
      )?.[1] as Record<string, unknown> | undefined;
      expect(metrics).toMatchObject({
        connections: 3,
        intentConnections: 2,
        libraryViews: 1,
      });
    } finally {
      infoSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("broadcasts peer counts from hibernated connection state without double-counting sync and intent sockets", () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const sync = new TestConnection();
    sync.id = "player-sync";
    sync.state = {
      channel: "sync",
      playerId: "p1",
      viewerRole: "player",
      connectionGroupId: "device-1",
    };
    const intent = new TestConnection();
    intent.id = "player-intent";
    intent.state = {
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
      connectionGroupId: "device-1",
    };
    const spectator = new TestConnection();
    spectator.id = "spectator-intent";
    spectator.state = {
      channel: "intent",
      playerId: "spectator-1",
      viewerRole: "spectator",
      connectionGroupId: "device-2",
    };
    (server as any).getConnections = () => [sync, intent, spectator];

    (server as any).broadcastPeerCounts();

    expect(sync.sent).toEqual([]);
    expect(intent.sent.map((payload) => JSON.parse(payload))).toContainEqual({
      type: "peerCounts",
      payload: { total: 2, players: 1, spectators: 1 },
    });
    expect(spectator.sent.map((payload) => JSON.parse(payload))).toContainEqual({
      type: "peerCounts",
      payload: { total: 2, players: 1, spectators: 1 },
    });
  });

  it("handles hibernated intent messages through the server message hook", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const conn = new TestConnection();
    conn.state = {
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
    };

    await (server as any).onMessage(
      conn,
      JSON.stringify({
        type: "intent",
        intent: {
          id: "intent-1",
          type: "card.add",
          payload: { actorId: "p1" },
        },
      }),
    );

    expect(conn.sent.map((payload) => JSON.parse(payload))).toContainEqual({
      type: "ack",
      intentId: "intent-1",
      ok: true,
    });
  });

  it("cleans up hibernated intent connections through the server close hook", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = createState();
    const server = new Room(state, createEnv());
    const conn = new TestConnection();
    try {
      conn.state = {
        channel: "intent",
        playerId: "p1",
        viewerRole: "player",
        connectionGroupId: "device-1",
      };
      (server as any).intentConnections.add(conn);
      (server as any).connectionRoles.set(conn, "player");
      (server as any).connectionPlayers.set(conn, "p1");
      (server as any).connectionGroups.set(conn, "device-1");
      (server as any).libraryViews.set(conn.id, {
        playerId: "p1",
        lastPingAt: Date.now(),
      });

      await (server as any).onClose(conn, 1000, "client closed", true);

      expect((server as any).intentConnections.has(conn)).toBe(false);
      expect((server as any).connectionRoles.has(conn)).toBe(false);
      expect((server as any).connectionPlayers.has(conn)).toBe(false);
      expect((server as any).connectionGroups.has(conn)).toBe(false);
      expect((server as any).libraryViews.has(conn.id)).toBe(false);
      expect(await state.storage.get(EMPTY_ROOM_STARTED_AT_KEY)).not.toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalledWith(
        "[party] intent connection closed",
        expect.anything(),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("broadcasts intent side effects to hibernated intent peers", async () => {
    const { applyIntentToDoc } = await import("../domain/intents/applyIntentToDoc");
    const applyMock = vi.mocked(applyIntentToDoc);
    applyMock.mockReturnValueOnce({
      ok: true,
      hiddenChanged: false,
      impact: {
        changedOwners: [],
        changedZones: [],
        changedRevealScopes: { toAll: false, toPlayers: [] },
        changedPublicDoc: false,
      },
      logEvents: [
        { eventId: "player.endTurn", payload: { actorId: "p1" } },
      ],
    });

    const state = createState();
    const server = new Room(state, createEnv());
    (server as any).hiddenState = createEmptyHiddenState();
    const sender = new TestConnection();
    sender.id = "sender";
    sender.state = {
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
    };
    const peer = new TestConnection();
    peer.id = "peer";
    peer.state = {
      channel: "intent",
      playerId: "p2",
      viewerRole: "player",
    };
    (server as any).getConnections = () => [sender, peer];

    await (server as any).onMessage(
      sender,
      JSON.stringify({
        type: "intent",
        intent: {
          id: "intent-1",
          type: "player.endTurn",
          payload: { actorId: "p1" },
        },
      }),
    );

    expect(peer.sent.map((payload) => JSON.parse(payload))).toContainEqual(
      expect.objectContaining({
        type: "gameLogEvent",
        eventId: "player.endTurn",
      }),
    );
  });

  it("skips hidden-state persistence when a reset happens mid-intent", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      (server as any).hiddenState = createEmptyHiddenState();

      const broadcastGate = createDeferred<void>();
      vi.spyOn(server as any, "broadcastOverlays").mockReturnValue(
        broadcastGate.promise
      );

      const conn = new TestConnection();
      conn.state = { playerId: "p1", viewerRole: "player" };

      const intent = {
        id: "intent-1",
        type: "card.add",
        payload: { actorId: "p1" },
      };
      const intentPromise = (server as any).handleIntent(conn, intent);

      await Promise.resolve();
      (server as any).resetGeneration += 1;
      broadcastGate.resolve();

      await intentPromise;
      await vi.runAllTimersAsync();

      const putKeys = state.storage.put.mock.calls.map(
        (call: [string, unknown]) => call[0]
      );
      const snapshotWrites = putKeys.filter(
        (key: string) =>
          key === "snapshot:meta" ||
          key === "yjs:doc" ||
          (typeof key === "string" && key.startsWith("snapshot:hidden:"))
      );
      expect(snapshotWrites).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips snapshot meta write if reset happens mid-persist", async () => {
    const store = new Map<string, unknown>();
    const snapshotGate = createDeferred<void>();
    const storage = {
      get: vi.fn(async (key: string) => {
        return store.get(key);
      }),
      put: vi.fn(async (key: string, value: unknown) => {
        if (key === "snapshot:meta") {
          await snapshotGate.promise;
        }
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      list: vi.fn(async () => store.entries()),
    };
    const state = {
      id: { name: "room-test" },
      storage,
    } as any;
    const server = new Room(state, createEnv());
    (server as any).hiddenState = createEmptyHiddenState();

    const expectedResetGeneration = (server as any).resetGeneration;
    const persistPromise = (server as any).persistHiddenState(
      expectedResetGeneration
    );

    for (let i = 0; i < 3 && storage.put.mock.calls.length === 0; i += 1) {
      await Promise.resolve();
    }
    expect(storage.put).toHaveBeenCalled();

    (server as any).resetGeneration += 1;
    snapshotGate.resolve();

    await persistPromise;

    expect(store.has("snapshot:meta")).toBe(false);
  });

  it("records rapid hidden-state intents without scheduling hidden-state timers", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      (server as any).hiddenState = createEmptyHiddenState();
      vi
        .spyOn(server as any, "broadcastOverlays")
        .mockResolvedValue(undefined);
      const persistSpy = vi
        .spyOn(server as any, "persistHiddenState")
        .mockResolvedValue(undefined);

      const conn = new TestConnection();
      conn.state = { playerId: "p1", viewerRole: "player" };

      const intent = {
        id: "intent-1",
        type: "card.add",
        payload: { actorId: "p1" },
      };
      const intentTwo = {
        id: "intent-2",
        type: "card.add",
        payload: { actorId: "p1" },
      };

      await Promise.all([
        (server as any).handleIntent(conn, intent),
        (server as any).handleIntent(conn, intentTwo),
      ]);

      expect(persistSpy).not.toHaveBeenCalled();
      expect((server as any).hiddenStatePersistTimer ?? null).toBeNull();
      expect((server as any).hiddenStateIdleTimer ?? null).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("broadcasts sequenced Game Log Events and replays retained snapshots", async () => {
    const { applyIntentToDoc } = await import("../domain/intents/applyIntentToDoc");
    const applyMock = vi.mocked(applyIntentToDoc);
    applyMock.mockReturnValueOnce({
      ok: true,
      hiddenChanged: false,
      impact: { changedOwners: [], changedZones: [], changedRevealScopes: { toAll: false, toPlayers: [] }, changedPublicDoc: false },
      logEvents: [
        { eventId: "player.endTurn", payload: { actorId: "p1" } },
      ],
    });

    const state = createState();
    const server = new Room(state, createEnv());
    (server as any).hiddenState = createEmptyHiddenState();

    const conn = new TestConnection();
    conn.state = { playerId: "p1", viewerRole: "player" };
    const sent: string[] = [];
    conn.send = (payload: string) => {
      sent.push(payload);
    };
    (server as any).intentConnections.add(conn);

    await (server as any).handleIntent(conn, {
      id: "intent-1",
      type: "player.endTurn",
      payload: { actorId: "p1" },
    });

    const gameLogEvent = sent.map((payload) => JSON.parse(payload)).find(
      (message) => message.type === "gameLogEvent"
    );
    expect(gameLogEvent).toMatchObject({
      type: "gameLogEvent",
      seq: 1,
      eventId: "player.endTurn",
      payload: { actorId: "p1" },
    });

    const replayConn = new TestConnection();
    const replayed: string[] = [];
    replayConn.send = (payload: string) => {
      replayed.push(payload);
    };
    await (server as any).handleGameLogRequest(replayConn, {
      type: "gameLogRequest",
    });

    expect(JSON.parse(replayed[0])).toMatchObject({
      type: "gameLogSnapshot",
      events: [
        {
          seq: 1,
          eventId: "player.endTurn",
          payload: { actorId: "p1" },
        },
      ],
    });
  });

  it("lazily restores the retained Game Log for hibernated replay requests", async () => {
    const state = createState();
    await state.storage.put("game-log:v1", {
      nextSeq: 3,
      entries: [
        {
          seq: 1,
          ts: 100,
          eventId: "player.endTurn",
          payload: { actorId: "p1" },
        },
        {
          seq: 2,
          ts: 200,
          eventId: "coin.flip",
          payload: { actorId: "p2", result: "tails" },
        },
      ],
    });
    state.storage.get.mockClear();
    const server = new Room(state, createEnv());

    await server.onLoad();

    expect(state.storage.get).not.toHaveBeenCalledWith("game-log:v1");

    const replayConn = new TestConnection();
    await (server as any).handleGameLogRequest(replayConn, {
      type: "gameLogRequest",
      lastLogSeq: 1,
    });

    expect(JSON.parse(replayConn.sent[0])).toMatchObject({
      type: "gameLogReplay",
      events: [
        {
          seq: 2,
          eventId: "coin.flip",
          payload: { actorId: "p2", result: "tails" },
        },
      ],
    });
  });

  it("persists the retained Game Log without scheduling a debounce timer", async () => {
    const { applyIntentToDoc } = await import("../domain/intents/applyIntentToDoc");
    const applyMock = vi.mocked(applyIntentToDoc);
    applyMock.mockReturnValueOnce({
      ok: true,
      hiddenChanged: false,
      impact: { changedOwners: [], changedZones: [], changedRevealScopes: { toAll: false, toPlayers: [] }, changedPublicDoc: false },
      logEvents: [
        { eventId: "coin.flip", payload: { actorId: "p1", result: "heads" } },
      ],
    });

    const state = createState();
    const server = new Room(state, createEnv());
    (server as any).hiddenState = createEmptyHiddenState();

    const conn = new TestConnection();
    conn.state = { playerId: "p1", viewerRole: "player" };
    (server as any).intentConnections.add(conn);

    await (server as any).handleIntent(conn, {
      id: "intent-1",
      type: "coin.flip",
      payload: { actorId: "p1" },
    });

    for (let i = 0; i < 3; i += 1) {
      await Promise.resolve();
    }

    expect((server as any).gameLogPersistTimer ?? null).toBeNull();
    expect(state.storage.put).toHaveBeenCalledWith(
      "game-log:v1",
      expect.objectContaining({
        nextSeq: 2,
        entries: [
          expect.objectContaining({
            seq: 1,
            eventId: "coin.flip",
            payload: { actorId: "p1", result: "heads" },
          }),
        ],
      }),
    );
  });

  it("drains in-flight Game Log persistence before clearing room storage", async () => {
    const store = new Map<string, unknown>();
    const gameLogPutGate = createDeferred<void>();
    const storage = {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        if (key === "game-log:v1") {
          await gameLogPutGate.promise;
        }
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      list: vi.fn(async () => store.entries()),
    };
    const state = {
      id: { name: "room-test" },
      storage,
    } as any;
    const server = new Room(state, createEnv());
    (server as any).gameLog.append([
      { eventId: "player.endTurn", payload: { actorId: "p1" } },
    ], 100);
    (server as any).gameLogPersistQueued = true;

    const persistPromise = (server as any).flushGameLogPersist();
    for (let i = 0; i < 3 && storage.put.mock.calls.length === 0; i += 1) {
      await Promise.resolve();
    }
    expect(storage.put).toHaveBeenCalledWith(
      "game-log:v1",
      expect.anything(),
    );

    const teardownPromise = (server as any).teardownRoomIfEmpty(
      (server as any).teardownGeneration,
    );
    await Promise.resolve();
    expect(storage.delete).not.toHaveBeenCalled();

    gameLogPutGate.resolve();
    await persistPromise;
    await teardownPromise;

    expect(store.has("game-log:v1")).toBe(false);
  });

  it("flushes due hidden-state snapshots without scheduling a timer", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(60_000);
      const state = createState();
      const server = new Room(state, createEnv());
      (server as any).hiddenState = createEmptyHiddenState();
      const persistSpy = vi
        .spyOn(server as any, "persistHiddenState")
        .mockResolvedValue(undefined);
      (server as any).intentLogMeta = {
        nextIndex: 201,
        logStartIndex: 1,
        snapshotIndex: 0,
        lastSnapshotAt: 0,
      };

      (server as any).scheduleHiddenStatePersist(
        (server as any).resetGeneration,
        "conn-1",
      );
      await Promise.resolve();

      expect(persistSpy).toHaveBeenCalledTimes(1);
      expect((server as any).hiddenStatePersistTimer ?? null).toBeNull();
      expect((server as any).hiddenStateIdleTimer ?? null).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to snapshot when diff payload is too large", () => {
    const state = createState();
    const server = new Room(state, createEnv());

    const conn = new TestConnection();
    conn.state = { playerId: "p1", viewerRole: "player" };
    const sent: string[] = [];
    conn.send = (payload: string) => {
      sent.push(payload);
    };

    const overlayService = (server as any).overlayService;
    overlayService.overlayStates.set(conn.id, {
      overlayVersion: 1,
      cardHashes: new Map([["c1", "old"]]),
      zoneOrderHashes: new Map(),
      meta: { cardCount: 1, cardsWithArt: 0, viewerHandCount: 0 },
    });

    const bigName = "x".repeat(70_000);
    const card = {
      id: "c1",
      name: bigName,
      ownerId: "p1",
      controllerId: "p1",
      zoneId: "hand",
      tapped: false,
      faceDown: false,
      position: { x: 0.5, y: 0.5 },
      rotation: 0,
      counters: [],
    };

    const buildResult = {
      overlay: { cards: [card] },
      cardHashes: new Map([["c1", "new"]]),
      zoneOrderHashes: new Map(),
      meta: { cardCount: 1, cardsWithArt: 0, viewerHandCount: 0 },
    };

    overlayService.sendOverlayForConnection({
      conn,
      buildResult,
      viewerId: "p1",
      supportsDiff: true,
    });

    expect(sent).toHaveLength(1);
    const message = JSON.parse(sent[0]);
    expect(message.type).toBe("privateOverlay");
    expect(overlayService.getMetrics().resyncCount).toBe(1);
  });

  it("preserves negotiated overlay diff capability across hibernation", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    (server as any).hiddenState = createEmptyHiddenState();
    const conn = new TestConnection();
    conn.state = {
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
    };

    await (server as any).onMessage(
      conn,
      JSON.stringify({
        type: "hello",
        payload: { capabilities: ["overlay-diff-v1"] },
      }),
    );
    expect(JSON.parse(conn.sent.at(-1) ?? "{}")).toEqual({
      type: "helloAck",
      payload: { acceptedCapabilities: ["overlay-diff-v1"] },
    });
    expect((conn.state as any).capabilities).toEqual(["overlay-diff-v1"]);

    (server as any).connectionCapabilities.clear();
    conn.sent = [];
    const overlayService = (server as any).overlayService;
    const sendSpy = vi.spyOn(overlayService, "sendOverlayForConnection");

    await (server as any).sendOverlayForConnection(conn);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ supportsDiff: true }),
    );
  });

  it("keeps library views open until the viewer closes them", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      const conn = new TestConnection();
      conn.state = { playerId: "p1", viewerRole: "player" };
      (server as any).intentConnections.add(conn);

      const overlaySpy = vi
        .spyOn(server as any, "sendOverlayForConnection")
        .mockResolvedValue(undefined);

      vi.setSystemTime(0);
      await (server as any).handleLibraryViewIntent(conn, {
        type: "library.view",
        payload: { playerId: "p1", count: 3 },
      });

      expect((server as any).libraryViews.size).toBe(1);

      vi.advanceTimersByTime(180_000);
      (server as any).cleanupExpiredLibraryViews();
      expect((server as any).libraryViews.size).toBe(1);

      await (server as any).handleLibraryViewCloseIntent(conn, {
        type: "library.view.close",
        payload: { playerId: "p1" },
      });
      expect((server as any).libraryViews.size).toBe(0);
      expect(overlaySpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks library views without starting a server cleanup interval", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      const conn = new TestConnection();
      conn.state = { playerId: "p1", viewerRole: "player" };
      (server as any).intentConnections.add(conn);

      vi.setSystemTime(0);
      await (server as any).handleLibraryViewIntent(conn, {
        type: "library.view",
        payload: { playerId: "p1", count: 3 },
      });

      expect((server as any).libraryViews.size).toBe(1);
      expect((server as any).libraryViewCleanupTimer ?? null).toBeNull();

      (server as any).handleLibraryViewPingIntent(conn, {
        type: "library.view.ping",
        payload: { playerId: "p1" },
      });

      expect((server as any).libraryViewCleanupTimer ?? null).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles legacy library view pings without applying an intent", async () => {
    const { applyIntentToDoc } = await import("../domain/intents/applyIntentToDoc");
    const applyMock = vi.mocked(applyIntentToDoc);
    applyMock.mockClear();

    const state = createState();
    const server = new Room(state, createEnv());
    const conn = new TestConnection();
    conn.state = {
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
      libraryView: {
        playerId: "p1",
        count: 3,
        lastPingAt: 0,
      },
    };

    await (server as any).onMessage(
      conn,
      JSON.stringify({
        type: "intent",
        intent: {
          id: "legacy-ping",
          type: "library.view.ping",
          payload: { actorId: "p1", playerId: "p1" },
        },
      }),
    );

    expect(applyMock).not.toHaveBeenCalled();
    expect(conn.sent.map((payload) => JSON.parse(payload))).toContainEqual({
      type: "ack",
      intentId: "legacy-ping",
      ok: true,
    });
    expect((server as any).libraryViews.get(conn.id)).toMatchObject({
      playerId: "p1",
      count: 3,
    });
  });

  it("keeps active library views open without recurring pings", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      const conn = new TestConnection();
      conn.state = { playerId: "p1", viewerRole: "player" };
      (server as any).intentConnections.add(conn);

      vi.setSystemTime(0);
      await (server as any).handleLibraryViewIntent(conn, {
        type: "library.view",
        payload: { playerId: "p1", count: 3 },
      });

      vi.setSystemTime(180_000);
      (server as any).cleanupExpiredLibraryViews();

      expect((server as any).libraryViews.get(conn.id)).toMatchObject({
        playerId: "p1",
        count: 3,
      });
      expect((conn.state as any).libraryView).toMatchObject({
        playerId: "p1",
        count: 3,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps other active library views when one viewer pings", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      const staleConn = new TestConnection();
      staleConn.id = "stale";
      staleConn.state = { playerId: "p1", viewerRole: "player" };
      const activeConn = new TestConnection();
      activeConn.id = "active";
      activeConn.state = { playerId: "p2", viewerRole: "player" };
      (server as any).intentConnections.add(staleConn);
      (server as any).intentConnections.add(activeConn);

      vi.setSystemTime(0);
      await (server as any).handleLibraryViewIntent(staleConn, {
        type: "library.view",
        payload: { playerId: "p1", count: 3 },
      });
      await (server as any).handleLibraryViewIntent(activeConn, {
        type: "library.view",
        payload: { playerId: "p2", count: 3 },
      });

      vi.setSystemTime(180_000);
      (server as any).handleLibraryViewPingIntent(activeConn, {
        type: "library.view.ping",
        payload: { playerId: "p2" },
      });

      expect((server as any).libraryViews.has(staleConn.id)).toBe(true);
      expect((server as any).libraryViews.has(activeConn.id)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores hibernated library views without a keepalive ping", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      const conn = new TestConnection();
      conn.id = "hibernated-viewer";
      conn.state = {
        channel: "intent",
        playerId: "p1",
        viewerRole: "player",
        libraryView: {
          playerId: "p1",
          count: 3,
          lastPingAt: 0,
        },
      };
      (server as any).getConnections = () => [conn];
      const overlaySpy = vi
        .spyOn(server as any, "sendOverlayForConnection")
        .mockResolvedValue(undefined);

      vi.setSystemTime(180_000);
      (server as any).cleanupExpiredLibraryViews();

      expect((server as any).libraryViews.get(conn.id)).toEqual({
        playerId: "p1",
        count: 3,
        lastPingAt: 0,
      });
      expect((conn.state as any).libraryView).toMatchObject({
        playerId: "p1",
        count: 3,
        lastPingAt: 0,
      });
      expect(overlaySpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores hibernated library views from connection state on ping", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      const conn = new TestConnection();
      conn.id = "viewer";
      conn.state = {
        channel: "intent",
        playerId: "p1",
        viewerRole: "player",
      };
      (server as any).intentConnections.add(conn);

      vi.setSystemTime(0);
      await (server as any).handleLibraryViewIntent(conn, {
        type: "library.view",
        payload: { playerId: "p1", count: 3 },
      });

      expect((conn.state as any).libraryView).toMatchObject({
        playerId: "p1",
        count: 3,
        lastPingAt: 0,
      });

      (server as any).libraryViews.clear();
      vi.setSystemTime(12_000);
      (server as any).handleLibraryViewPingIntent(conn, {
        type: "library.view.ping",
        payload: { playerId: "p1" },
      });

      expect((server as any).libraryViews.get(conn.id)).toEqual({
        playerId: "p1",
        count: 3,
        lastPingAt: 12_000,
      });
      expect((conn.state as any).libraryView).toMatchObject({
        playerId: "p1",
        count: 3,
        lastPingAt: 12_000,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("replays intent log entries on load", async () => {
    const store = new Map<string, unknown>();
    const storage = {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      list: vi.fn(async () => store.entries()),
    };
    const { applyIntentToDoc } = await import("../domain/intents/applyIntentToDoc");
    const applyMock = vi.mocked(applyIntentToDoc);
    applyMock.mockClear();
    const state = {
      id: { name: "room-test" },
      storage,
    } as any;

    store.set(INTENT_LOG_META_KEY, {
      nextIndex: 1,
      logStartIndex: 0,
      snapshotIndex: -1,
      lastSnapshotAt: 0,
    });
    store.set(`${INTENT_LOG_PREFIX}0`, {
      index: 0,
      ts: 0,
      intent: {
        id: "intent-1",
        type: "player.join",
        payload: {
          actorId: "p1",
          player: {
            id: "p1",
            name: "P1",
            life: 20,
            counters: [],
            commanderDamage: {},
            commanderTax: 0,
          },
        },
      },
    });

    const server = new Room(state, createEnv());
    await (server as any).onLoad();

    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(applyMock.mock.calls[0]?.[1]?.type).toBe("player.join");
    const hidden = (server as any).hiddenState;
    expect(hidden).toBeTruthy();
  });

  it("does not preload persisted hidden state before replaying legacy intent logs", async () => {
    const store = new Map<string, unknown>();
    const storage = {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      list: vi.fn(async () => store.entries()),
    };
    const { applyIntentToDoc } = await import("../domain/intents/applyIntentToDoc");
    const applyMock = vi.mocked(applyIntentToDoc);
    applyMock.mockClear();
    const state = {
      id: { name: "room-test" },
      storage,
    } as any;

    const chunkKey = "hiddenState:v2:cards:legacy:0";
    const hiddenCard = createHiddenLibraryCard();
    store.set(HIDDEN_STATE_META_KEY, {
      handOrder: {},
      libraryOrder: { p1: ["c1"] },
      sideboardOrder: {},
      faceDownBattlefield: {},
      handReveals: {},
      libraryReveals: { c1: { toPlayers: ["p2"] } },
      faceDownReveals: {},
      cardChunkKeys: [chunkKey],
    });
    store.set(chunkKey, { c1: hiddenCard });
    store.set(INTENT_LOG_META_KEY, {
      nextIndex: 1,
      logStartIndex: 0,
      snapshotIndex: -1,
      lastSnapshotAt: 0,
    });
    store.set(`${INTENT_LOG_PREFIX}0`, {
      index: 0,
      ts: 0,
      intent: {
        id: "intent-1",
        type: "player.join",
        payload: {
          actorId: "p1",
          player: {
            id: "p1",
            name: "P1",
            life: 20,
            counters: [],
            commanderDamage: {},
            commanderTax: 0,
          },
        },
      },
    });

    const server = new Room(state, createEnv());
    const loadPersistedHiddenStateSpy = vi.spyOn(
      server as any,
      "loadPersistedHiddenState",
    );

    await (server as any).onLoad();

    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(loadPersistedHiddenStateSpy).not.toHaveBeenCalled();
    expect(applyMock.mock.calls[0]?.[2]).toMatchObject({
      cards: {},
      libraryOrder: {},
    });
  });

  it("purges stale legacy library reveals during snapshot restore", async () => {
    const store = new Map<string, unknown>();
    const storage = {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      list: vi.fn(async () => store.entries()),
    };
    const state = {
      id: { name: "room-test" },
      storage,
    } as any;

    const legacyDoc = new Y.Doc();
    legacyDoc.getMap("libraryRevealsToAll").set("c1", {
      card: { name: "Card c1" },
      orderKey: "000000",
      ownerId: "p1",
    });
    store.set("yjs:doc", Y.encodeStateAsUpdate(legacyDoc).buffer);

    const chunkKey = "snapshot:hidden:snap-1:0";
    const hiddenCard = createHiddenLibraryCard();
    store.set("snapshot:meta", {
      id: "snap-1",
      createdAt: 123,
      lastIntentIndex: -1,
      hiddenStateMeta: {
        handOrder: {},
        libraryOrder: { p1: ["c1"] },
        sideboardOrder: {},
        faceDownBattlefield: {},
        handReveals: {},
        libraryReveals: { c1: { toPlayers: ["p2"] } },
        faceDownReveals: {},
        cardChunkKeys: [chunkKey],
      },
    });
    store.set(chunkKey, { c1: hiddenCard });

    const server = new Room(state, createEnv());
    await server.onLoad();

    expect(server.document.getMap("libraryRevealsToAll").size).toBe(0);
  });

  it("purges stale legacy library reveals during startup from persisted hidden-state meta", async () => {
    const store = new Map<string, unknown>();
    const storage = {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      list: vi.fn(async () => store.entries()),
    };
    const state = {
      id: { name: "room-test" },
      storage,
    } as any;

    const chunkKey = "hiddenState:v2:cards:restore:0";
    const hiddenCard = createHiddenLibraryCard();
    store.set(HIDDEN_STATE_META_KEY, {
      handOrder: {},
      libraryOrder: { p1: ["c1"] },
      sideboardOrder: {},
      faceDownBattlefield: {},
      handReveals: {},
      libraryReveals: { c1: { toPlayers: ["p2"] } },
      faceDownReveals: {},
      cardChunkKeys: [chunkKey],
    });
    store.set(chunkKey, { c1: hiddenCard });

    const legacyDoc = new Y.Doc();
    legacyDoc.getMap("libraryRevealsToAll").set("c1", {
      card: { name: "Card c1" },
      orderKey: "000000",
      ownerId: "p1",
    });
    store.set("yjs:doc", Y.encodeStateAsUpdate(legacyDoc).buffer);

    const server = new Room(state, createEnv());
    await server.onLoad();

    expect(server.document.getMap("libraryRevealsToAll").size).toBe(0);
  });

  it("does not register sync connections that close before auth resolves", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const loadDeferred = createDeferred<unknown>();
    vi.spyOn(server as any, "loadRoomTokens").mockReturnValue(
      loadDeferred.promise
    );

    const conn = new TestConnection();
    const url = new URL("https://example.test/?playerId=p1");
    const bindPromise = (server as any).bindSyncConnection(conn, url, {
      request: new Request(url.toString()),
    });

    await (server as any).onClose(conn, 1000, "client closed", true);
    loadDeferred.resolve(null);
    await bindPromise;

    const roles = (server as any).connectionRoles as Map<unknown, unknown>;
    expect(roles.size).toBe(0);
    expect(superOnConnect).not.toHaveBeenCalled();
  });

  it("keeps the room alive while player auth is pending", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      const loadDeferred = createDeferred<unknown>();
      vi.spyOn(server as any, "loadRoomTokens").mockReturnValue(
        loadDeferred.promise
      );

      (server as any).scheduleEmptyRoomTeardown();

      const conn = new TestConnection();
      const url = new URL(
        "https://example.test/?gt=player-token&playerId=p1"
      );
      const bindPromise = (server as any).bindSyncConnection(conn, url, {
        request: new Request(url.toString()),
      });

      vi.advanceTimersByTime(30_000);
      expect((server as any).resetGeneration).toBe(0);

      loadDeferred.resolve({
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      });
      await bindPromise;
      expect(superOnConnect).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not evict existing devices when only resumed sync auth succeeds", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const resumeToken = await (server as any).ensurePlayerResumeToken("p1");
    vi.spyOn(server as any, "loadRoomTokens").mockResolvedValue({
      playerToken: "player-token",
      spectatorToken: "spectator-token",
    });

    const oldConnection = new TestConnection();
    oldConnection.id = "old-device-sync";
    (server as any).connectionPlayers.set(oldConnection, "p1");
    (server as any).connectionGroups.set(oldConnection, "old-device");

    const conn = new TestConnection();
    const url = new URL(
      `https://example.test/?gt=player-token&playerId=p1&rt=${resumeToken}&cid=new-device`
    );

    await (server as any).bindSyncConnection(conn, url, {
      request: new Request(url.toString()),
    });

    expect(oldConnection.closed).toEqual([]);
    expect(superOnConnect).toHaveBeenCalled();
  });

  it("does not rotate resume token if resumed intent closes before auth resolves", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const initialResumeToken = await (server as any).ensurePlayerResumeToken("p1");
    const loadDeferred = createDeferred<unknown>();
    vi.spyOn(server as any, "loadRoomTokens").mockReturnValue(
      loadDeferred.promise
    );

    const conn = new TestConnection();
    const url = new URL(
      `https://example.test/?role=intent&gt=player-token&playerId=p1&rt=${initialResumeToken}&cid=new-device`
    );
    const bindPromise = (server as any).bindIntentConnection(conn, url);

    await (server as any).onClose(conn, 1000, "client closed", true);
    loadDeferred.resolve({
      playerToken: "player-token",
      spectatorToken: "spectator-token",
    });
    await bindPromise;

    expect(
      await (server as any).validatePlayerResumeToken("p1", initialResumeToken)
    ).toBe(true);
  });

  it("does not register connections that close through the server close hook before auth resolves", async () => {
    const intentState = createState();
    const intentServer = new Room(intentState, createEnv());
    const intentLoadDeferred = createDeferred<unknown>();
    vi.spyOn(intentServer as any, "loadRoomTokens").mockReturnValue(
      intentLoadDeferred.promise,
    );

    const intentConn = new TestConnection();
    intentConn.id = "closing-intent";
    const intentUrl = new URL(
      "https://example.test/?role=intent&gt=player-token&playerId=p1&cid=device-1",
    );
    const intentBindPromise = (intentServer as any).bindIntentConnection(
      intentConn,
      intentUrl,
    );

    await (intentServer as any).onClose(intentConn, 1000, "client closed", true);
    intentLoadDeferred.resolve({
      playerToken: "player-token",
      spectatorToken: "spectator-token",
    });
    await intentBindPromise;

    expect((intentServer as any).connectionRoles.size).toBe(0);
    expect((intentServer as any).intentConnections.has(intentConn)).toBe(false);
    expect(intentConn.sent).toEqual([]);

    const syncState = createState();
    const syncServer = new Room(syncState, createEnv());
    const syncLoadDeferred = createDeferred<unknown>();
    vi.spyOn(syncServer as any, "loadRoomTokens").mockReturnValue(
      syncLoadDeferred.promise,
    );

    const syncConn = new TestConnection();
    syncConn.id = "closing-sync";
    const syncUrl = new URL(
      "https://example.test/?gt=player-token&playerId=p2&cid=device-2",
    );
    const syncBindPromise = (syncServer as any).bindSyncConnection(
      syncConn,
      syncUrl,
      { request: new Request(syncUrl.toString()) },
    );

    await (syncServer as any).onClose(syncConn, 1000, "client closed", true);
    syncLoadDeferred.resolve({
      playerToken: "player-token",
      spectatorToken: "spectator-token",
    });
    await syncBindPromise;

    expect((syncServer as any).connectionRoles.size).toBe(0);
    expect((syncServer as any).pendingPlayerConnections).toBe(0);
    expect(superOnConnect).not.toHaveBeenCalled();
  });

  it("sends room tokens with a resume token for player intent connections", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const sent: string[] = [];

    const conn = new TestConnection();
    conn.id = "player-intent";
    conn.send = (payload: string) => {
      sent.push(payload);
    };

    const url = new URL(
      "https://example.test/?role=intent&viewerRole=player&playerId=p1&cid=device-1"
    );
    await (server as any).bindIntentConnection(conn, url);

    const roomTokensMessage = sent
      .map((raw) => {
        try {
          return JSON.parse(raw) as {
            type?: string;
            payload?: Record<string, unknown>;
          };
        } catch (_err) {
          return null;
        }
      })
      .find((message) => message?.type === "roomTokens");

    expect(roomTokensMessage?.payload?.playerToken).toBeTypeOf("string");
    expect(roomTokensMessage?.payload?.spectatorToken).toBeTypeOf("string");
    expect(roomTokensMessage?.payload?.resumeToken).toBeTypeOf("string");
  });

  it("keeps normal intent auth free of routine debug logs", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const state = createState();
      const server = new Room(state, createEnv());
      const conn = new TestConnection();
      conn.id = "player-intent";
      const url = new URL(
        "https://example.test/?role=intent&viewerRole=player&playerId=p1&cid=device-1",
      );

      await (server as any).bindIntentConnection(conn, url);

      const routineLogs = infoSpy.mock.calls.filter(
        ([message]) =>
          typeof message === "string" &&
          (message.startsWith("[handoff-debug]") ||
            message === "[party] intent connection established"),
      );
      expect(routineLogs).toHaveLength(0);
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("does not persist room auth tokens in hibernated connection state after auth", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const tokens = await (server as any).ensureRoomTokens();

    const intentConn = new TestConnection();
    intentConn.id = "player-intent";
    const intentUrl = new URL(
      `https://example.test/?role=intent&viewerRole=player&playerId=p1&gt=${tokens.playerToken}&cid=device-1`,
    );
    await (server as any).bindIntentConnection(intentConn, intentUrl);

    expect(intentConn.listenerCount("close")).toBe(0);
    expect((intentConn.state as any)).toMatchObject({
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
      connectionGroupId: "device-1",
    });
    expect((intentConn.state as any).token).toBeUndefined();

    const syncConn = new TestConnection();
    syncConn.id = "player-sync";
    const syncUrl = new URL(
      `https://example.test/?viewerRole=player&playerId=p2&gt=${tokens.playerToken}&cid=device-2`,
    );
    await (server as any).bindSyncConnection(syncConn, syncUrl, {
      request: new Request(syncUrl.toString()),
    });

    expect(syncConn.listenerCount("close")).toBe(0);
    expect((syncConn.state as any)).toMatchObject({
      channel: "sync",
      playerId: "p2",
      viewerRole: "player",
      connectionGroupId: "device-2",
    });
    expect((syncConn.state as any).token).toBeUndefined();
  });

  it("returns canonical share links for authenticated player connections", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const sent: string[] = [];

    const conn = new TestConnection();
    conn.id = "player-intent";
    conn.send = (payload: string) => {
      sent.push(payload);
    };

    const url = new URL(
      "https://example.test/?role=intent&viewerRole=player&playerId=p1&cid=device-1"
    );
    await (server as any).bindIntentConnection(conn, url);

    expect(conn.listenerCount("message")).toBe(0);
    await (server as any).onMessage(
      conn,
      JSON.stringify({
        type: "shareLinksRequest",
        requestId: "share-request-1",
      }),
    );

    await vi.waitFor(() => {
      expect(
        sent.some((raw) => raw.includes('"type":"shareLinksResponse"')),
      ).toBe(true);
    });

    const shareLinksMessage = sent
      .map((raw) => {
        try {
          return JSON.parse(raw) as {
            type?: string;
            ok?: boolean;
            requestId?: string;
            payload?: Record<string, unknown>;
          };
        } catch (_err) {
          return null;
        }
      })
      .find((message) => message?.type === "shareLinksResponse");

    expect(shareLinksMessage?.ok).toBe(true);
    expect(shareLinksMessage?.requestId).toBe("share-request-1");
    expect(String(shareLinksMessage?.payload?.playerInviteUrl)).toContain(
      "https://ds.localhost/rooms/room-test?gt="
    );
    expect(String(shareLinksMessage?.payload?.spectatorInviteUrl)).toContain(
      "https://ds.localhost/rooms/room-test?st="
    );
    expect(String(shareLinksMessage?.payload?.resumeInviteUrl)).toContain(
      "https://ds.localhost/rooms/room-test?rt="
    );
    expect(String(shareLinksMessage?.payload?.resumeInviteUrl)).toContain(
      "playerId=p1"
    );
  });

  it("rejects share-link requests from spectators", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const sent: string[] = [];
    const tokens = await (server as any).ensureRoomTokens();

    const conn = new TestConnection();
    conn.id = "spectator-intent";
    conn.send = (payload: string) => {
      sent.push(payload);
    };

    const url = new URL(
      `https://example.test/?role=intent&viewerRole=spectator&st=${tokens.spectatorToken}&cid=device-1`
    );
    await (server as any).bindIntentConnection(conn, url);

    expect(conn.listenerCount("message")).toBe(0);
    await (server as any).onMessage(
      conn,
      JSON.stringify({
        type: "shareLinksRequest",
        requestId: "share-request-2",
      }),
    );

    await vi.waitFor(() => {
      expect(
        sent.some((raw) => raw.includes('"type":"shareLinksResponse"')),
      ).toBe(true);
    });

    const shareLinksMessage = sent
      .map((raw) => {
        try {
          return JSON.parse(raw) as {
            type?: string;
            ok?: boolean;
            requestId?: string;
            error?: string;
          };
        } catch (_err) {
          return null;
        }
      })
      .find((message) => message?.type === "shareLinksResponse");

    expect(shareLinksMessage).toEqual({
      type: "shareLinksResponse",
      requestId: "share-request-2",
      ok: false,
      error: "Spectators cannot request invite links.",
    });
  });

  it("reuses the prior resume token when resumed rotation fails", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const initialResumeToken = await (server as any).ensurePlayerResumeToken("p1");
    const originalEnsure = (server as any).ensurePlayerResumeToken.bind(server);
    vi.spyOn(server as any, "ensurePlayerResumeToken").mockImplementation(
      (async (playerId: string, options?: { rotate?: boolean }) => {
        if (options?.rotate) {
          throw new Error("storage put failed");
        }
        return originalEnsure(playerId, options);
      }) as any
    );

    const conn = new TestConnection();
    conn.id = "new-device-intent";
    const sent: string[] = [];
    conn.send = (payload: string) => {
      sent.push(payload);
    };
    const url = new URL(
      `https://example.test/?role=intent&playerId=p1&rt=${initialResumeToken}&cid=new-device&gt=player-token`
    );

    await (server as any).bindIntentConnection(conn, url);

    const roomTokensMessage = sent
      .map((raw) => {
        try {
          return JSON.parse(raw) as {
            type?: string;
            payload?: Record<string, unknown>;
          };
        } catch (_err) {
          return null;
        }
      })
      .find((message) => message?.type === "roomTokens");

    expect(conn.closed).toEqual([]);
    expect(roomTokensMessage?.payload?.resumeToken).toBe(initialResumeToken);
    expect(await (server as any).validatePlayerResumeToken("p1", initialResumeToken)).toBe(
      true
    );
    expect(((server as any).connectionRoles as Map<unknown, unknown>).size).toBe(1);
    expect(((server as any).intentConnections as Set<unknown>).size).toBe(1);
  });

  it("does not kick old connections if resumed intent closes during token rotation", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const initialResumeToken = await (server as any).ensurePlayerResumeToken("p1");
    const oldConnection = new TestConnection();
    oldConnection.id = "old-device-sync";
    (server as any).connectionPlayers.set(oldConnection, "p1");
    (server as any).connectionGroups.set(oldConnection, "old-device");
    const restoreSpy = vi.spyOn(server as any, "restorePlayerResumeToken");
    const conn = new TestConnection();
    conn.id = "new-device-intent";

    const rotationDeferred = createDeferred<string>();
    const originalEnsure = (server as any).ensurePlayerResumeToken.bind(server);
    vi.spyOn(server as any, "ensurePlayerResumeToken").mockImplementation(
      (async (playerId: string, options?: { rotate?: boolean }) => {
        if (options?.rotate) {
          await (server as any).onClose(conn, 1000, "client closed", true);
          return rotationDeferred.promise;
        }
        return originalEnsure(playerId, options);
      }) as any
    );

    const url = new URL(
      `https://example.test/?role=intent&playerId=p1&rt=${initialResumeToken}&cid=new-device&gt=player-token`
    );
    const bindPromise = (server as any).bindIntentConnection(conn, url);

    rotationDeferred.resolve("rotated-token");
    await bindPromise;

    expect(oldConnection.closed).toEqual([]);
    expect(restoreSpy).toHaveBeenCalledWith("p1", initialResumeToken);
  });

  it("rotates and expires resume tokens", async () => {
    const state = createState();
    const server = new Room(state, createEnv());

    const first = await (server as any).ensurePlayerResumeToken("p1");
    expect(await (server as any).validatePlayerResumeToken("p1", first)).toBe(true);

    const rotated = await (server as any).ensurePlayerResumeToken("p1", {
      rotate: true,
    });
    expect(rotated).not.toBe(first);
    expect(await (server as any).validatePlayerResumeToken("p1", first)).toBe(false);
    expect(await (server as any).validatePlayerResumeToken("p1", rotated)).toBe(true);

    const tokens = (server as any).playerResumeTokens as Record<
      string,
      { token: string; expiresAt: number }
    >;
    tokens.p1.expiresAt = Date.now() - 1;

    expect(await (server as any).validatePlayerResumeToken("p1", rotated)).toBe(false);
  });

  it("preserves concurrent resume token issuance for different players", async () => {
    const store = new Map<string, unknown>();
    const getGate = createDeferred<void>();
    let gatedGets = 0;
    const storage = {
      get: vi.fn(async (key: string) => {
        if (gatedGets < 2) {
          gatedGets += 1;
          await getGate.promise;
        }
        return store.get(key);
      }),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      list: vi.fn(async () => store.entries()),
    };
    const state = {
      id: { name: "room-test" },
      storage,
    } as any;
    const server = new Room(state, createEnv());

    const p1Promise = (server as any).ensurePlayerResumeToken("p1");
    const p2Promise = (server as any).ensurePlayerResumeToken("p2");

    for (let i = 0; i < 10 && gatedGets < 2; i += 1) {
      await Promise.resolve();
    }
    getGate.resolve();

    const [p1Token, p2Token] = await Promise.all([p1Promise, p2Promise]);
    expect(await (server as any).validatePlayerResumeToken("p1", p1Token)).toBe(
      true
    );
    expect(await (server as any).validatePlayerResumeToken("p2", p2Token)).toBe(
      true
    );
    const tokens = (server as any).playerResumeTokens as Record<
      string,
      { token: string; expiresAt: number }
    >;
    expect(Object.keys(tokens).sort()).toEqual(["p1", "p2"]);
  });

  it("dedupes sync and intent socket pairs in the IP rate limiter", () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const ip = "203.0.113.10";
    const makeUrl = (deviceId: string, role?: "intent") =>
      new URL(
        `https://example.test/?playerId=p1&viewerRole=player&cid=${deviceId}${
          role ? `&role=${role}` : ""
        }`
      );
    const makeRequest = (url: URL) =>
      new Request(url.toString(), {
        headers: { "cf-connecting-ip": ip },
      });

    const syncUrl = makeUrl("device-1");
    const intentUrl = makeUrl("device-1", "intent");

    expect((server as any).shouldRateLimitConnection(makeRequest(syncUrl), syncUrl)).toBe(
      false
    );
    expect(
      (server as any).shouldRateLimitConnection(makeRequest(intentUrl), intentUrl)
    ).toBe(false);
    expect((server as any).connectionRate.get(ip)?.attempts).toBe(1);

    for (let index = 2; index <= 20; index += 1) {
      const nextSyncUrl = makeUrl(`device-${index}`);
      const nextIntentUrl = makeUrl(`device-${index}`, "intent");
      expect(
        (server as any).shouldRateLimitConnection(
          makeRequest(nextSyncUrl),
          nextSyncUrl
        )
      ).toBe(false);
      expect(
        (server as any).shouldRateLimitConnection(
          makeRequest(nextIntentUrl),
          nextIntentUrl
        )
      ).toBe(false);
    }

    const blockedUrl = makeUrl("device-21");
    expect(
      (server as any).shouldRateLimitConnection(makeRequest(blockedUrl), blockedUrl)
    ).toBe(true);
  });

  it("keeps empty rooms dormant until the durable alarm hard-resets them", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const state = createState();
      const server = new Room(state, createEnv());
      const clearRoomStorage = vi
        .spyOn(server as any, "clearRoomStorage")
        .mockResolvedValue(undefined);
      (server as any).roomTokens = {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      };

      (server as any).scheduleEmptyRoomTeardown();
      await Promise.resolve();

      expect(state.storage.put).toHaveBeenCalledWith(
        EMPTY_ROOM_STARTED_AT_KEY,
        1_000,
      );
      expect(state.storage.setAlarm).toHaveBeenCalledWith(
        1_000 + EMPTY_ROOM_TOTAL_RESET_MS,
      );

      await Promise.resolve();
      expect(clearRoomStorage).not.toHaveBeenCalled();
      expect((server as any).emptyRoomDormantAt).not.toBeNull();
      expect((server as any).roomTokens).toEqual({
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      });
      expect((server as any).emptyRoomIdleTimer ?? null).toBeNull();
      expect((server as any).emptyRoomHardResetTimer ?? null).toBeNull();

      vi.setSystemTime(1_000 + EMPTY_ROOM_TOTAL_RESET_MS + 1);
      await (server as any).alarm();
      expect(clearRoomStorage).toHaveBeenCalled();
      expect((server as any).roomTokens).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the durable empty-room alarm when a player reconnects", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(5_000);
      const state = createState();
      const server = new Room(state, createEnv());

      (server as any).scheduleEmptyRoomTeardown();
      await Promise.resolve();

      const conn = new TestConnection();
      (server as any).registerConnection(conn, "player", {
        playerId: "p1",
        viewerRole: "player",
      });
      await Promise.resolve();

      expect(state.storage.delete).toHaveBeenCalledWith(
        EMPTY_ROOM_STARTED_AT_KEY,
      );
      expect(state.storage.deleteAlarm).toHaveBeenCalled();
      expect(await state.storage.getAlarm()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the Durable Object alarm to tear down empty rooms after eviction", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const state = createState();
      await state.storage.put(EMPTY_ROOM_STARTED_AT_KEY, 1_000);
      await state.storage.put(ROOM_TOKENS_KEY, {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      });

      vi.setSystemTime(1_000 + EMPTY_ROOM_TOTAL_RESET_MS + 1);
      const server = new Room(state, createEnv());
      await (server as any).alarm();

      expect(state.storage.delete).toHaveBeenCalledWith(ROOM_TOKENS_KEY);
      expect(state.storage.delete).toHaveBeenCalledWith(
        EMPTY_ROOM_STARTED_AT_KEY,
      );
      expect(state.storage.deleteAlarm).toHaveBeenCalled();
      expect((server as any).roomTokens).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not schedule empty-room teardown when hibernated peers remain connected", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(30_000);
      const state = createState();
      const server = new Room(state, createEnv());
      const closing = new TestConnection();
      closing.id = "closing-sync";
      closing.state = {
        channel: "sync",
        playerId: "p1",
        viewerRole: "player",
      };
      const remaining = new TestConnection();
      remaining.id = "remaining-intent";
      remaining.state = {
        channel: "intent",
        playerId: "p2",
        viewerRole: "player",
      };
      (server as any).getConnections = () => [remaining];

      await (server as any).onClose(closing, 1000, "closed", true);
      await Promise.resolve();

      expect(await state.storage.get(EMPTY_ROOM_STARTED_AT_KEY)).toBeUndefined();
      expect(state.storage.setAlarm).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unregisters a closing sync connection once when a pending close handler exists", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(30_000);
      const state = createState();
      const server = new Room(state, createEnv());
      const closing = new TestConnection();
      closing.id = "closing-sync";
      closing.state = {
        channel: "sync",
        playerId: "p1",
        viewerRole: "player",
        connectionGroupId: "device-1",
      };
      const remaining = new TestConnection();
      remaining.id = "remaining-intent";
      remaining.state = {
        channel: "intent",
        playerId: "p2",
        viewerRole: "player",
        connectionGroupId: "device-2",
      };
      (server as any).registerConnection(closing, "player", closing.state);
      (server as any).registerPendingCloseHandler(closing, () => {
        (server as any).unregisterConnection(closing);
      });
      (server as any).getConnections = () => [remaining];

      await (server as any).onClose(closing, 1000, "closed", true);

      const peerCountMessages = remaining.sent
        .map((payload) => JSON.parse(payload))
        .filter((message) => message.type === "peerCounts");
      expect(peerCountMessages).toEqual([
        {
          type: "peerCounts",
          payload: { total: 1, players: 1, spectators: 0 },
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not tear down a room with hibernated active players when an old empty-room alarm fires", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const state = createState();
      await state.storage.put(EMPTY_ROOM_STARTED_AT_KEY, 1_000);
      await state.storage.put(ROOM_TOKENS_KEY, {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      });
      const server = new Room(state, createEnv());
      const active = new TestConnection();
      active.id = "active-sync";
      active.state = {
        channel: "sync",
        playerId: "p1",
        viewerRole: "player",
      };
      (server as any).getConnections = () => [active];
      const clearRoomStorage = vi
        .spyOn(server as any, "clearRoomStorage")
        .mockResolvedValue(undefined);

      vi.setSystemTime(1_000 + EMPTY_ROOM_TOTAL_RESET_MS + 1);
      await (server as any).alarm();

      expect(clearRoomStorage).not.toHaveBeenCalled();
      expect(state.storage.delete).toHaveBeenCalledWith(
        EMPTY_ROOM_STARTED_AT_KEY,
      );
      expect(state.storage.deleteAlarm).toHaveBeenCalled();
      expect(await state.storage.get(ROOM_TOKENS_KEY)).toEqual({
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes hibernated spectator sockets when an empty room tears down", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const state = createState();
      await state.storage.put(EMPTY_ROOM_STARTED_AT_KEY, 1_000);
      const server = new Room(state, createEnv());
      const spectatorIntent = new TestConnection();
      spectatorIntent.id = "hibernated-spectator-intent";
      spectatorIntent.state = {
        channel: "intent",
        viewerRole: "spectator",
      };
      const spectatorSync = new TestConnection();
      spectatorSync.id = "hibernated-spectator-sync";
      spectatorSync.state = {
        channel: "sync",
        viewerRole: "spectator",
      };
      (server as any).getConnections = () => [spectatorIntent, spectatorSync];
      vi.spyOn(server as any, "clearRoomStorage").mockResolvedValue(undefined);

      vi.setSystemTime(1_000 + EMPTY_ROOM_TOTAL_RESET_MS + 1);
      await (server as any).alarm();

      expect(spectatorIntent.closed.at(0)).toEqual({
        code: ROOM_TEARDOWN_CLOSE_CODE,
        reason: "room reset",
      });
      expect(spectatorSync.closed.at(0)).toEqual({
        code: ROOM_TEARDOWN_CLOSE_CODE,
        reason: "room reset",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not reset the empty-room clock for failed pending auth", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(10_000);
      const state = createState();
      const server = new Room(state, createEnv());

      (server as any).scheduleEmptyRoomTeardown();
      await Promise.resolve();

      const startedAtBeforePending = await state.storage.get(
        EMPTY_ROOM_STARTED_AT_KEY,
      );
      const releasePending = (server as any).beginPendingPlayerConnection();
      await Promise.resolve();
      releasePending();
      (server as any).scheduleEmptyRoomTeardown();
      await Promise.resolve();

      expect(await state.storage.get(EMPTY_ROOM_STARTED_AT_KEY)).toBe(
        startedAtBeforePending,
      );
      expect(state.storage.setAlarm).toHaveBeenLastCalledWith(
        10_000 + EMPTY_ROOM_TOTAL_RESET_MS,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("schedules empty-room teardown without keeping in-memory timers alive", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(20_000);
      const state = createState();
      const server = new Room(state, createEnv());

      (server as any).scheduleEmptyRoomTeardown();
      await Promise.resolve();

      expect(await state.storage.get(EMPTY_ROOM_STARTED_AT_KEY)).toBe(20_000);
      expect(state.storage.setAlarm).toHaveBeenCalledWith(
        20_000 + EMPTY_ROOM_TOTAL_RESET_MS,
      );
      expect((server as any).emptyRoomIdleTimer ?? null).toBeNull();
      expect((server as any).emptyRoomHardResetTimer ?? null).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("registers empty-room lifecycle background work with waitUntil", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(20_000);
      const state = createState();
      state.waitUntil = vi.fn();
      const server = new Room(state, createEnv());

      (server as any).scheduleEmptyRoomTeardown();
      await Promise.resolve();

      expect(state.waitUntil).toHaveBeenCalled();
      expect(state.waitUntil.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts resume auth without a connection group id", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const resumeToken = await (server as any).ensurePlayerResumeToken("p1");

    const result = await (server as any).resolveConnectionAuthWithResume(
      {
        playerId: "p1",
        viewerRole: "player",
        resumeToken,
      },
      {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      },
      { allowTokenCreation: false },
    );

    expect(result).toEqual({
      ok: true,
      resolvedRole: "player",
      playerId: "p1",
      token: "player-token",
      tokens: {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      },
      resumed: true,
    });
  });

  it("falls back to player token auth when resume validation fails", async () => {
    const state = createState();
    const server = new Room(state, createEnv());

    const result = await (server as any).resolveConnectionAuthWithResume(
      {
        playerId: "p1",
        viewerRole: "player",
        token: "player-token",
        resumeToken: "stale-resume-token",
        connectionGroupId: "new-device",
      },
      {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      },
      { allowTokenCreation: false },
    );

    expect(result).toEqual({
      ok: true,
      resolvedRole: "player",
      playerId: "p1",
      token: "player-token",
      tokens: {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      },
      resumed: false,
    });
  });

  it("prefers resume auth when both player token and resume token are present", async () => {
    const state = createState();
    const server = new Room(state, createEnv());
    const resumeToken = await (server as any).ensurePlayerResumeToken("p1");

    const result = await (server as any).resolveConnectionAuthWithResume(
      {
        playerId: "p1",
        viewerRole: "player",
        token: "player-token",
        resumeToken,
        connectionGroupId: "new-device",
      },
      {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      },
      { allowTokenCreation: false },
    );

    expect(result).toEqual({
      ok: true,
      resolvedRole: "player",
      playerId: "p1",
      token: "player-token",
      tokens: {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      },
      resumed: true,
    });
  });

  it("closes mismatched sync and intent connections on takeover", () => {
    const state = createState();
    const server = new Room(state, createEnv());

    const current = new TestConnection();
    current.id = "current";
    const oldSync = new TestConnection();
    oldSync.id = "old-sync";
    const oldIntent = new TestConnection();
    oldIntent.id = "old-intent";
    const legacySyncWithoutGroup = new TestConnection();
    legacySyncWithoutGroup.id = "legacy-sync-without-group";
    const sameGroup = new TestConnection();
    sameGroup.id = "same-group";

    (server as any).connectionPlayers.set(oldSync, "p1");
    (server as any).connectionGroups.set(oldSync, "old-device");
    (server as any).connectionPlayers.set(oldIntent, "p1");
    (server as any).connectionGroups.set(oldIntent, "old-device");
    (server as any).intentConnections.add(oldIntent);
    (server as any).connectionPlayers.set(legacySyncWithoutGroup, "p1");
    (server as any).connectionPlayers.set(sameGroup, "p1");
    (server as any).connectionGroups.set(sameGroup, "new-device");

    (server as any).closeConnectionsForResumedPlayer("p1", "new-device", current);

    expect(oldSync.closed.at(0)).toEqual({
      code: 1008,
      reason: "session moved to another device",
    });
    expect(oldIntent.closed.at(0)).toEqual({
      code: 1008,
      reason: "session moved to another device",
    });
    expect(legacySyncWithoutGroup.closed.at(0)).toEqual({
      code: 1008,
      reason: "session moved to another device",
    });
    expect(sameGroup.closed).toEqual([]);
  });

  it("closes hibernated stale player connections on takeover", () => {
    const state = createState();
    const server = new Room(state, createEnv());

    const current = new TestConnection();
    current.id = "current";
    current.state = {
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
      connectionGroupId: "new-device",
    };
    const oldSync = new TestConnection();
    oldSync.id = "old-sync";
    oldSync.state = {
      channel: "sync",
      playerId: "p1",
      viewerRole: "player",
      connectionGroupId: "old-device",
    };
    const oldIntent = new TestConnection();
    oldIntent.id = "old-intent";
    oldIntent.state = {
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
      connectionGroupId: "old-device",
    };
    const sameGroup = new TestConnection();
    sameGroup.id = "same-group";
    sameGroup.state = {
      channel: "sync",
      playerId: "p1",
      viewerRole: "player",
      connectionGroupId: "new-device",
    };
    (server as any).getConnections = () => [
      current,
      oldSync,
      oldIntent,
      sameGroup,
    ];

    (server as any).closeConnectionsForResumedPlayer("p1", "new-device", current);

    expect(oldSync.closed.at(0)).toEqual({
      code: 1008,
      reason: "session moved to another device",
    });
    expect(oldIntent.closed.at(0)).toEqual({
      code: 1008,
      reason: "session moved to another device",
    });
    expect(sameGroup.closed).toEqual([]);
  });

  it("closes legacy intent controllers when resumed takeover omits a connection group id", () => {
    const state = createState();
    const server = new Room(state, createEnv());

    const current = new TestConnection();
    current.id = "current";
    const matchingLegacySync = new TestConnection();
    matchingLegacySync.id = "matching-legacy-sync";
    matchingLegacySync.state = {
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "resume-token",
    };
    const matchingLegacyIntent = new TestConnection();
    matchingLegacyIntent.id = "matching-legacy-intent";
    matchingLegacyIntent.state = {
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "resume-token",
    };
    const staleLegacySync = new TestConnection();
    staleLegacySync.id = "stale-legacy-sync";
    staleLegacySync.state = {
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "stale-token",
    };

    (server as any).connectionPlayers.set(matchingLegacySync, "p1");
    (server as any).connectionPlayers.set(matchingLegacyIntent, "p1");
    (server as any).intentConnections.add(matchingLegacyIntent);
    (server as any).connectionPlayers.set(staleLegacySync, "p1");

    (server as any).closeConnectionsForResumedPlayer(
      "p1",
      undefined,
      current,
      "resume-token",
    );

    expect(matchingLegacySync.closed).toEqual([]);
    expect(matchingLegacyIntent.closed.at(0)).toEqual({
      code: 1008,
      reason: "session moved to another device",
    });
    expect(staleLegacySync.closed.at(0)).toEqual({
      code: 1008,
      reason: "session moved to another device",
    });
  });

  it("preserves legacy sync exemption across repeated resume token rotations", () => {
    const state = createState();
    const server = new Room(state, createEnv());

    const current = new TestConnection();
    current.id = "current";
    current.state = {
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "resume-token-1",
    };
    const legacySync = new TestConnection();
    legacySync.id = "legacy-sync";
    legacySync.state = {
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "resume-token-1",
    };

    (server as any).connectionPlayers.set(legacySync, "p1");

    (server as any).closeConnectionsForResumedPlayer(
      "p1",
      undefined,
      current,
      "resume-token-1",
    );
    (server as any).refreshLegacyResumeTokens(
      "p1",
      "resume-token-1",
      "resume-token-2",
      current,
      undefined,
    );

    expect(legacySync.closed).toEqual([]);
    expect((legacySync.state as any).resumeToken).toBe("resume-token-2");

    const nextCurrent = new TestConnection();
    nextCurrent.id = "next-current";
    nextCurrent.state = {
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "resume-token-2",
    };

    (server as any).closeConnectionsForResumedPlayer(
      "p1",
      undefined,
      nextCurrent,
      "resume-token-2",
    );

    expect(legacySync.closed).toEqual([]);
  });

  it("refreshes hibernated legacy sync resume tokens after no-group resume", () => {
    const state = createState();
    const server = new Room(state, createEnv());

    const current = new TestConnection();
    current.id = "current";
    current.state = {
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "resume-token-1",
    };
    const hibernatedLegacySync = new TestConnection();
    hibernatedLegacySync.id = "hibernated-legacy-sync";
    hibernatedLegacySync.state = {
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "resume-token-1",
    };
    const hibernatedLegacyIntent = new TestConnection();
    hibernatedLegacyIntent.id = "hibernated-legacy-intent";
    hibernatedLegacyIntent.state = {
      channel: "intent",
      playerId: "p1",
      viewerRole: "player",
      resumeToken: "resume-token-1",
    };
    (server as any).getConnections = () => [
      current,
      hibernatedLegacySync,
      hibernatedLegacyIntent,
    ];

    (server as any).refreshLegacyResumeTokens(
      "p1",
      "resume-token-1",
      "resume-token-2",
      current,
      undefined,
    );

    expect((hibernatedLegacySync.state as any).resumeToken).toBe(
      "resume-token-2",
    );
    expect((hibernatedLegacyIntent.state as any).resumeToken).toBe(
      "resume-token-1",
    );
  });
});
