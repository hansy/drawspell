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
      rooms,
    } as any;

    const response = await server.fetch(
      new Request("https://example.test/internal/discord/rooms/provision", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-secret",
        },
        body: JSON.stringify({
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

  it("returns fully qualified player invite link in /game/<roomId>?gt=<playerToken> format", async () => {
    const rooms = {
      idFromName: vi.fn((name: string) => ({ name })),
      get: vi.fn(() => ({
        fetch: vi.fn(async (request: Request) =>
          Response.json({
            roomId: request.headers.get("x-partykit-room"),
            playerToken: "player-token-xyz",
            expiresAt: 1_234_567,
          }),
        ),
      })),
    };

    const env = {
      JOIN_TOKEN_SECRET: "join-secret",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      rooms,
    } as any;

    const response = await server.fetch(
      new Request("https://example.test/internal/discord/rooms/provision", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer service-secret",
        },
        body: JSON.stringify({
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
    };
    expect(payload).toMatchObject({
      roomId: expect.any(String),
      playerToken: "player-token-xyz",
      expiresAt: 1_234_567,
    });
    expect(payload.playerInviteUrl).toBe(
      `https://drawspell.space/game/${payload.roomId}?gt=player-token-xyz`,
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
        new Request("https://example.test/internal/discord/provision-room", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-drawspell-service-auth": "service-secret",
          },
          body: JSON.stringify({
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
      });

      expect(store.get(DISCORD_INVITE_METADATA_KEY)).toEqual({
        source: "discord",
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
});
