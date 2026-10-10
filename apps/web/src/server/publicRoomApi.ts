import { verifyDeveloperApiKey, type DeveloperAuth } from "@mtg/auth";
import {
  parseCreateRoomRequest,
  MAX_CREATE_ROOM_BYTES,
  ROOM_ACTIVATION_TTL_MS,
  ROOM_IDEMPOTENCY_TTL_MS,
  ROOM_PROVISION_PATH,
  ROOM_PROVISION_STATUS_PATH,
  type CreateRoomResponse,
} from "@mtg/shared/api/rooms";
import type { DeveloperEnv } from "./developerEnv";

export const ROOM_BODY_LIMIT = MAX_CREATE_ROOM_BYTES;
const RETENTION_MS = ROOM_IDEMPOTENCY_TTL_MS;
const ACTIVATION_MS = ROOM_ACTIVATION_TTL_MS;
type Operation = {
  request_json: string;
  room_id: string;
  creation_id: string;
  activation_expires_at: number;
  response_json: string | null;
};
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}
const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
export async function readRoomBody(request: Request): Promise<unknown> {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() !== "application/json"
  )
    throw new ApiError(415, "unsupported_media_type", "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(400, "invalid_request", "Provide a JSON object.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > ROOM_BODY_LIMIT) {
      await reader.cancel();
      throw new ApiError(413, "body_too_large", "Request exceeds 160 KiB.");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError(400, "invalid_request", "Provide valid JSON.");
  }
}
async function provisionFetch(env: DeveloperEnv, path: string, body: unknown) {
  return env.SERVER.fetch(
    new Request(`https://room-service${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.ROOM_PROVISION_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}
/** Dependencies are explicit so the public boundary can be exercised without Worker globals. */
export async function handlePublicRoomRequest(
  request: Request,
  env: DeveloperEnv,
  auth: DeveloperAuth,
  now = Date.now(),
): Promise<Response> {
  try {
    const authorization = request.headers.get("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match)
      throw new ApiError(401, "unauthorized", "Provide a valid API key.");
    const identity = await verifyDeveloperApiKey(auth, match[1]!);
    if (!identity.valid)
      throw new ApiError(
        identity.reason !== "invalid" ? 403 : 401,
        identity.reason !== "invalid" ? "forbidden" : "unauthorized",
        identity.reason !== "invalid"
          ? "Developer access is disabled or rooms:create permission is missing."
          : "Provide a valid API key.",
      );
    const developerId = identity.developerId;
    // Atomic INSERT ... SELECT enforces a rolling account-wide minute across keys.
    const quota = await env.DB.prepare(
      `INSERT INTO developer_room_requests (id, developer_id, requested_at)
      SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM developer_room_requests WHERE developer_id = ? AND requested_at > ?) < 10 RETURNING id`,
    )
      .bind(crypto.randomUUID(), developerId, now, developerId, now - 60_000)
      .first();
    if (!quota) {
      const oldest = await env.DB.prepare(
        "SELECT MIN(requested_at) AS first_at FROM developer_room_requests WHERE developer_id = ? AND requested_at > ?",
      )
        .bind(developerId, now - 60_000)
        .first<{ first_at: number }>();
      throw new ApiError(
        429,
        "rate_limited",
        "Room creation allows ten requests per minute per developer.",
        Math.max(
          1,
          Math.ceil(((oldest?.first_at ?? now) + 60_000 - now) / 1000),
        ),
      );
    }
    const retryKey = request.headers.get("idempotency-key");
    if (!retryKey || !/^[\x21-\x7e]{1,128}$/.test(retryKey))
      throw new ApiError(
        400,
        "invalid_request",
        "Provide an Idempotency-Key of 1–128 visible ASCII characters.",
      );
    const normalized = parseCreateRoomRequest(await readRoomBody(request));
    if (!normalized)
      throw new ApiError(
        400,
        "invalid_request",
        "Invalid room request. Check player entries, unique externalId values, and deck-list bounds.",
      );
    const canonical = JSON.stringify(normalized);
    // D1 batch executes transactionally. A concurrent retry can only observe one winner.
    const insert = await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM developer_room_requests WHERE requested_at <= ?",
      ).bind(now - 60_000),
      env.DB.prepare(
        "DELETE FROM developer_room_operations WHERE created_at <= ?",
      ).bind(now - RETENTION_MS),
      env.DB.prepare(
        `INSERT INTO developer_room_operations (developer_id, retry_key, request_json, room_id, creation_id, activation_expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(developer_id, retry_key) DO NOTHING`,
      ).bind(
        developerId,
        retryKey,
        canonical,
        crypto.randomUUID(),
        crypto.randomUUID(),
        now + ACTIVATION_MS,
        now,
      ),
    ]);
    const first = (insert[2]?.meta.changes ?? 0) > 0;
    const operation = await env.DB.prepare(
      "SELECT request_json, room_id, creation_id, activation_expires_at, response_json FROM developer_room_operations WHERE developer_id = ? AND retry_key = ?",
    )
      .bind(developerId, retryKey)
      .first<Operation>();
    if (!operation)
      throw new ApiError(
        503,
        "service_unavailable",
        "Retry this operation using the same Idempotency-Key.",
      );
    if (operation.request_json !== canonical)
      throw new ApiError(
        409,
        "idempotency_conflict",
        "This Idempotency-Key was already used with different content.",
      );
    if (!first) {
      const status = await provisionFetch(env, ROOM_PROVISION_STATUS_PATH, {
        roomId: operation.room_id,
        creationId: operation.creation_id,
      });
      if (!status.ok)
        throw new ApiError(
          503,
          "service_unavailable",
          "Room status is temporarily unavailable. Retry with the same Idempotency-Key.",
        );
      const state = (await status.json()) as { exists: boolean };
      if (
        !state.exists &&
        (operation.response_json || operation.activation_expires_at <= now)
      )
        throw new ApiError(
          410,
          "room_gone",
          "The original room expired or is gone. Use a new Idempotency-Key for a new room.",
        );
      if (state.exists && operation.response_json)
        return json(JSON.parse(operation.response_json), 200, {
          "Idempotency-Replayed": "true",
        });
    }
    const provision = await provisionFetch(env, ROOM_PROVISION_PATH, {
      roomId: operation.room_id,
      creationId: operation.creation_id,
      activationExpiresAt: operation.activation_expires_at,
      request: normalized,
    });
    if (provision.status === 410)
      throw new ApiError(
        410,
        "room_gone",
        "The original room expired or is gone. Use a new Idempotency-Key for a new room.",
      );
    if (!provision.ok)
      throw new ApiError(
        503,
        "service_unavailable",
        "Room provisioning is temporarily unavailable. Retry with the same Idempotency-Key.",
      );
    const response = (await provision.json()) as CreateRoomResponse;
    await env.DB.prepare(
      "UPDATE developer_room_operations SET response_json = ? WHERE developer_id = ? AND retry_key = ? AND creation_id = ? AND response_json IS NULL",
    )
      .bind(
        JSON.stringify(response),
        developerId,
        retryKey,
        operation.creation_id,
      )
      .run();
    return json(
      response,
      first ? 201 : 200,
      first ? {} : { "Idempotency-Replayed": "true" },
    );
  } catch (error) {
    if (error instanceof ApiError)
      return json(
        { error: { code: error.code, message: error.message } },
        error.status,
        error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {},
      );
    return json(
      {
        error: {
          code: "service_unavailable",
          message:
            "Room creation is temporarily unavailable. Retry using the same Idempotency-Key.",
        },
      },
      503,
    );
  }
}
