import { beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { createAuth, type DeveloperAuth } from "./index";
import { d1 } from "./testing/d1";
import {
  handlePublicRoomRequest,
  readRoomBody,
  ROOM_BODY_LIMIT,
} from "../../../apps/web/src/server/publicRoomApi";
import type { DeveloperEnv } from "../../../apps/web/src/server/developerEnv";
let sqlite: Database,
  auth: DeveloperAuth,
  env: DeveloperEnv,
  key: string,
  key2: string;
let rooms: Map<string, unknown>,
  provisionCalls: string[],
  failAfterCreate: boolean;
const now = 1_800_000_000_000;
async function createKey(name: string, userId = "developer") {
  return (
    await auth.api.createApiKey({
      body: {
        userId,
        name,
        permissions: { rooms: ["create"] },
        rateLimitEnabled: false,
      },
    })
  ).key;
}
function request(
  body: unknown = {},
  retryKey = crypto.randomUUID(),
  apiKey = key,
) {
  return new Request("https://drawspell.space/api/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": retryKey,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(async () => {
  sqlite = new Database(":memory:");
  for (const migration of [
    "0001_developer_auth.sql",
    "0002_public_room_api.sql",
  ])
    sqlite.exec(
      readFileSync(
        new URL(`../../../apps/web/migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  sqlite
    .query("INSERT INTO developer_user VALUES (?, ?, ?, 1, NULL, ?, ?)")
    .run("developer", "Developer", "dev@example.com", now, now);
  const db = d1(sqlite);
  auth = createAuth({
    db,
    secret: "test-secret-at-least-thirty-two-characters",
    baseURL: "http://localhost:3000",
    sendMagicLink: async () => {},
  });
  key = await createKey("one");
  key2 = await createKey("two");
  rooms = new Map();
  provisionCalls = [];
  failAfterCreate = false;
  env = {
    DB: db,
    SERVER: {
      fetch: async (request) => {
        const body = (await request.json()) as {
          roomId: string;
          creationId: string;
          activationExpiresAt: number;
          request: {
            spectatorsEnabled: boolean;
            players: { externalId: string }[];
          };
        };
        if (new URL(request.url).pathname.endsWith("/status"))
          return Response.json({ exists: rooms.has(body.roomId) });
        provisionCalls.push(body.roomId);
        let result = rooms.get(body.roomId);
        if (!result) {
          result = {
            roomId: body.roomId,
            spectatorsEnabled: body.request.spectatorsEnabled,
            activationExpiresAt: new Date(
              body.activationExpiresAt,
            ).toISOString(),
            playerInviteUrl: `https://drawspell.space/rooms/${body.roomId}?gt=secret`,
            players: body.request.players.map((player) => ({
              externalId: player.externalId,
              joinUrl: `https://drawspell.space/rooms/${body.roomId}?invite=personal`,
            })),
          };
          rooms.set(body.roomId, result);
        }
        if (failAfterCreate) {
          failAfterCreate = false;
          throw new Error("timeout");
        }
        return Response.json(result);
      },
    },
    ROOM_PROVISION_SECRET: "test-private-secret",
  } as DeveloperEnv;
});
describe("public room API", () => {
  test("retry keys are scoped by account and expire after 24 hours", async () => {
    const original = await handlePublicRoomRequest(
      request({}, "shared"),
      env,
      auth,
      now,
    );
    const first = (await original.json()) as { roomId: string };
    sqlite
      .query("INSERT INTO developer_user VALUES (?, ?, ?, 1, NULL, ?, ?)")
      .run("other", "Other", "other@example.com", now, now);
    const otherKey = await createKey("other account", "other");
    const independent = await handlePublicRoomRequest(
      request({}, "shared", otherKey),
      env,
      auth,
      now,
    );
    expect(independent.status).toBe(201);
    expect(((await independent.json()) as { roomId: string }).roomId).not.toBe(
      first.roomId,
    );
    const retained = await handlePublicRoomRequest(
      request({}, "shared"),
      env,
      auth,
      now + 86_399_999,
    );
    expect(retained.status).toBe(200);
    const expired = await handlePublicRoomRequest(
      request({}, "shared"),
      env,
      auth,
      now + 86_400_000,
    );
    expect(expired.status).toBe(201);
    expect(((await expired.json()) as { roomId: string }).roomId).not.toBe(
      first.roomId,
    );
  });

  test("creates trusted lists without lookup, normalizes retry, rotates keys and rejects conflicts", async () => {
    const body = {
      players: [
        {
          externalId: "external",
          deck: { decklist: "1 A completely imaginary card", bracket: 3 },
        },
      ],
    };
    const first = await handlePublicRoomRequest(
      request(body, "retry"),
      env,
      auth,
      now,
    );
    expect(first.status).toBe(201);
    expect(first.headers.get("Cache-Control")).toBe("no-store");
    const created = await first.json();
    const replay = await handlePublicRoomRequest(
      request({ ...body, spectatorsEnabled: true }, "retry", key2),
      env,
      auth,
      now + 1,
    );
    expect(replay.status).toBe(200);
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
    expect(await replay.json()).toEqual(created);
    expect(provisionCalls.length).toBe(1);
    expect(
      (
        await handlePublicRoomRequest(
          request({ spectatorsEnabled: false }, "retry"),
          env,
          auth,
          now + 2,
        )
      ).status,
    ).toBe(409);
  });
  test("concurrent identical submissions share a room and recover timeout after provision", async () => {
    failAfterCreate = true;
    const first = await handlePublicRoomRequest(
      request({}, "timeout"),
      env,
      auth,
      now,
    );
    expect(first.status).toBe(503);
    const replay = await handlePublicRoomRequest(
      request({}, "timeout"),
      env,
      auth,
      now + 1,
    );
    expect(replay.status).toBe(200);
    expect(new Set(provisionCalls).size).toBe(1);
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        handlePublicRoomRequest(request({}, "concurrent"), env, auth, now + 2),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(4);
    expect(rooms.size).toBe(2);
  });
  test("gone and expired pending rooms never provision again; active room replays past activation", async () => {
    await handlePublicRoomRequest(request({}, "active"), env, auth, now);
    expect(
      (
        await handlePublicRoomRequest(
          request({}, "active"),
          env,
          auth,
          now + 600_001,
        )
      ).status,
    ).toBe(200);
    rooms.clear();
    expect(
      (
        await handlePublicRoomRequest(
          request({}, "active"),
          env,
          auth,
          now + 600_002,
        )
      ).status,
    ).toBe(410);
    expect(provisionCalls).toHaveLength(1);
    failAfterCreate = true;
    await handlePublicRoomRequest(
      request({}, "pending"),
      env,
      auth,
      now + 700_000,
    );
    rooms.clear();
    expect(
      (
        await handlePublicRoomRequest(
          request({}, "pending"),
          env,
          auth,
          now + 1_300_001,
        )
      ).status,
    ).toBe(410);
    expect(provisionCalls).toHaveLength(2);
  });
  test("rolling quota is atomic, account-wide across keys and reports Retry-After", async () => {
    const responses = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        handlePublicRoomRequest(
          request({}, crypto.randomUUID(), i % 2 ? key : key2),
          env,
          auth,
          now,
        ),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(10);
    const limited = responses.filter((r) => r.status === 429);
    expect(limited).toHaveLength(5);
    expect(limited[0]!.headers.get("Retry-After")).toBe("60");
    expect(
      (await handlePublicRoomRequest(request(), env, auth, now + 60_000))
        .status,
    ).toBe(201);
  });
  test("credentials, permission, suspension and required headers", async () => {
    expect(
      (
        await handlePublicRoomRequest(
          request({}, "key", "invalid"),
          env,
          auth,
          now,
        )
      ).status,
    ).toBe(401);
    sqlite.exec(
      "UPDATE developer_api_key SET permissions = '{}' WHERE name = 'one'",
    );
    expect(
      (await handlePublicRoomRequest(request(), env, auth, now)).status,
    ).toBe(403);
    sqlite.exec("UPDATE developer_accounts SET suspended=1");
    expect(
      (await handlePublicRoomRequest(request({}, "key", key2), env, auth, now))
        .status,
    ).toBe(403);
  });
  test("rejects malformed JSON, unknown fields, assignments, duplicates and brackets", async () => {
    for (const body of [
      { unexpected: true },
      {
        players: Array.from({ length: 5 }, (_, i) => ({
          externalId: String(i),
        })),
      },
      { players: [{ externalId: "a" }, { externalId: " a " }] },
      {
        players: [{ externalId: "a", deck: { decklist: "list", bracket: 6 } }],
      },
      { players: [{ externalId: "a", deck: { decklist: "x".repeat(32769) } }] },
    ])
      expect(
        (await handlePublicRoomRequest(request(body), env, auth, now)).status,
      ).toBe(400);
    const bad = request();
    bad.headers.delete("Idempotency-Key");
    expect((await handlePublicRoomRequest(bad, env, auth, now)).status).toBe(
      400,
    );
    const malformed = new Request(request(), { body: "{" });
    expect(
      (await handlePublicRoomRequest(malformed, env, auth, now)).status,
    ).toBe(400);
    const wrong = request();
    wrong.headers.set("Content-Type", "text/plain");
    expect((await handlePublicRoomRequest(wrong, env, auth, now)).status).toBe(
      415,
    );
  });
  test("bounds actual streamed UTF-8 bytes and cancels oversized content", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(ROOM_BODY_LIMIT));
        controller.enqueue(new Uint8Array(1));
      },
      cancel() {
        cancelled = true;
      },
    });
    const input = new Request("https://drawspell.space/api/v1/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readRoomBody(input)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
    const oversized = request({ decklist: "é".repeat(ROOM_BODY_LIMIT) });
    expect(
      (await handlePublicRoomRequest(oversized, env, auth, now)).status,
    ).toBe(413);
  });
});
