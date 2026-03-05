import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionResponseType, MessageFlags } from "discord-api-types/v10";

const verifyKeyMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("discord-interactions", () => ({
  verifyKey: verifyKeyMock,
}));

import worker from "../worker";

type ServiceBinding = {
  fetch(input: Request | URL | string, init?: RequestInit): Promise<Response>;
};

type TestEnv = {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_SERVICE_AUTH_SECRET: string;
  SERVER: ServiceBinding;
};

const interactionHeaders = {
  "content-type": "application/json",
  "x-signature-ed25519": "sig",
  "x-signature-timestamp": "123",
};

const createRoomInteraction = (overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    id: "interaction-1",
    application_id: "app-1",
    type: 2,
    token: "interaction-token",
    version: 1,
    guild_id: "guild-1",
    channel_id: "channel-1",
    member: {
      user: {
        id: "user-1",
        username: "Invoker",
      },
    },
    data: {
      name: "drawspell",
      type: 1,
      options: [
        {
          name: "room",
          type: 1,
        },
      ],
    },
    ...overrides,
  }) as Record<string, unknown>;

describe("discord /drawspell room", () => {
  beforeEach(() => {
    verifyKeyMock.mockReset();
    verifyKeyMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("responds to Discord endpoint verification ping with minimal payload", async () => {
    const serverFetch = vi.fn(
      async (_input: Request | URL | string, _init?: RequestInit) =>
        new Response("unexpected"),
    );
    const env: TestEnv = {
      DISCORD_PUBLIC_KEY: "public-key",
      DISCORD_BOT_TOKEN: "bot-token",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      SERVER: { fetch: serverFetch },
    };

    const response = await worker.fetch(
      new Request("https://discord-worker.test/interactions", {
        method: "POST",
        headers: interactionHeaders,
        body: JSON.stringify({ type: 1 }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      type: InteractionResponseType.Pong,
    });
    expect(verifyKeyMock).toHaveBeenCalledOnce();
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it("rejects ping when signature validation fails", async () => {
    verifyKeyMock.mockReturnValue(false);
    const serverFetch = vi.fn(
      async (_input: Request | URL | string, _init?: RequestInit) =>
        new Response("unexpected"),
    );
    const env: TestEnv = {
      DISCORD_PUBLIC_KEY: "public-key",
      DISCORD_BOT_TOKEN: "bot-token",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      SERVER: { fetch: serverFetch },
    };

    const response = await worker.fetch(
      new Request("https://discord-worker.test/interactions", {
        method: "POST",
        headers: interactionHeaders,
        body: JSON.stringify({ type: 1 }),
      }),
      env,
    );

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Invalid request signature");
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it("TO-01: sends invoker a DM with room invite when command has no tags", async () => {
    const serverFetch = vi.fn(
      async (_input: Request | URL | string, _init?: RequestInit) =>
      Response.json({
        roomId: "room-abc",
        playerToken: "player-token-abc",
        playerInviteUrl: "https://drawspell.space/game/room-abc?gt=player-token-abc",
        expiresAt: Date.now() + 600_000,
        alreadyProvisioned: false,
      }),
    );
    const env: TestEnv = {
      DISCORD_PUBLIC_KEY: "public-key",
      DISCORD_BOT_TOKEN: "bot-token",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      SERVER: { fetch: serverFetch },
    };

    const discordFetch = vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/users/@me/channels")) {
        return Response.json({ id: "dm-channel-user-1" });
      }
      if (url.endsWith("/channels/dm-channel-user-1/messages")) {
        return Response.json({ id: "message-1" });
      }
      throw new Error(`Unexpected Discord API call: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", discordFetch as unknown as typeof fetch);

    const requestBody = createRoomInteraction();
    const response = await worker.fetch(
      new Request("https://discord-worker.test/interactions", {
        method: "POST",
        headers: interactionHeaders,
        body: JSON.stringify(requestBody),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      type: number;
      data?: { content?: string; flags?: number };
    };
    expect(payload.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(payload.data?.flags).toBe(MessageFlags.Ephemeral);
    expect(payload.data?.content).toContain("DM sent to 1 participant");

    expect(serverFetch).toHaveBeenCalledTimes(1);
    const provisionInit = serverFetch.mock.calls[0]![1] as RequestInit;
    const provisionBody = JSON.parse(String(provisionInit.body)) as {
      interactionId: string;
      participantDiscordUserIds: string[];
      invokerDiscordUserId: string;
      guildId: string;
      channelId: string;
    };
    expect(provisionBody).toEqual({
      interactionId: "interaction-1",
      guildId: "guild-1",
      channelId: "channel-1",
      invokerDiscordUserId: "user-1",
      participantDiscordUserIds: ["user-1"],
    });

    expect(discordFetch).toHaveBeenCalledTimes(2);
    const dmMessageInit = discordFetch.mock.calls[1][1] as RequestInit;
    expect(dmMessageInit.method).toBe("POST");
    const dmPayload = JSON.parse(String(dmMessageInit.body)) as {
      content: string;
    };
    expect(dmPayload.content).toContain(
      "https://drawspell.space/game/room-abc?gt=player-token-abc",
    );
    expect(dmPayload.content).toContain("Invoker");
  });

  it("TO-02: sends identical DM content to invoker and tagged members", async () => {
    const serverFetch = vi.fn(
      async (_input: Request | URL | string, _init?: RequestInit) =>
      Response.json({
        roomId: "room-xyz",
        playerToken: "player-token-xyz",
        playerInviteUrl: "https://drawspell.space/game/room-xyz?gt=player-token-xyz",
        expiresAt: Date.now() + 600_000,
        alreadyProvisioned: false,
      }),
    );
    const env: TestEnv = {
      DISCORD_PUBLIC_KEY: "public-key",
      DISCORD_BOT_TOKEN: "bot-token",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      SERVER: { fetch: serverFetch },
    };

    const dmMessageBodies: string[] = [];
    const discordFetch = vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/users/@me/channels")) {
        const body = JSON.parse(String(init?.body)) as { recipient_id: string };
        return Response.json({ id: `dm-channel-${body.recipient_id}` });
      }
      if (url.includes("/channels/dm-channel-") && url.endsWith("/messages")) {
        const payload = JSON.parse(String(init?.body)) as { content: string };
        dmMessageBodies.push(payload.content);
        return Response.json({ id: `message-${dmMessageBodies.length}` });
      }
      throw new Error(`Unexpected Discord API call: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", discordFetch as unknown as typeof fetch);

    const requestBody = createRoomInteraction({
      data: {
        name: "drawspell",
        type: 1,
        options: [
          {
            name: "room",
            type: 1,
            options: [
              { name: "player1", type: 6, value: "user-2" },
              { name: "player2", type: 6, value: "user-3" },
            ],
          },
        ],
        resolved: {
          users: {
            "user-2": {
              id: "user-2",
              username: "TaggedOne",
            },
            "user-3": {
              id: "user-3",
              username: "TaggedTwo",
            },
          },
        },
      },
    });

    const response = await worker.fetch(
      new Request("https://discord-worker.test/interactions", {
        method: "POST",
        headers: interactionHeaders,
        body: JSON.stringify(requestBody),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(serverFetch).toHaveBeenCalledTimes(1);
    const provisionInit = serverFetch.mock.calls[0]![1] as RequestInit;
    const provisionBody = JSON.parse(String(provisionInit.body)) as {
      participantDiscordUserIds: string[];
    };
    expect(provisionBody.participantDiscordUserIds).toEqual([
      "user-1",
      "user-2",
      "user-3",
    ]);

    expect(dmMessageBodies).toHaveLength(3);
    expect(new Set(dmMessageBodies).size).toBe(1);
    expect(dmMessageBodies[0]).toContain(
      "https://drawspell.space/game/room-xyz?gt=player-token-xyz",
    );
    expect(dmMessageBodies[0]).toContain("Invoker");
    expect(dmMessageBodies[0]).toContain("TaggedOne");
    expect(dmMessageBodies[0]).toContain("TaggedTwo");
  });

  it("TO-03: includes only first three unique non-bot tagged members", async () => {
    const serverFetch = vi.fn(
      async (_input: Request | URL | string, _init?: RequestInit) =>
      Response.json({
        roomId: "room-prune",
        playerToken: "player-token-prune",
        playerInviteUrl: "https://drawspell.space/game/room-prune?gt=player-token-prune",
        expiresAt: Date.now() + 600_000,
        alreadyProvisioned: false,
      }),
    );
    const env: TestEnv = {
      DISCORD_PUBLIC_KEY: "public-key",
      DISCORD_BOT_TOKEN: "bot-token",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      SERVER: { fetch: serverFetch },
    };

    const dmRecipientIds: string[] = [];
    const discordFetch = vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/users/@me/channels")) {
        const body = JSON.parse(String(init?.body)) as { recipient_id: string };
        dmRecipientIds.push(body.recipient_id);
        return Response.json({ id: `dm-channel-${body.recipient_id}` });
      }
      if (url.includes("/channels/dm-channel-") && url.endsWith("/messages")) {
        return Response.json({ id: "message-id" });
      }
      throw new Error(`Unexpected Discord API call: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", discordFetch as unknown as typeof fetch);

    const requestBody = createRoomInteraction({
      data: {
        name: "drawspell",
        type: 1,
        options: [
          {
            name: "room",
            type: 1,
            options: [
              { name: "user1", type: 6, value: "user-2" },
              { name: "duplicate", type: 6, value: "user-2" },
              { name: "bot", type: 6, value: "bot-1" },
              { name: "user2", type: 6, value: "user-3" },
              { name: "user3", type: 6, value: "user-4" },
              { name: "overflow", type: 6, value: "user-5" },
            ],
          },
        ],
        resolved: {
          users: {
            "user-2": { id: "user-2", username: "TaggedOne" },
            "user-3": { id: "user-3", username: "TaggedTwo" },
            "user-4": { id: "user-4", username: "TaggedThree" },
            "user-5": { id: "user-5", username: "TaggedFour" },
            "bot-1": { id: "bot-1", username: "Robot", bot: true },
          },
        },
      },
    });

    const response = await worker.fetch(
      new Request("https://discord-worker.test/interactions", {
        method: "POST",
        headers: interactionHeaders,
        body: JSON.stringify(requestBody),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(serverFetch).toHaveBeenCalledTimes(1);
    const provisionInit = serverFetch.mock.calls[0]![1] as RequestInit;
    const provisionBody = JSON.parse(String(provisionInit.body)) as {
      participantDiscordUserIds: string[];
    };
    expect(provisionBody.participantDiscordUserIds).toEqual([
      "user-1",
      "user-2",
      "user-3",
      "user-4",
    ]);
    expect(dmRecipientIds).toEqual(["user-1", "user-2", "user-3", "user-4"]);

    const payload = (await response.json()) as {
      data?: { content?: string };
    };
    const confirmation = payload.data?.content ?? "";
    expect(confirmation).toContain(
      "Included only the first 3 unique non-bot tagged members.",
    );
    expect(confirmation).toContain("Included participants: Invoker, TaggedOne, TaggedTwo, TaggedThree");
    expect(confirmation).not.toContain("TaggedFour");
    expect(confirmation).not.toContain("Robot");
  });

  it("TO-04: reports failed recipients but continues DM fanout", async () => {
    const serverFetch = vi.fn(
      async (_input: Request | URL | string, _init?: RequestInit) =>
      Response.json({
        roomId: "room-fail",
        playerToken: "player-token-fail",
        playerInviteUrl: "https://drawspell.space/game/room-fail?gt=player-token-fail",
        expiresAt: Date.now() + 600_000,
        alreadyProvisioned: false,
      }),
    );
    const env: TestEnv = {
      DISCORD_PUBLIC_KEY: "public-key",
      DISCORD_BOT_TOKEN: "bot-token",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      SERVER: { fetch: serverFetch },
    };

    const successfulMessageTargets: string[] = [];
    const discordFetch = vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/users/@me/channels")) {
        const body = JSON.parse(String(init?.body)) as { recipient_id: string };
        if (body.recipient_id === "user-3") {
          return new Response("Cannot DM", { status: 403 });
        }
        return Response.json({ id: `dm-channel-${body.recipient_id}` });
      }
      if (url.includes("/channels/dm-channel-") && url.endsWith("/messages")) {
        const channelId = url.split("/channels/")[1]?.split("/messages")[0] ?? "unknown";
        successfulMessageTargets.push(channelId);
        return Response.json({ id: `message-${successfulMessageTargets.length}` });
      }
      throw new Error(`Unexpected Discord API call: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", discordFetch as unknown as typeof fetch);

    const requestBody = createRoomInteraction({
      data: {
        name: "drawspell",
        type: 1,
        options: [
          {
            name: "room",
            type: 1,
            options: [
              { name: "player1", type: 6, value: "user-2" },
              { name: "player2", type: 6, value: "user-3" },
            ],
          },
        ],
        resolved: {
          users: {
            "user-2": { id: "user-2", username: "TaggedOne" },
            "user-3": { id: "user-3", username: "TaggedTwo" },
          },
        },
      },
    });

    const response = await worker.fetch(
      new Request("https://discord-worker.test/interactions", {
        method: "POST",
        headers: interactionHeaders,
        body: JSON.stringify(requestBody),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(successfulMessageTargets).toEqual(["dm-channel-user-1", "dm-channel-user-2"]);

    const payload = (await response.json()) as {
      data?: { content?: string };
    };
    const confirmation = payload.data?.content ?? "";
    expect(confirmation).toContain("DM sent to 2 participants.");
    expect(confirmation).toContain("Failed to DM: TaggedTwo");
  });

  it("returns idempotent acknowledgement without sending duplicate DMs", async () => {
    const serverFetch = vi.fn(
      async (_input: Request | URL | string, _init?: RequestInit) =>
        Response.json({
          roomId: "room-repeat",
          playerToken: "player-token-repeat",
          playerInviteUrl: "https://drawspell.space/game/room-repeat?gt=player-token-repeat",
          expiresAt: Date.now() + 600_000,
          alreadyProvisioned: true,
        }),
    );
    const env: TestEnv = {
      DISCORD_PUBLIC_KEY: "public-key",
      DISCORD_BOT_TOKEN: "bot-token",
      DISCORD_SERVICE_AUTH_SECRET: "service-secret",
      SERVER: { fetch: serverFetch },
    };

    const discordFetch = vi.fn(async () => Response.json({ id: "unused" }));
    vi.stubGlobal("fetch", discordFetch as unknown as typeof fetch);

    const requestBody = createRoomInteraction();
    const response = await worker.fetch(
      new Request("https://discord-worker.test/interactions", {
        method: "POST",
        headers: interactionHeaders,
        body: JSON.stringify(requestBody),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(discordFetch).not.toHaveBeenCalled();
    const payload = (await response.json()) as {
      data?: { content?: string };
    };
    expect(payload.data?.content).toContain("already processed");
    expect(payload.data?.content).toContain(
      "https://drawspell.space/game/room-repeat?gt=player-token-repeat",
    );
  });
});
