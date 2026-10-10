/** Server-only: never import this package into browser code. */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { apiKey } from "@better-auth/api-key";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export interface AuthConfig {
  db: D1Database;
  secret: string;
  /** Canonical website origin; localhost is allowed for local development. */
  baseURL: string;
  sendMagicLink: (data: {
    email: string;
    url: string;
    token: string;
  }) => Promise<void>;
}
const roomPermissions = { rooms: ["create"] };
export function createAuth(config: AuthConfig) {
  if (config.secret.length < 32)
    throw new Error("Auth secret must contain at least 32 characters.");
  const origin = new URL(config.baseURL).origin;
  const auth = betterAuth({
    logger: { disabled: true },
    appName: "Drawspell",
    secret: config.secret,
    baseURL: origin,
    basePath: "/api/auth",
    trustedOrigins: [origin],
    database: drizzleAdapter(drizzle(config.db, { schema }), {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
    advanced: {
      useSecureCookies: origin.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    session: { cookieCache: { enabled: false } },
    plugins: [
      magicLink({
        expiresIn: 600,
        storeToken: "hashed",
        rateLimit: { window: 60, max: 5 },
        sendMagicLink: config.sendMagicLink,
      }),
      apiKey({
        defaultPrefix: "drawspell_",
        requireName: true,
        maximumNameLength: 64,
        enableSessionForAPIKeys: false,
        rateLimit: { enabled: false },
        permissions: { defaultPermissions: roomPermissions },
        startingCharactersConfig: { shouldStore: true, charactersLength: 13 },
      }),
    ],
  });
  return { ...auth, db: config.db, origin };
}
export type DeveloperAuth = ReturnType<typeof createAuth>;
export class DeveloperAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function getDeveloperSession(
  auth: DeveloperAuth,
  headers: Headers,
) {
  const session = await auth.api.getSession({ headers });
  if (!session)
    throw new DeveloperAuthError(
      401,
      "unauthorized",
      "Sign in to manage developer keys.",
    );
  const account = await auth.db
    .prepare("SELECT suspended FROM developer_accounts WHERE developer_id = ?")
    .bind(session.user.id)
    .first<{ suspended: number }>();
  if (!account || account.suspended)
    throw new DeveloperAuthError(
      403,
      "suspended",
      "Developer access is disabled.",
    );
  return session;
}
export type DeveloperKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
  status: "active" | "revoked" | "expired";
};
export async function listDeveloperKeys(
  auth: DeveloperAuth,
  headers: Headers,
): Promise<DeveloperKey[]> {
  const session = await getDeveloperSession(auth, headers);
  const rows = await auth.db
    .prepare(
      `SELECT a.key_id, a.name, a.prefix, a.created_at, a.revoked_at, k.enabled, k.expires_at
    FROM developer_key_audit a LEFT JOIN developer_api_key k ON k.id = a.key_id
    WHERE a.developer_id = ? ORDER BY a.created_at DESC`,
    )
    .bind(session.user.id)
    .all<{
      key_id: string;
      name: string | null;
      prefix: string | null;
      created_at: number;
      revoked_at: number | null;
      enabled: number | null;
      expires_at: number | null;
    }>();
  return rows.results.map((r) => ({
    id: r.key_id,
    name: r.name ?? "API key",
    prefix: r.prefix ?? "drawspell_",
    createdAt: new Date(r.created_at).toISOString(),
    revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
    status:
      r.revoked_at || !r.enabled
        ? "revoked"
        : r.expires_at && r.expires_at <= Date.now()
          ? "expired"
          : "active",
  }));
}
export async function createDeveloperKey(
  auth: DeveloperAuth,
  headers: Headers,
  input: unknown,
) {
  const session = await getDeveloperSession(auth, headers);
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => key !== "name") ||
    !("name" in input) ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 64
  ) {
    throw new DeveloperAuthError(
      400,
      "invalid_name",
      "Provide only a key name between 1 and 64 characters.",
    );
  }
  try {
    const result = await auth.api.createApiKey({
      body: {
        userId: session.user.id,
        name: input.name.trim(),
        permissions: roomPermissions,
        rateLimitEnabled: false,
      },
    });
    return {
      id: result.id,
      name: result.name,
      prefix: result.start,
      createdAt: result.createdAt.toISOString(),
      key: result.key,
    };
  } catch (error) {
    // Drizzle and Better Auth wrap D1 errors; inspect causes without returning them.
    let cause: unknown = error;
    for (let i = 0; i < 8 && cause instanceof Error; i++, cause = cause.cause) {
      if (cause.message.includes("DEVELOPER_KEY_CAP"))
        throw new DeveloperAuthError(
          409,
          "key_limit",
          "Revoke a key before creating more than five active keys.",
        );
    }
    throw error;
  }
}
export async function revokeDeveloperKey(
  auth: DeveloperAuth,
  headers: Headers,
  keyId: string,
) {
  const session = await getDeveloperSession(auth, headers);
  const key = await auth.db
    .prepare(
      "SELECT key_id FROM developer_key_audit WHERE key_id = ? AND developer_id = ?",
    )
    .bind(keyId, session.user.id)
    .first();
  if (!key)
    throw new DeveloperAuthError(404, "not_found", "API key not found.");
  // Better Auth owns deletion and ownership checks. Already removed keys are idempotent.
  const active = await auth.db
    .prepare(
      "SELECT id FROM developer_api_key WHERE id = ? AND reference_id = ?",
    )
    .bind(keyId, session.user.id)
    .first();
  if (active) await auth.api.deleteApiKey({ headers, body: { keyId } });
  return { success: true };
}
export async function verifyDeveloperApiKey(
  auth: DeveloperAuth,
  key: string,
): Promise<
  | { valid: true; keyId: string; developerId: string }
  | { valid: false; reason: "invalid" | "suspended" | "permission" }
