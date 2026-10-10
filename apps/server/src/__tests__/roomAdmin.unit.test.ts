import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureRuntimePolyfills } from "./runtimePolyfills";

const mocks = vi.hoisted(() => ({
  routePartykitRequest: vi.fn(async () => null),
}));

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
  routePartykitRequest: mocks.routePartykitRequest,
}));

vi.mock("y-partyserver", () => ({
  YServer: class {
    ctx: any;
    env: any;
    name: string;
    constructor(ctx: any, env: any) {
      this.ctx = ctx;
      this.env = env;
      this.name = ctx?.id?.name ?? "room-test";
    }
  },
}));

vi.mock("../domain/intents/applyIntentToDoc", () => ({
  applyIntentToDoc: vi.fn(() => ({ ok: true, hiddenChanged: true, logEvents: [] })),
}));

import {
  EMPTY_ROOM_STARTED_AT_KEY,
  ROOM_TOKENS_KEY,
} from "../domain/constants";
import server, { Room } from "../server";

const createTestStorage = () => {
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

  return { store, storage, getAlarm: () => alarm };
};

beforeAll(() => {
  ensureRuntimePolyfills();
});

describe("room admin endpoints", () => {
  beforeEach(() => {
    mocks.routePartykitRequest.mockClear();
  });

  it("requires room admin auth before probing a room object", async () => {
    const roomFetch = vi.fn(async () => Response.json({ ok: true }));
    const rooms = {
      idFromString: vi.fn((id: string) => ({ id })),
      get: vi.fn(() => ({ fetch: roomFetch })),
    };

    const env = {
      ROOM_ADMIN_TOKEN: "admin-secret",
      rooms,
    } as any;

    const response = await server.fetch(
      new Request("https://drawspell-server/admin/rooms/probe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-secret",
        },
        body: JSON.stringify({ objectId: "object-1" }),
      }),
      env,
    );

    expect(response.status).toBe(401);
    expect(rooms.idFromString).not.toHaveBeenCalled();
    expect(roomFetch).not.toHaveBeenCalled();
  });

  it("proxies authenticated room admin probes by Durable Object id", async () => {
    const roomFetch = vi.fn(async (request: Request) =>
      Response.json({
        internalAuth: request.headers.get("x-drawspell-room-admin-auth"),
        namespace: request.headers.get("x-partykit-namespace"),
        path: new URL(request.url).pathname,
        room: request.headers.get("x-partykit-room"),
      }),
    );
    const rooms = {
      idFromString: vi.fn((id: string) => ({ id })),
      get: vi.fn(() => ({ fetch: roomFetch })),
    };

    const env = {
      ROOM_ADMIN_TOKEN: "admin-secret",
      rooms,
    } as any;

    const response = await server.fetch(
      new Request("https://drawspell-server/admin/rooms/probe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-secret",
        },
        body: JSON.stringify({ objectId: "object-1" }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      internalAuth: "admin-secret",
      namespace: "rooms",
      path: "/__admin/rooms/probe",
      room: "object-1",
    });
    expect(rooms.idFromString).toHaveBeenCalledWith("object-1");
    expect(rooms.get).toHaveBeenCalledWith({ id: "object-1" });
  });

  it("classifies a stored room without lifecycle state as a legacy empty candidate", async () => {
    const { store, storage } = createTestStorage();
    store.set(ROOM_TOKENS_KEY, {
      playerToken: "player-token",
      spectatorToken: "spectator-token",
    });
    const room = new Room(
      { id: { name: "room-test" }, storage } as any,
      { ROOM_ADMIN_TOKEN: "admin-secret" } as any,
    );

    const response = await room.onRequest(
      new Request("https://internal/__admin/rooms/probe", {
        method: "POST",
        headers: {
          "x-drawspell-room-admin-auth": "admin-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      roomId: "room-test",
      classification: "legacy-empty-candidate",
      activePlayerConnections: 0,
      pendingPlayerConnections: 0,
      emptyRoomStartedAt: null,
      alarm: null,
      storage: {
        totalKeys: 1,
        hasRoomTokens: true,
      },
    });
  });

  it("repairs a legacy empty candidate by scheduling its teardown alarm", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-02-25T00:00:00.000Z"));
      const { store, storage, getAlarm } = createTestStorage();
      store.set(ROOM_TOKENS_KEY, {
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      });
      const room = new Room(
        { id: { name: "room-test" }, storage } as any,
        { ROOM_ADMIN_TOKEN: "admin-secret" } as any,
      );

      const response = await room.onRequest(
        new Request("https://internal/__admin/rooms/repair", {
          method: "POST",
          headers: {
            "x-drawspell-room-admin-auth": "admin-secret",
          },
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        repaired: true,
        reason: "scheduled",
        before: {
          classification: "legacy-empty-candidate",
        },
        after: {
          classification: "scheduled-empty",
          emptyRoomStartedAt: Date.now(),
          alarm: Date.now() + 32 * 60_000,
        },
      });
      expect(store.get(EMPTY_ROOM_STARTED_AT_KEY)).toBe(Date.now());
      expect(getAlarm()).toBe(Date.now() + 32 * 60_000);
    } finally {
      vi.useRealTimers();
    }
  });
});


describe("private room provisioning transport", () => {
  it("requires the provision bearer secret and forwards a stable payload to the selected object", async () => {
    const payload = { roomId: "room-1", creationId: "creation-1", activationExpiresAt: Date.now() + 600000, request: { spectatorsEnabled: false, players: [] } };
    const fetch = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/internal/rooms");
      expect(request.headers.get("authorization")).toBe("Bearer private-secret");
      expect(await request.json()).toEqual(payload);
      return Response.json({ roomId: payload.roomId });
    });
    const env = { NODE_ENV: "production", ROOM_PROVISION_SECRET: "private-secret", rooms: { idFromName: (name: string) => name, get: () => ({ fetch }) } } as any;
    const request = (secret: string) => new Request("https://server/internal/rooms", { method: "POST", headers: { authorization: `Bearer ${secret}` }, body: JSON.stringify(payload) });
    expect((await server.fetch(request("wrong"), env)).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect((await server.fetch(request("private-secret"), env)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the compatibility Discord endpoint gated by its secret", async () => {
    const response = await server.fetch(new Request("https://server/rooms", { method: "POST" }), {} as any);
    expect(response.status).toBe(500);
  });

  it("rejects unauthenticated object provisioning without writing storage", async () => {
    const { storage, store } = createTestStorage();
    const room = new Room({ id: { name: "room-test" }, storage } as any, { ROOM_PROVISION_SECRET: "private-secret" } as any);
    const response = await room.onRequest(new Request("https://internal/internal/rooms", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(store.size).toBe(0);
  });
});
