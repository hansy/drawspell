import { beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createAuth, handleAuthRequest, verifyDeveloperApiKey } from "./index";
import type { DeveloperAuth } from "./index";
import { readFileSync } from "node:fs";
// Exercise the production Drizzle D1 adapter against SQLite, including SQL triggers.
import { d1 } from "./testing/d1";
let sqlite: Database;
let auth: DeveloperAuth;
let sent: { email: string; url: string; token: string }[];
const origin = "http://localhost:3000";
function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
) {
  return new Request(origin + "/api/auth" + path, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      "cf-connecting-ip": "127.0.0.1",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function login(email = "developer@example.com") {
  const sentResponse = await handleAuthRequest(
    auth,
    request("/sign-in/magic-link", "POST", {
      email,
      callbackURL: "/developer",
    }),
  );
  expect(sentResponse.status).toBe(200);
  const verification = await handleAuthRequest(
    auth,
    new Request(sent.at(-1)!.url),
  );
  expect(verification.status).toBe(302);
  const cookies = verification.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  expect(cookies).toContain("session_token");
  return cookies;
}
beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.exec(
    readFileSync(
      new URL(
        "../../../apps/web/migrations/0001_developer_auth.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  sent = [];
  auth = createAuth({
    db: d1(sqlite),
    secret: "test-secret-with-at-least-32-characters",
    baseURL: origin,
    sendMagicLink: async (data) => {
      sent.push(data);
    },
  });
});
describe("developer authentication", () => {
  test("magic links are hashed, expire after ten minutes, single use and sign out", async () => {
    const cookie = await login();
    const stored = sqlite.query("SELECT * FROM developer_verification").all();
    expect(stored).toHaveLength(0);
    expect(
      (await handleAuthRequest(auth, new Request(sent[0]!.url))).status,
    ).toBe(302);
    const replay = await handleAuthRequest(auth, new Request(sent[0]!.url));
    expect(replay.headers.get("location")).toContain("INVALID_TOKEN");
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/developer/keys", "GET", undefined, cookie),
        )
      ).status,
    ).toBe(200);
    expect(
      (await handleAuthRequest(auth, request("/sign-out", "POST", {}, cookie)))
        .status,
    ).toBe(200);
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/developer/keys", "GET", undefined, cookie),
        )
      ).status,
    ).toBe(401);
    await handleAuthRequest(
      auth,
      request("/sign-in/magic-link", "POST", {
        email: "other@example.com",
        callbackURL: "/developer",
      }),
    );
    const row = sqlite
      .query(
        "SELECT identifier, expires_at, created_at FROM developer_verification",
      )
      .get() as { identifier: string; expires_at: number; created_at: number };
    expect(row.identifier).not.toContain(sent.at(-1)!.token);
    expect(row.expires_at - row.created_at).toBeGreaterThanOrEqual(599000);
    expect(row.expires_at - row.created_at).toBeLessThanOrEqual(600000);
    sqlite.exec("UPDATE developer_verification SET expires_at = 0");
    const expired = await handleAuthRequest(
      auth,
      new Request(sent.at(-1)!.url),
    );
    expect(expired.headers.get("location")).toContain("INVALID_TOKEN");
  });
  test("concurrent token redemption mints one session and auth throttles persist in D1", async () => {
    await handleAuthRequest(
      auth,
      request("/sign-in/magic-link", "POST", {
        email: "race@example.com",
        callbackURL: "/developer",
      }),
    );
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        handleAuthRequest(auth, new Request(sent[0]!.url)),
      ),
    );
    expect(
      responses.filter((response) =>
        response.headers
          .getSetCookie()
          .some((cookie) => cookie.includes("session_token=")),
      ),
    ).toHaveLength(1);
    expect(
      sqlite.query("SELECT COUNT(*) AS count FROM developer_session").get(),
    ).toMatchObject({ count: 1 });
    const signins = [];
    for (let n = 0; n < 6; n++)
      signins.push(
        await handleAuthRequest(
          auth,
          request("/sign-in/magic-link", "POST", {
            email: "rate@example.com",
            callbackURL: "/developer",
          }),
        ),
      );
    expect(signins.at(-1)!.status).toBe(429);
    expect(
      sqlite
        .query("SELECT COUNT(*) AS count FROM developer_auth_rate_limit")
        .get(),
    ).toMatchObject({ count: expect.any(Number) });
  });
  test("key cap, safe list, isolation, revocation audit and suspension", async () => {
    const cookie = await login();
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, n) =>
        handleAuthRequest(
          auth,
          request("/developer/keys", "POST", { name: `key ${n}` }, cookie),
        ),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(5);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(3);
    const created = (await responses.find((r) => r.status === 201)!.json()) as {
      id: string;
      key: string;
    };
    expect(created.key).toStartWith("drawspell_");
    const verified = await verifyDeveloperApiKey(auth, created.key);
    expect(verified.valid).toBe(true);
    const list = await handleAuthRequest(
      auth,
      request("/developer/keys", "GET", undefined, cookie),
    );
    expect(await list.text()).not.toContain(created.key);
    const apiSession = await handleAuthRequest(
      auth,
      new Request(origin + "/api/auth/get-session", {
        headers: { "x-api-key": created.key },
      }),
    );
    expect(await apiSession.json()).toBeNull();
    const other = await login("another@example.com");
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/developer/keys/" + created.id, "DELETE", undefined, other),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/api-key/create", "POST", { name: "bypass" }, cookie),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/developer/keys/" + created.id, "DELETE", undefined, cookie),
        )
      ).status,
    ).toBe(200);
    expect((await verifyDeveloperApiKey(auth, created.key)).valid).toBe(false);
    expect(
      sqlite
        .query("SELECT revoked_at FROM developer_key_audit WHERE key_id = ?")
        .get(created.id),
    ).toMatchObject({ revoked_at: expect.any(Number) });
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/developer/keys", "POST", { name: "replacement" }, cookie),
        )
      ).status,
    ).toBe(201);
    if (verified.valid)
      sqlite
        .query(
          "UPDATE developer_accounts SET suspended = 1 WHERE developer_id = ?",
        )
        .run(verified.developerId);
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/developer/keys", "GET", undefined, cookie),
        )
      ).status,
    ).toBe(403);
  });
  test("mutations require session, same origin, and reject owner and quota overrides", async () => {
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/developer/keys", "POST", { name: "a" }),
        )
      ).status,
    ).toBe(401);
    const cookie = await login();
    expect(
      (
        await handleAuthRequest(
          auth,
          request(
            "/developer/keys",
            "POST",
            { name: "a", userId: "other" },
            cookie,
          ),
        )
      ).status,
    ).toBe(400);
    const malformedCallback = await handleAuthRequest(
      auth,
      request("/sign-in/magic-link", "POST", {
        email: "x@example.com",
        callbackURL: "http://[",
      }),
    );
    expect(malformedCallback.status).toBe(400);
    expect(await malformedCallback.json()).toMatchObject({
      error: { code: "invalid_callback" },
    });
    const crossOrigin = request(
      "/developer/keys",
      "POST",
      { name: "a" },
      cookie,
    );
    crossOrigin.headers.set("origin", "https://evil.example");
    expect((await handleAuthRequest(auth, crossOrigin)).status).toBe(403);
    expect(
      (
        await handleAuthRequest(
          auth,
          request("/sign-in/magic-link", "POST", {
            email: "x@example.com",
            callbackURL: "https://evil.example",
          }),
        )
      ).status,
    ).toBe(400);
  });
});