> {
  if (!key.startsWith("drawspell_") || key.length > 256)
    return { valid: false, reason: "invalid" };
  const result = await auth.api.verifyApiKey({
    body: { key },
  });
  if (!result.valid || !result.key) return { valid: false, reason: "invalid" };
  if (!result.key.permissions?.rooms?.includes("create"))
    return { valid: false, reason: "permission" };
  const account = await auth.db
    .prepare("SELECT suspended FROM developer_accounts WHERE developer_id = ?")
    .bind(result.key.referenceId)
    .first<{ suspended: number }>();
  if (!account || account.suspended)
    return { valid: false, reason: "suspended" };
  return {
    valid: true,
    keyId: result.key.id,
    developerId: result.key.referenceId,
  };
}
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
async function readBody(request: Request): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new DeveloperAuthError(
      415,
      "unsupported_media_type",
      "Use application/json.",
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new DeveloperAuthError(400, "invalid_json", "Provide a JSON object.");
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new DeveloperAuthError(
        413,
        "body_too_large",
        "Request body is too large.",
      );
    }
    parts.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DeveloperAuthError(400, "invalid_json", "Provide valid JSON.");
  }
}
/** The only supported HTTP entry point. Raw plugin key endpoints are intentionally unreachable. */
export async function handleAuthRequest(
  auth: DeveloperAuth,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  try {
    if (
      path === "/api/auth/developer/keys" ||
      path.startsWith("/api/auth/developer/keys/")
    ) {
      if (
        request.method !== "GET" &&
        request.headers.get("origin") !== auth.origin
      )
        throw new DeveloperAuthError(
          403,
          "invalid_origin",
          "Request origin is not allowed.",
        );
      if (path === "/api/auth/developer/keys" && request.method === "GET")
        return json({ keys: await listDeveloperKeys(auth, request.headers) });
      if (path === "/api/auth/developer/keys" && request.method === "POST")
        return json(
          await createDeveloperKey(
            auth,
            request.headers,
            await readBody(request),
          ),
          201,
        );
      if (
        /^\/api\/auth\/developer\/keys\/[^/]+$/.test(path) &&
        request.method === "DELETE"
      )
        return json(
          await revokeDeveloperKey(
            auth,
            request.headers,
            decodeURIComponent(path.split("/").at(-1)!),
          ),
        );
      return json(
        {
          error: {
            code: "method_not_allowed",
            message: "Method is not allowed.",
          },
        },
        405,
      );
    }
    const allowed = new Map([
      ["/api/auth/sign-in/magic-link", "POST"],
      ["/api/auth/magic-link/verify", "GET"],
      ["/api/auth/get-session", "GET"],
      ["/api/auth/sign-out", "POST"],
    ]);
    if (!allowed.has(path))
      return json(
        { error: { code: "not_found", message: "Auth endpoint not found." } },
        404,
      );
    if (allowed.get(path) !== request.method)
      return json(
        {
          error: {
            code: "method_not_allowed",
            message: "Method is not allowed.",
          },
        },
        405,
      );
    // Better Auth validates callback origins too; constrain every redirect to this website.
    if (path === "/api/auth/sign-in/magic-link") {
      const body = await readBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new DeveloperAuthError(
          400,
          "invalid_json",
          "Provide a JSON object.",
        );
      for (const field of [
        "callbackURL",
        "newUserCallbackURL",
        "errorCallbackURL",
      ]) {
        const value = (body as Record<string, unknown>)[field];
        let valid = value === undefined;
        if (typeof value === "string") {
          try {
            valid = new URL(value, auth.origin).origin === auth.origin;
          } catch {
            valid = false;
          }
        }
        if (!valid)
          throw new DeveloperAuthError(
            400,
            "invalid_callback",
            "Callback must remain on Drawspell.",
          );
      }
      request = new Request(request, { body: JSON.stringify(body) });
    }
    return await auth.handler(request);
  } catch (error) {
    if (error instanceof DeveloperAuthError)
      return json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    return json(
      {
        error: {
          code: "server_error",
          message: "Authentication is temporarily unavailable.",
        },
      },
      500,
    );
  }
}
