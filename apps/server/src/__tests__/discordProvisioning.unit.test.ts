import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";

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

import { DISCORD_INVITE_METADATA_KEY, ROOM_TOKENS_KEY } from "../domain/constants";
import server, { Room } from "../server";

const ensureWebCrypto = () => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto });
  }
};

beforeAll(() => {
  ensureWebCrypto();
});

describe("discord provisioning endpoint", () => {
  beforeEach(() => {
    mocks.routePartykitRequest.mockClear();
  });

  it("rejects invalid service auth and does not provision room state", async () => {
    const roomFetch = vi.fn(async () => new Response("ok"));
    const rooms = {
      idFromName: vi.fn((name: string) => name),
      get: vi.fn(() => ({ fetch: roomFetch })),
    };

    const env = {
      JOIN_TOKEN_SECRET: "join-secret",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      NODE_ENV: "production",
      rooms,
    } as any;

    const response = await server.fetch(
      new Request("https://drawspell-server/rooms", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-secret",
        },
        body: JSON.stringify({
          interactionId: "interaction-1",
          guildId: "guild-1",
          channelId: "channel-1",
          invokerDiscordUserId: "user-1",
          participantDiscordUserIds: ["user-1"],
        }),
      }),
      env,
    );

    expect(response.status).toBe(401);
    expect(rooms.idFromName).not.toHaveBeenCalled();
    expect(rooms.get).not.toHaveBeenCalled();
    expect(roomFetch).not.toHaveBeenCalled();
  });

  it("fails when NODE_ENV is not configured", async () => {
    const roomFetch = vi.fn(async () => new Response("ok"));
    const rooms = {
      idFromName: vi.fn((name: string) => name),
      get: vi.fn(() => ({ fetch: roomFetch })),
    };

    const env = {
      JOIN_TOKEN_SECRET: "join-secret",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      rooms,
    } as any;

    const response = await server.fetch(
      new Request("https://example.test/rooms", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer service-secret",
        },
        body: JSON.stringify({
          interactionId: "interaction-missing-origin",
          guildId: "guild-1",
          channelId: "channel-1",
          invokerDiscordUserId: "user-1",
          participantDiscordUserIds: ["user-1"],
        }),
      }),
      env,
    );

    expect(response.status).toBe(500);
    expect(rooms.idFromName).not.toHaveBeenCalled();
    expect(rooms.get).not.toHaveBeenCalled();
    expect(roomFetch).not.toHaveBeenCalled();
  });

  it("returns player invite link in /rooms/<roomId>?gt=<playerToken> format", async () => {
    const rooms = {
      idFromName: vi.fn((name: string) => ({ name })),
      get: vi.fn(() => ({
        fetch: vi.fn(async (request: Request) =>
          Response.json({
            roomId: request.headers.get("x-partykit-room"),
            playerToken: "player-token-xyz",
            expiresAt: 1_234_567,
            alreadyProvisioned: false,
          }),
        ),
      })),
    };

    const env = {
      JOIN_TOKEN_SECRET: "join-secret",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      NODE_ENV: "production",
      rooms,
    } as any;

    const response = await server.fetch(
      new Request("https://drawspell-server/rooms", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer service-secret",
        },
        body: JSON.stringify({
          interactionId: "interaction-2",
          guildId: "guild-1",
          channelId: "channel-1",
          invokerDiscordUserId: "user-1",
          participantDiscordUserIds: ["user-1", "user-2"],
        }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      roomId: string;
      playerToken: string;
      playerInviteUrl: string;
      expiresAt: number;
      alreadyProvisioned: boolean;
    };
    expect(payload).toMatchObject({
      roomId: expect.any(String),
      playerToken: "player-token-xyz",
      expiresAt: 1_234_567,
      alreadyProvisioned: false,
    });
    expect(payload.playerInviteUrl).toBe(
      `https://drawspell.space/rooms/${payload.roomId}?gt=player-token-xyz`,
    );
  });

  it("returns the staging invite origin for the staging server host", async () => {
    const rooms = {
      idFromName: vi.fn((name: string) => ({ name })),
      get: vi.fn(() => ({
        fetch: vi.fn(async (request: Request) =>
          Response.json({
            roomId: request.headers.get("x-partykit-room"),
            playerToken: "player-token-staging",
            expiresAt: 1_234_567,
            alreadyProvisioned: false,
          }),
        ),
      })),
    };

    const env = {
      JOIN_TOKEN_SECRET: "join-secret",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      NODE_ENV: "staging",
      rooms,
    } as any;

    const response = await server.fetch(
      new Request("https://drawspell-server-staging/rooms", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer service-secret",
        },
        body: JSON.stringify({
          interactionId: "interaction-staging",
          guildId: "guild-1",
          channelId: "channel-1",
          invokerDiscordUserId: "user-1",
          participantDiscordUserIds: ["user-1"],
        }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      roomId: string;
      playerInviteUrl: string;
    };
    expect(payload.playerInviteUrl).toBe(
      `https://drawspell-staging.service-fff.workers.dev/rooms/${payload.roomId}?gt=player-token-staging`,
    );
  });

  it("stores pending discord invite metadata in room storage", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-02-25T00:00:00.000Z"));
      const inviteExpiresAt = Date.now() + 10 * 60_000;
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
      const room = new Room(
        { id: { name: "room-test" }, storage } as any,
        {
          JOIN_TOKEN_SECRET: "join-secret",
          DISCORD_SERVICE_AUTH_SECRET: "service-secret",
        } as any,
      );

      const response = await room.onRequest(
        new Request("https://example.test/rooms", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-drawspell-service-auth": "service-secret",
          },
          body: JSON.stringify({
            interactionId: "interaction-3",
            guildId: "guild-1",
            channelId: "channel-1",
            invokerDiscordUserId: "user-1",
            participantDiscordUserIds: ["user-1", "user-2"],
            inviteExpiresAt,
          }),
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        roomId: "room-test",
        playerToken: expect.any(String),
        expiresAt: inviteExpiresAt,
        alreadyProvisioned: false,
      });

      expect(store.get(DISCORD_INVITE_METADATA_KEY)).toEqual({
        source: "discord",
        interactionId: "interaction-3",
        inviteExpiresAt,
        createdByDiscordUserId: "user-1",
        participantDiscordUserIds: ["user-1", "user-2"],
        guildId: "guild-1",
        channelId: "channel-1",
      });
      expect(store.get(ROOM_TOKENS_KEY)).toMatchObject({
        playerToken: expect.any(String),
        spectatorToken: expect.any(String),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks repeated room provisioning for the same interaction as already provisioned", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-02-25T00:00:00.000Z"));
      const inviteExpiresAt = Date.now() + 10 * 60_000;
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
      const room = new Room(
        { id: { name: "room-test" }, storage } as any,
        {
          JOIN_TOKEN_SECRET: "join-secret",
          DISCORD_SERVICE_AUTH_SECRET: "service-secret",
        } as any,
      );

      const request = () =>
        new Request("https://example.test/rooms", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-drawspell-service-auth": "service-secret",
          },
          body: JSON.stringify({
            interactionId: "interaction-repeat",
            guildId: "guild-1",
            channelId: "channel-1",
            invokerDiscordUserId: "user-1",
            participantDiscordUserIds: ["user-1", "user-2"],
            inviteExpiresAt,
          }),
        });

      const first = await room.onRequest(request());
      const second = await room.onRequest(request());

      await expect(first.json()).resolves.toMatchObject({
        roomId: "room-test",
        alreadyProvisioned: false,
      });
      await expect(second.json()).resolves.toMatchObject({
        roomId: "room-test",
        alreadyProvisioned: true,
        expiresAt: inviteExpiresAt,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
