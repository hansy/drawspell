import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

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

const LIBRARY_VIEW_PING_TIMEOUT_MS = 45_000;
const HIDDEN_STATE_PERSIST_IDLE_MS = 5_000;
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

class TestConnection {
  id = "conn-1";
  uri = "wss://example.test";
  state: unknown;
  closed: Array<{ code?: number; reason?: string }> = [];
  private listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(event: string, handler: (event: any) => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
  }

  close(code?: number, reason?: string) {
    this.closed.push({ code, reason });
    const handlers = this.listeners.get("close");
    if (!handlers) return;
    handlers.forEach((handler) => handler({ code, reason }));
  }

  send(_payload: string) {}

  setState(nextState: unknown) {
    this.state = nextState;
  }

  emitMessage(payload: string) {
    const handlers = this.listeners.get("message");
    if (!handlers) return;
    handlers.forEach((handler) => handler({ data: payload }));
  }
}

describe("server lifecycle guards", () => {
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

  it("debounces hidden-state persistence across rapid intents", async () => {
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

      await vi.runAllTimersAsync();

      expect(persistSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes hidden-state persistence after idle timeout", async () => {
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

      await (server as any).handleIntent(conn, intent);

      const debounceTimer = (server as any).hiddenStatePersistTimer;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        (server as any).hiddenStatePersistTimer = null;
      }

      await vi.advanceTimersByTimeAsync(HIDDEN_STATE_PERSIST_IDLE_MS + 50);

      expect(persistSpy).toHaveBeenCalledTimes(1);
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

  it("expires library views after missed pings", async () => {
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

      vi.advanceTimersByTime(30_000);
      (server as any).handleLibraryViewPingIntent(conn, {
        type: "library.view.ping",
        payload: { playerId: "p1" },
      });

      vi.advanceTimersByTime(LIBRARY_VIEW_PING_TIMEOUT_MS - 1_000);
      (server as any).cleanupExpiredLibraryViews();
      expect((server as any).libraryViews.size).toBe(1);

      vi.advanceTimersByTime(2_000);
      (server as any).cleanupExpiredLibraryViews();
      expect((server as any).libraryViews.size).toBe(0);
      expect(overlaySpy).toHaveBeenCalledTimes(2);
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

    conn.close(1000, "client closed");
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

    conn.close(1000, "client closed");
    loadDeferred.resolve({
      playerToken: "player-token",
      spectatorToken: "spectator-token",
    });
    await bindPromise;

    expect(
      await (server as any).validatePlayerResumeToken("p1", initialResumeToken)
    ).toBe(true);
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

    conn.emitMessage(
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
      "http://localhost:5173/rooms/room-test?gt="
    );
    expect(String(shareLinksMessage?.payload?.spectatorInviteUrl)).toContain(
      "http://localhost:5173/rooms/room-test?st="
    );
    expect(String(shareLinksMessage?.payload?.resumeInviteUrl)).toContain(
      "http://localhost:5173/rooms/room-test?rt="
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

    conn.emitMessage(
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
          conn.close(1000, "client closed");
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

  it("keeps empty rooms dormant before hard-resetting them", async () => {
    vi.useFakeTimers();
    try {
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

      await vi.advanceTimersByTimeAsync(120_000);
      expect(clearRoomStorage).not.toHaveBeenCalled();
      expect((server as any).emptyRoomDormantAt).not.toBeNull();
      expect((server as any).roomTokens).toEqual({
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      });

      await vi.advanceTimersByTimeAsync(30 * 60_000);
      expect(clearRoomStorage).toHaveBeenCalled();
      expect((server as any).roomTokens).toBeNull();
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
});
