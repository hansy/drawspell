import {
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";
import { RoomAnalyticsTracker } from "./analytics/roomAnalytics";

import type { Card } from "@mtg/shared/types/cards";
import {
  DISCORD_ROOM_PROVISION_PATH,
  type DiscordRoomInternalProvisionPayload,
  type DiscordRoomInternalProvisionResponse,
} from "@mtg/shared/discord/provisioning";

import {
  DISCORD_INVITE_METADATA_KEY,
  EMPTY_ROOM_STARTED_AT_KEY,
  HIDDEN_STATE_CARDS_PREFIX,
  HIDDEN_STATE_KEY,
  HIDDEN_STATE_META_KEY,
  ROOM_TOKENS_KEY,
} from "./domain/constants";
import type {
  DiscordRoomInviteMetadata,
  HiddenState,
  HiddenStateMeta,
  Intent,
  IntentConnectionState,
  IntentImpact,
  RoomTokens,
  Snapshot,
} from "./domain/types";
import { applyIntentToDoc } from "./domain/intents/applyIntentToDoc";
import { buildOverlayZoneLookup } from "./domain/overlay";
import {
  createEmptyHiddenState,
  migrateHiddenStateFromSnapshot,
  normalizeHiddenState,
  syncPublicRevealsToAllFromHiddenState,
} from "./domain/hiddenState";
import { GameLogBuffer, type GameLogEntry } from "./domain/gameLog";
import {
  buildSnapshot,
  clearYMap,
  getMaps,
  isRecord,
  syncPlayerOrder,
} from "./domain/yjsStore";
import {
  parseConnectionParams,
} from "./connection/auth";
import {
  RoomAdmission,
  type ConnectionAuthWithResumeResult,
} from "./connection/roomAdmission";
import {
  createRoomIdFromSeed,
  DISCORD_INVITE_TTL_MS,
  DISCORD_REQUEST_ID_HEADER,
  DISCORD_SERVICE_AUTH_HEADER,
  logDiscordProvisionEvent,
  parseBearerToken,
  parseDiscordProvisionRequest,
  parseDiscordRoomProvisionPayload,
  parseDiscordRoomProvisionResponse,
  resolveDiscordRequestId,
  resolveDiscordServiceAuthSecret,
  resolveDrawspellWebOrigin,
  resolveErrorMessage,
} from "./discord/provisioning";
import { validatePartyHandshake } from "./http/partyHandshake";
import { OverlayService, type OverlayBuildResult } from "./overlay/service";
import { SnapshotStore, type SnapshotMeta } from "./storage/snapshotStore";
import { normalizeNonEmptyString } from "./strings";

const INTENT_ROLE = "intent";
const EMPTY_ROOM_IDLE_GRACE_MS = 120_000;
const EMPTY_ROOM_HARD_RESET_MS = 30 * 60_000;
const EMPTY_ROOM_TOTAL_RESET_MS =
  EMPTY_ROOM_IDLE_GRACE_MS + EMPTY_ROOM_HARD_RESET_MS;
const EMPTY_ROOM_PENDING_AUTH_RETRY_MS = 30_000;
const ROOM_TEARDOWN_CLOSE_CODE = 1013;
const PLAYER_TAKEOVER_CLOSE_CODE = 1008;
const PLAYER_TAKEOVER_CLOSE_REASON = "session moved to another device";
const RESUME_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const Y_DOC_STORAGE_KEY = "yjs:doc";
const SNAPSHOT_META_KEY = "snapshot:meta";
const SNAPSHOT_HIDDEN_PREFIX = "snapshot:hidden:";
const INTENT_LOG_META_KEY = "intent-log:meta";
const INTENT_LOG_PREFIX = "intent-log:";
const GAME_LOG_STORAGE_KEY = "game-log:v1";
const GAME_LOG_MAX_ENTRIES = 200;
const HIDDEN_STATE_CLEANUP_INTERVAL_MS = 10 * 60_000;
const SNAPSHOT_INTENT_THRESHOLD = 200;
const SNAPSHOT_TIME_THRESHOLD_MS = 30_000;
const INTENT_LOG_MAX_ENTRIES = 2000;
const PERF_METRICS_INTERVAL_MS = 30_000;
const PERF_METRICS_MIN_INTERVAL_MS = 5_000;
const PERF_METRICS_MAX_INTERVAL_MS = 300_000;
const PERF_METRICS_SAMPLE_LIMIT = 5000;
const ROOM_ADMIN_PROBE_PATH = "/admin/rooms/probe";
const ROOM_ADMIN_REPAIR_PATH = "/admin/rooms/repair";
const ROOM_ADMIN_INTERNAL_PROBE_PATH = "/__admin/rooms/probe";
const ROOM_ADMIN_INTERNAL_REPAIR_PATH = "/__admin/rooms/repair";
const ROOM_ADMIN_AUTH_HEADER = "x-drawspell-room-admin-auth";
const ROOM_STATUS_PATH = "/rooms/status";
const ROOM_STATUS_INTERNAL_PATH = "/__room/status";
const ROOM_ACCESS_TOKEN_HEADER = "x-drawspell-room-access-token";
const OVERLAY_DIFF_CAPABILITY = "overlay-diff-v1";
const PERF_METRICS_ENABLED = false;
const PERF_METRICS_ALLOW_PARAM = false;
const HANDOFF_DEBUG_LOGS_ENABLED = false;
const ROUTINE_CONNECTION_LOGS_ENABLED = false;
const CONNECT_RATE_WINDOW_MS = 60_000;
const CONNECT_RATE_MAX_ATTEMPTS = 20;
const CONNECT_RATE_BLOCK_MS = 120_000;
const CONNECT_RATE_PAIR_WINDOW_MS = 5_000;
const CONNECT_RATE_CHANNEL_SYNC = 1;
const CONNECT_RATE_CHANNEL_INTENT = 1 << 1;

type ConnectionRateEntry = {
  windowStart: number;
  attempts: number;
  blockedUntil: number;
  lastSeen: number;
  recentAttempts: Map<
    string,
    {
      seenAt: number;
      channels: number;
    }
  >;
};

type ShareLinksPayload = {
  playerInviteUrl: string;
  spectatorInviteUrl: string;
  resumeInviteUrl?: string;
};

type RoomAdminEnv = Env & {
  ROOM_ADMIN_TOKEN?: string;
};

type RoomAdminRequestPayload = {
  objectId: string;
};

type RoomAdminClassification =
  | "active"
  | "scheduled-empty"
  | "legacy-empty-candidate"
  | "empty";

type RoomAdminStorageSummary = {
  totalKeys: number;
  keyPrefixes: Record<string, number>;
  hasRoomTokens: boolean;
  hasYDoc: boolean;
  hasSnapshot: boolean;
  hasHiddenState: boolean;
  hasGameLog: boolean;
  hasIntentLog: boolean;
};

type RoomAdminProbeResult = {
  roomId: string;
  classification: RoomAdminClassification;
  activePlayerConnections: number;
  activeSpectatorConnections: number;
  pendingPlayerConnections: number;
  emptyRoomStartedAt: number | null;
  alarm: number | null;
  storage: RoomAdminStorageSummary;
};

type RoomAdminRepairResult = {
  repaired: boolean;
  reason:
    | "scheduled"
    | "room-active"
    | "already-scheduled"
    | "empty-room";
  before: RoomAdminProbeResult;
  after: RoomAdminProbeResult;
};

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const sampleMetric = (target: number[], value: number) => {
  if (!Number.isFinite(value)) return;
  if (target.length >= PERF_METRICS_SAMPLE_LIMIT) {
    target.shift();
  }
  target.push(value);
};

const resolveRoomAdminToken = (env: Env): string | null =>
  normalizeNonEmptyString((env as RoomAdminEnv).ROOM_ADMIN_TOKEN);

const parseRoomAdminPayload = (value: unknown): RoomAdminRequestPayload | null => {
  if (!value || typeof value !== "object") return null;
  const objectId = normalizeNonEmptyString(
    (value as { objectId?: unknown }).objectId,
  );
  if (!objectId) return null;
  return { objectId };
};

const computeMetricStats = (samples: number[]) => {
  if (!samples.length) {
    return { avg: 0, p95: 0, count: 0 };
  }
  const count = samples.length;
  let sum = 0;
  for (const value of samples) {
    sum += value;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * 0.95)),
  );
  const p95 = sorted[index] ?? sorted[sorted.length - 1] ?? 0;
  return { avg: sum / count, p95, count };
};

const summarizeSecretToken = (value: string | undefined): {
  length: number;
  suffix: string;
} | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return {
    length: trimmed.length,
    suffix: trimmed.length > 6 ? trimmed.slice(-6) : trimmed,
  };
};

type IntentLogMeta = {
  nextIndex: number;
  logStartIndex: number;
  snapshotIndex: number;
  lastSnapshotAt: number;
};

type IntentLogEntry = {
  index: number;
  ts: number;
  intent: Intent;
};

export { applyIntentToDoc } from "./domain/intents/applyIntentToDoc";
export { buildOverlayForViewer } from "./domain/overlay";
export { createEmptyHiddenState } from "./domain/hiddenState";

const isNetworkConnectionLost = (error: unknown) => {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : "";
  return (
    message.trim().replace(/\.$/, "").toLowerCase() ===
    "network connection lost"
  );
};

const handleDiscordRoomProvisioningRequest = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  const requestId = resolveDiscordRequestId(request);
  logDiscordProvisionEvent("request_received", {
    requestId,
    path: new URL(request.url).pathname,
    method: request.method,
    hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
  });
  const serviceSecret = resolveDiscordServiceAuthSecret(env);
  if (!serviceSecret) {
    logDiscordProvisionEvent("missing_service_secret", { requestId });
    return new Response("Discord service auth is not configured", {
      status: 500,
    });
  }
  const webOrigin = resolveDrawspellWebOrigin(env);
  if (!webOrigin) {
    logDiscordProvisionEvent("invalid_web_origin", { requestId });
    return new Response("Drawspell web origin is not configured", {
      status: 500,
    });
  }
  const authHeader = parseBearerToken(request.headers.get("authorization"));
  if (!authHeader || authHeader !== serviceSecret) {
    logDiscordProvisionEvent("unauthorized", {
      requestId,
      hasAuthHeader: Boolean(authHeader),
    });
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.rooms) {
    logDiscordProvisionEvent("rooms_namespace_unavailable", { requestId });
    return new Response("Room namespace unavailable", { status: 500 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_err) {
    logDiscordProvisionEvent("invalid_json_body", { requestId });
    return new Response("Invalid JSON body", { status: 400 });
  }
  const parsedBody = parseDiscordProvisionRequest(rawBody);
  if (!parsedBody) {
    logDiscordProvisionEvent("invalid_request_body", { requestId });
    return new Response("Invalid request body", { status: 400 });
  }

  const roomId = await createRoomIdFromSeed(parsedBody.interactionId);
  logDiscordProvisionEvent("request_validated", {
    requestId,
    interactionId: parsedBody.interactionId,
    roomId,
    participants: parsedBody.participantDiscordUserIds.length,
    guildId: parsedBody.guildId,
    channelId: parsedBody.channelId,
  });
  const inviteExpiresAt = Date.now() + DISCORD_INVITE_TTL_MS;
  const roomPayload: DiscordRoomInternalProvisionPayload = {
    ...parsedBody,
    inviteExpiresAt,
  };
  const roomRequest = new Request(
    `https://internal${DISCORD_ROOM_PROVISION_PATH}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-partykit-room": roomId,
        [DISCORD_SERVICE_AUTH_HEADER]: serviceSecret,
        [DISCORD_REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify(roomPayload),
    },
  );
  const roomStub = env.rooms.get(env.rooms.idFromName(roomId));
  let roomResponse: Response;
  try {
    roomResponse = await roomStub.fetch(roomRequest);
  } catch (error) {
    console.error("[discord-provision] room provision request error", {
      requestId,
      roomId,
      message: resolveErrorMessage(error),
    });
    return new Response("Failed to provision room invite", { status: 502 });
  }
  if (!roomResponse.ok) {
    const message = await roomResponse.text();
    console.error("[discord-provision] room provision request failed", {
      requestId,
      roomId,
      status: roomResponse.status,
      message,
    });
    return new Response("Failed to provision room invite", { status: 502 });
  }

  let roomResult: unknown;
  try {
    roomResult = await roomResponse.json();
  } catch (_err) {
    logDiscordProvisionEvent("room_response_invalid_json", {
      requestId,
      roomId,
    });
    return new Response("Invalid room provision response", { status: 502 });
  }
  const parsedResult = parseDiscordRoomProvisionResponse(roomResult);
  if (!parsedResult || parsedResult.roomId !== roomId) {
    logDiscordProvisionEvent("room_response_invalid_shape", {
      requestId,
      roomId,
    });
    return new Response("Invalid room provision response", { status: 502 });
  }
  logDiscordProvisionEvent("request_succeeded", {
    requestId,
    roomId: parsedResult.roomId,
    alreadyProvisioned: parsedResult.alreadyProvisioned,
    expiresAt: parsedResult.expiresAt,
  });
  const playerInviteUrl = `${webOrigin}/rooms/${parsedResult.roomId}?gt=${parsedResult.playerToken}`;
  return Response.json({
    roomId: parsedResult.roomId,
    playerToken: parsedResult.playerToken,
    playerInviteUrl,
    expiresAt: parsedResult.expiresAt,
    alreadyProvisioned: parsedResult.alreadyProvisioned,
  });
};

const handleRoomAdminProxyRequest = async (
  request: Request,
  env: Env,
  internalPath: typeof ROOM_ADMIN_INTERNAL_PROBE_PATH | typeof ROOM_ADMIN_INTERNAL_REPAIR_PATH,
): Promise<Response> => {
  const adminToken = resolveRoomAdminToken(env);
  if (!adminToken) {
    return new Response("Room admin is not configured", { status: 500 });
  }
  const authHeader = parseBearerToken(request.headers.get("authorization"));
  if (!authHeader || authHeader !== adminToken) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.rooms) {
    return new Response("Room namespace unavailable", { status: 500 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_err) {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const payload = parseRoomAdminPayload(rawBody);
  if (!payload) {
    return new Response("Invalid request body", { status: 400 });
  }

  let roomId: DurableObjectId;
  try {
    roomId = env.rooms.idFromString(payload.objectId);
  } catch (_err) {
    return new Response("Invalid room object id", { status: 400 });
  }

  const roomRequest = new Request(`https://internal${internalPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-partykit-namespace": "rooms",
      "x-partykit-room": payload.objectId,
      [ROOM_ADMIN_AUTH_HEADER]: adminToken,
    },
  });

  try {
    return await env.rooms.get(roomId).fetch(roomRequest);
  } catch (error) {
    console.error("[room-admin] room request failed", {
      objectId: payload.objectId,
      path: internalPath,
      message: resolveErrorMessage(error),
    });
    return new Response("Room admin request failed", { status: 502 });
  }
};

const handleRoomStatusRequest = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!env.rooms) {
    return new Response("Rooms namespace unavailable", { status: 503 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_err) {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!rawBody || typeof rawBody !== "object") {
    return new Response("Invalid request body", { status: 400 });
  }
  const body = rawBody as Record<string, unknown>;
  const roomId = normalizeNonEmptyString(body.roomId);
  const accessToken = normalizeNonEmptyString(body.accessToken);
  if (!roomId || roomId.length > 128 || !accessToken) {
    return new Response("Invalid request body", { status: 400 });
  }

  const roomRequest = new Request(`https://internal${ROOM_STATUS_INTERNAL_PATH}`, {
    method: "POST",
    headers: {
      "x-partykit-namespace": "rooms",
      "x-partykit-room": roomId,
      [ROOM_ACCESS_TOKEN_HEADER]: accessToken,
    },
  });
  try {
    return await env.rooms.get(env.rooms.idFromName(roomId)).fetch(roomRequest);
  } catch (_err) {
    return new Response("Room status unavailable", { status: 503 });
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname === ROOM_ADMIN_PROBE_PATH) {
        if (request.method !== "POST") {
          return new Response("Method not allowed", { status: 405 });
        }
        return handleRoomAdminProxyRequest(
          request,
          env,
          ROOM_ADMIN_INTERNAL_PROBE_PATH,
        );
      }
      if (url.pathname === ROOM_ADMIN_REPAIR_PATH) {
        if (request.method !== "POST") {
          return new Response("Method not allowed", { status: 405 });
        }
        return handleRoomAdminProxyRequest(
          request,
          env,
          ROOM_ADMIN_INTERNAL_REPAIR_PATH,
        );
      }
      if (url.pathname === ROOM_STATUS_PATH) {
        return handleRoomStatusRequest(request, env);
      }
      if (url.pathname === DISCORD_ROOM_PROVISION_PATH) {
        if (request.method !== "POST") {
          return new Response("Method not allowed", { status: 405 });
        }

        return handleDiscordRoomProvisioningRequest(request, env);
      }
      const isWsUpgrade =
        request.headers.get("Upgrade")?.toLowerCase() === "websocket";
      if (isWsUpgrade) {
        const rejection = await validatePartyHandshake(request, env, url);
        if (rejection) return rejection;
      }
      return (
        (await routePartykitRequest(request, env)) ??
        new Response("Not Found", { status: 404 })
      );
    } catch (error) {
      const isWsUpgrade =
        request.headers.get("Upgrade")?.toLowerCase() === "websocket";
      if (isWsUpgrade && isNetworkConnectionLost(error)) {
        return new Response("Client Closed", { status: 499 });
      }
      console.error("[fetch] error", {
        url: request.url,
        isWsUpgrade,
        message: resolveErrorMessage(error),
      });
      throw error;
    }
  },
};

export class Room extends YServer<Env> {
  static options = { hibernate: true };

  private intentConnections = new Set<Connection>();
  private hiddenState: HiddenState | null = null;
  private admission = new RoomAdmission({
    storage: this.ctx.storage,
    resumeTokenTtlMs: RESUME_TOKEN_TTL_MS,
    onDiscordInviteActivationError: (error) => {
      console.error("[party] failed to activate discord invite", {
        room: this.name,
        error: resolveErrorMessage(error),
      });
    },
  });
  private libraryViews = new Map<
    string,
    { playerId: string; count?: number; lastPingAt: number }
  >();
  private overlayService = new OverlayService({
    roomId: "pending",
    sampleLimit: PERF_METRICS_SAMPLE_LIMIT,
  });

  private snapshotStore = new SnapshotStore({
    storage: this.ctx.storage,
    yDocStorageKey: Y_DOC_STORAGE_KEY,
    snapshotMetaKey: SNAPSHOT_META_KEY,
    snapshotHiddenPrefix: SNAPSHOT_HIDDEN_PREFIX,
  });
  private connectionCapabilities = new Map<string, Set<string>>();
  private connectionRoles = new Map<Connection, "player" | "spectator">();
  private connectionPlayers = new Map<Connection, string>();
  private connectionGroups = new Map<Connection, string>();
  private closedConnections = new WeakSet<Connection>();
  private pendingCloseHandlers = new WeakMap<Connection, () => void>();
  private roomAnalytics: RoomAnalyticsTracker | null = null;
  private pendingPlayerConnections = 0;
  private emptyRoomStartedAt: number | null = null;
  private emptyRoomDormantAt: number | null = null;
  private teardownGeneration = 0;
  private resetGeneration = 0;
  private teardownInProgress = false;
  private hiddenStatePersistInFlight: Promise<void> | null = null;
  private hiddenStatePersistQueued: {
    resetGeneration: number;
    connId?: string | null;
  } | null = null;
  private hiddenStateLastChangeAt = 0;
  private lastHiddenStatePersistAt = 0;
  private intentLogMeta: IntentLogMeta | null = null;
  private snapshotMeta: SnapshotMeta | null = null;
  private intentLogWritePromise: Promise<void> = Promise.resolve();
  private intentLogWritePending = false;
  private gameLog = new GameLogBuffer(GAME_LOG_MAX_ENTRIES);
  private gameLogRestored = false;
  private gameLogRestoreInFlight: Promise<void> | null = null;
  private gameLogPersistInFlight: Promise<void> | null = null;
  private gameLogPersistQueued = false;
  private snapshotBarrier: Promise<void> | null = null;
  private snapshotBarrierResolve: (() => void) | null = null;
  private inflightIntentCount = 0;
  private inflightIntentIdle: Promise<void> | null = null;
  private inflightIntentIdleResolve: (() => void) | null = null;
  private lastHiddenStateCleanupAt = 0;
  private lastPerfMetricsAt = 0;
  private perfMetricsEnabledFlag = false;
  private perfMetricsIntervalMs = PERF_METRICS_INTERVAL_MS;
  private yjsMetricsListenerAttached = false;
  private intentApplySamples: number[] = [];
  private intentCountSinceMetrics = 0;
  private lastIntentMetricsAt = 0;
  private yjsUpdateBytes = 0;
  private yjsUpdateCount = 0;
  private connectionRate = new Map<string, ConnectionRateEntry>();
  private lastConnectionRateCleanupAt = 0;

  get roomTokens() {
    return this.admission.roomTokensSnapshot;
  }

  set roomTokens(tokens: RoomTokens | null) {
    this.admission.roomTokensSnapshot = tokens;
  }

  get playerResumeTokens() {
    return this.admission.playerResumeTokensSnapshot;
  }

  async onStart() {
    this.overlayService = new OverlayService({
      roomId: this.name,
      sampleLimit: PERF_METRICS_SAMPLE_LIMIT,
    });
    const waitUntil =
      typeof this.ctx.waitUntil === "function"
        ? this.ctx.waitUntil.bind(this.ctx)
        : (_promise: Promise<unknown>) => {};
    this.roomAnalytics = new RoomAnalyticsTracker({
      env: this.env,
      waitUntil,
    });
    await super.onStart();
  }

  async onLoad() {
    this.ensureYjsMetricsListener();
    if (await this.restoreEmptyRoomLifecycle()) {
      return;
    }
    await this.restoreFromSnapshotAndLog();
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === ROOM_STATUS_INTERNAL_PATH) {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      const accessToken = normalizeNonEmptyString(
        request.headers.get(ROOM_ACCESS_TOKEN_HEADER),
      );
      const tokens = accessToken ? await this.admission.loadRoomTokens() : null;
      const exists = Boolean(
        accessToken &&
          tokens &&
          (accessToken === tokens.playerToken ||
            accessToken === tokens.spectatorToken),
      );
      return Response.json({ exists });
    }
    if (url.pathname === ROOM_ADMIN_INTERNAL_PROBE_PATH) {
      return this.handleRoomAdminRequest(request, "probe");
    }
    if (url.pathname === ROOM_ADMIN_INTERNAL_REPAIR_PATH) {
      return this.handleRoomAdminRequest(request, "repair");
    }
    if (url.pathname !== DISCORD_ROOM_PROVISION_PATH) {
      return new Response("Not Found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const requestId = resolveDiscordRequestId(request);
    logDiscordProvisionEvent("room_request_received", {
      requestId,
      roomId: this.name,
    });

    const serviceSecret = resolveDiscordServiceAuthSecret(this.env);
    if (!serviceSecret) {
      logDiscordProvisionEvent("room_missing_service_secret", {
        requestId,
        roomId: this.name,
      });
      return new Response("Discord service auth is not configured", {
        status: 500,
      });
    }
    const providedSecret = normalizeNonEmptyString(
      request.headers.get(DISCORD_SERVICE_AUTH_HEADER),
    );
    if (!providedSecret || providedSecret !== serviceSecret) {
      logDiscordProvisionEvent("room_unauthorized", {
        requestId,
        roomId: this.name,
      });
      return new Response("Unauthorized", { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (_err) {
      logDiscordProvisionEvent("room_invalid_json_body", {
        requestId,
        roomId: this.name,
      });
      return new Response("Invalid JSON body", { status: 400 });
    }
    const payload = parseDiscordRoomProvisionPayload(rawBody);
    if (!payload) {
      logDiscordProvisionEvent("room_invalid_request_body", {
        requestId,
        roomId: this.name,
      });
      return new Response("Invalid request body", { status: 400 });
    }

    const existingMetadataRaw = await this.ctx.storage.get<unknown>(
      DISCORD_INVITE_METADATA_KEY,
    );
    const existingMetadata = this.isDiscordRoomInviteMetadata(
      existingMetadataRaw,
    )
      ? existingMetadataRaw
      : null;
    const alreadyProvisioned =
      existingMetadata?.interactionId === payload.interactionId;
    const tokens = await this.ensureRoomTokens();
    if (!alreadyProvisioned) {
      const inviteMetadata: DiscordRoomInviteMetadata = {
        source: "discord",
        interactionId: payload.interactionId,
        inviteExpiresAt: payload.inviteExpiresAt,
        createdByDiscordUserId: payload.invokerDiscordUserId,
        participantDiscordUserIds: payload.participantDiscordUserIds,
        guildId: payload.guildId,
        channelId: payload.channelId,
      };
      await this.ctx.storage.put(DISCORD_INVITE_METADATA_KEY, inviteMetadata);
    }
    logDiscordProvisionEvent("room_request_succeeded", {
      requestId,
      roomId: this.name,
      interactionId: payload.interactionId,
      participants: payload.participantDiscordUserIds.length,
      alreadyProvisioned,
    });

    return Response.json({
      roomId: this.name,
      playerToken: tokens.playerToken,
      expiresAt: alreadyProvisioned
        ? (existingMetadata?.inviteExpiresAt ?? payload.inviteExpiresAt)
        : payload.inviteExpiresAt,
      alreadyProvisioned,
    } satisfies DiscordRoomInternalProvisionResponse);
  }

  private async handleRoomAdminRequest(
    request: Request,
    action: "probe" | "repair",
  ): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const adminToken = resolveRoomAdminToken(this.env);
    if (!adminToken) {
      return new Response("Room admin is not configured", { status: 500 });
    }
    const providedToken = normalizeNonEmptyString(
      request.headers.get(ROOM_ADMIN_AUTH_HEADER),
    );
    if (!providedToken || providedToken !== adminToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (action === "probe") {
      return Response.json(await this.buildRoomAdminProbe());
    }
    return Response.json(await this.repairLegacyEmptyRoom());
  }

  private async repairLegacyEmptyRoom(): Promise<RoomAdminRepairResult> {
    const before = await this.buildRoomAdminProbe();
    if (before.classification === "active") {
      return {
        repaired: false,
        reason: "room-active",
        before,
        after: before,
      };
    }
    if (before.classification === "scheduled-empty") {
      return {
        repaired: false,
        reason: "already-scheduled",
        before,
        after: before,
      };
    }
    if (before.classification === "empty") {
      return {
        repaired: false,
        reason: "empty-room",
        before,
        after: before,
      };
    }

    const startedAt = Date.now();
    this.emptyRoomStartedAt = startedAt;
    this.emptyRoomDormantAt = null;
    await this.ctx.storage.put(EMPTY_ROOM_STARTED_AT_KEY, startedAt);
    await this.setEmptyRoomAlarm(this.getEmptyRoomTeardownAt(startedAt));
    this.scheduleEmptyRoomTeardown();

    return {
      repaired: true,
      reason: "scheduled",
      before,
      after: await this.buildRoomAdminProbe(),
    };
  }

  private async buildRoomAdminProbe(): Promise<RoomAdminProbeResult> {
    const storage = await this.buildRoomAdminStorageSummary();
    const storedStartedAt = this.normalizeEmptyRoomStartedAt(
      await this.ctx.storage.get<unknown>(EMPTY_ROOM_STARTED_AT_KEY),
    );
    const emptyRoomStartedAt = storedStartedAt ?? this.emptyRoomStartedAt;
    const activePlayerConnections = this.countConnectionsByRole("player");
    const activeSpectatorConnections = this.countConnectionsByRole("spectator");
    const hasMeaningfulStorage =
      storage.hasRoomTokens ||
      storage.hasYDoc ||
      storage.hasSnapshot ||
      storage.hasHiddenState ||
      storage.hasGameLog ||
      storage.hasIntentLog;
    const classification: RoomAdminClassification =
      activePlayerConnections > 0 || this.pendingPlayerConnections > 0
        ? "active"
        : emptyRoomStartedAt !== null
          ? "scheduled-empty"
          : hasMeaningfulStorage
            ? "legacy-empty-candidate"
            : "empty";

    return {
      roomId: this.name,
      classification,
      activePlayerConnections,
      activeSpectatorConnections,
      pendingPlayerConnections: this.pendingPlayerConnections,
      emptyRoomStartedAt,
      alarm: await this.getEmptyRoomAlarm(),
      storage,
    };
  }

  private countConnectionsByRole(role: "player" | "spectator") {
    const connectionIds = new Set<string>();
    for (const [connection, connectionRole] of this.connectionRoles.entries()) {
      if (connectionRole === role) connectionIds.add(connection.id);
    }
    try {
      for (const connection of this.getConnections()) {
        const state = (connection.state ?? {}) as IntentConnectionState;
        if (state.viewerRole === role) connectionIds.add(connection.id);
      }
    } catch (_err) {}
    return connectionIds.size;
  }

  private async buildRoomAdminStorageSummary(): Promise<RoomAdminStorageSummary> {
    const keys = await this.listRoomStorageKeys();
    const keyPrefixes: Record<string, number> = {};
    for (const key of keys) {
      const separatorIndex = key.indexOf(":");
      const prefix =
        separatorIndex === -1 ? key : `${key.slice(0, separatorIndex)}:`;
      keyPrefixes[prefix] = (keyPrefixes[prefix] ?? 0) + 1;
    }

    return {
      totalKeys: keys.length,
      keyPrefixes,
      hasRoomTokens: keys.includes(ROOM_TOKENS_KEY),
      hasYDoc: keys.includes(Y_DOC_STORAGE_KEY),
      hasSnapshot:
        keys.includes(SNAPSHOT_META_KEY) ||
        keys.some((key) => key.startsWith(SNAPSHOT_HIDDEN_PREFIX)),
      hasHiddenState:
        keys.includes(HIDDEN_STATE_KEY) ||
        keys.includes(HIDDEN_STATE_META_KEY) ||
        keys.some((key) => key.startsWith(HIDDEN_STATE_CARDS_PREFIX)),
      hasGameLog: keys.includes(GAME_LOG_STORAGE_KEY),
      hasIntentLog:
        keys.includes(INTENT_LOG_META_KEY) ||
        keys.some((key) => key.startsWith(INTENT_LOG_PREFIX)),
    };
  }

  private async listRoomStorageKeys(): Promise<string[]> {
    const storage = this.ctx.storage as unknown as {
      list?: () => Promise<
        Map<string, unknown> | Iterable<[string, unknown]> | string[]
      >;
    };
    if (typeof storage.list !== "function") return [];

    const listed = await storage.list();
    const keys: string[] = [];
    const recordKey = (key: unknown) => {
      if (typeof key === "string") keys.push(key);
    };
    if (Array.isArray(listed)) {
      listed.forEach(recordKey);
    } else if (listed instanceof Map) {
      listed.forEach((_value, key) => recordKey(key));
    } else if (Symbol.iterator in Object(listed)) {
      for (const entry of listed as Iterable<[string, unknown]>) {
        recordKey(entry?.[0]);
      }
    }
    return keys;
  }

  private ensureYjsMetricsListener() {
    if (this.yjsMetricsListenerAttached) return;
    this.yjsMetricsListenerAttached = true;
    this.document.on("update", (update: Uint8Array) => {
      const size = update?.byteLength ?? update?.length ?? 0;
      if (Number.isFinite(size)) {
        this.yjsUpdateBytes += size;
      }
      this.yjsUpdateCount += 1;
    });
  }

  private createSnapshotBarrier() {
    let resolve!: () => void;
    this.snapshotBarrier = new Promise<void>((res) => {
      resolve = res;
    });
    this.snapshotBarrierResolve = resolve;
    return () => {
      if (this.snapshotBarrierResolve) {
        this.snapshotBarrierResolve();
      }
      this.snapshotBarrier = null;
      this.snapshotBarrierResolve = null;
    };
  }

  private beginIntentHandling() {
    this.inflightIntentCount += 1;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.inflightIntentCount = Math.max(0, this.inflightIntentCount - 1);
      if (this.inflightIntentCount === 0 && this.inflightIntentIdleResolve) {
        this.inflightIntentIdleResolve();
        this.inflightIntentIdle = null;
        this.inflightIntentIdleResolve = null;
      }
    };
  }

  private async waitForIntentIdle() {
    if (this.inflightIntentCount === 0) return;
    if (!this.inflightIntentIdle) {
      this.inflightIntentIdle = new Promise<void>((resolve) => {
        this.inflightIntentIdleResolve = resolve;
      });
    }
    await this.inflightIntentIdle;
  }

  private async restoreFromSnapshotAndLog() {
    const snapshotMeta = await this.snapshotStore.loadCommittedMeta({
      room: this.name,
    });
    this.snapshotMeta = snapshotMeta ?? null;

    if (snapshotMeta) {
      const stored = await this.ctx.storage.get<ArrayBuffer>(Y_DOC_STORAGE_KEY);
      if (stored) {
        try {
          Y.applyUpdate(this.document, new Uint8Array(stored));
        } catch (err: any) {
          console.error("[party] failed to load yjs snapshot", {
            room: this.name,
            error: err?.message ?? String(err),
          });
        }
      }
      const hidden = await this.loadHiddenStateFromMeta(
        snapshotMeta.hiddenStateMeta,
      );
      if (hidden) {
        this.hiddenState = hidden;
      }
    } else {
      const stored = await this.ctx.storage.get<ArrayBuffer>(Y_DOC_STORAGE_KEY);
      if (stored) {
        try {
          Y.applyUpdate(this.document, new Uint8Array(stored));
        } catch (err: any) {
          console.error("[party] failed to load yjs state", {
            room: this.name,
            error: err?.message ?? String(err),
          });
        }
      }
    }
    const logMeta = await this.ensureIntentLogMeta(snapshotMeta ?? undefined);
    const replayStart = Math.max(
      logMeta.logStartIndex,
      (snapshotMeta?.lastIntentIndex ?? -1) + 1,
    );
    const replayEnd = logMeta.nextIndex - 1;
    if (replayEnd >= replayStart) {
      if (!this.hiddenState) {
        this.hiddenState = createEmptyHiddenState();
      }
      getMaps(this.document);
      for (let index = replayStart; index <= replayEnd; index += 1) {
        const entry = await this.ctx.storage.get<IntentLogEntry>(
          `${INTENT_LOG_PREFIX}${index}`,
        );
        if (!entry || !entry.intent) continue;
        const result = applyIntentToDoc(
          this.document,
          entry.intent,
          this.hiddenState,
        );
        if (!result.ok) {
          console.warn("[party] intent replay failed", {
            room: this.name,
            intentIndex: index,
            error: result.error,
          });
        }
      }
    }
    if (!this.hiddenState) {
      this.hiddenState = await this.loadPersistedHiddenState();
    }

    if (this.hiddenState) {
      this.document.transact(() => {
        syncPublicRevealsToAllFromHiddenState(
          getMaps(this.document),
          this.hiddenState as HiddenState,
        );
      });
      const now = Date.now();
      this.lastHiddenStatePersistAt = now;
      this.hiddenStateLastChangeAt = now;
    }
  }

  private async loadHiddenStateFromMeta(meta?: HiddenStateMeta | null) {
    if (!meta) return null;
    const cards: Record<string, Card> = {};
    const chunkKeys = Array.isArray(meta.cardChunkKeys)
      ? meta.cardChunkKeys
      : [];
    for (const key of chunkKeys) {
      const chunk = await this.ctx.storage.get<Record<string, Card>>(key);
      if (chunk && isRecord(chunk)) {
        Object.assign(cards, chunk as Record<string, Card>);
      }
    }
    const { cardChunkKeys: _keys, ...rest } = meta;
    return normalizeHiddenState({ ...rest, cards });
  }

  private async loadPersistedHiddenState() {
    const storedMeta = await this.ctx.storage.get<HiddenStateMeta>(
      HIDDEN_STATE_META_KEY,
    );
    if (storedMeta) {
      return this.loadHiddenStateFromMeta(storedMeta);
    }
    const stored = await this.ctx.storage.get<HiddenState>(HIDDEN_STATE_KEY);
    return stored ? normalizeHiddenState(stored) : null;
  }

  private async ensureIntentLogMeta(
    snapshotMeta?: SnapshotMeta,
  ): Promise<IntentLogMeta> {
    if (this.intentLogMeta) return this.intentLogMeta;
    const stored =
      await this.ctx.storage.get<IntentLogMeta>(INTENT_LOG_META_KEY);
    const snapshotIndex =
      snapshotMeta?.lastIntentIndex ?? stored?.snapshotIndex ?? -1;
    const now = Date.now();
    const createdAt = snapshotMeta?.createdAt ?? stored?.lastSnapshotAt ?? now;
    const base: IntentLogMeta = stored ?? {
      nextIndex: snapshotIndex + 1,
      logStartIndex: snapshotIndex + 1,
      snapshotIndex,
      lastSnapshotAt: createdAt || now,
    };

    if (base.nextIndex < base.logStartIndex) {
      base.nextIndex = base.logStartIndex;
    }
    if (base.logStartIndex < 0) base.logStartIndex = 0;
    if (base.snapshotIndex < -1) base.snapshotIndex = -1;
    if (base.lastSnapshotAt < 0) base.lastSnapshotAt = 0;
    if (snapshotIndex > base.snapshotIndex) {
      base.snapshotIndex = snapshotIndex;
      base.logStartIndex = Math.max(base.logStartIndex, snapshotIndex + 1);
      base.lastSnapshotAt = createdAt || base.lastSnapshotAt;
      if (base.nextIndex < base.logStartIndex) {
        base.nextIndex = base.logStartIndex;
      }
    }

    this.intentLogMeta = base;
    try {
      await this.ctx.storage.put(INTENT_LOG_META_KEY, base);
    } catch (_err) {}
    return base;
  }

  async onSave() {
    if (this.isHiddenStateDirty()) {
      this.enqueueHiddenStatePersist(this.resetGeneration);
      if (this.hiddenStatePersistInFlight) {
        await this.hiddenStatePersistInFlight;
      }
    }
    await this.flushGameLogPersist();
  }

  async alarm() {
    await this.handleEmptyRoomAlarm();
  }

  private async restoreGameLog() {
    try {
      const stored = await this.ctx.storage.get<unknown>(GAME_LOG_STORAGE_KEY);
      this.gameLog.restore(stored);
    } catch (err) {
      console.error("[party] failed to restore game log", {
        room: this.name,
        error: resolveErrorMessage(err),
      });
    }
  }

  private async ensureGameLogRestored() {
    if (this.gameLogRestored) return;
    if (!this.gameLogRestoreInFlight) {
      this.gameLogRestoreInFlight = this.restoreGameLog().finally(() => {
        this.gameLogRestored = true;
        this.gameLogRestoreInFlight = null;
      });
    }
    await this.gameLogRestoreInFlight;
  }

  private scheduleGameLogPersist() {
    if (this.teardownInProgress) return;
    this.gameLogPersistQueued = true;
    this.runBackground(this.flushGameLogPersist());
  }

  private async flushGameLogPersist() {
    if (!this.gameLogPersistQueued && !this.gameLogPersistInFlight) return;
    if (this.gameLogPersistInFlight) {
      await this.gameLogPersistInFlight;
      if (!this.gameLogPersistQueued) return;
    }
    this.gameLogPersistQueued = false;
    const snapshot = this.gameLog.snapshot();
    const persistPromise = this.ctx.storage
      .put(GAME_LOG_STORAGE_KEY, snapshot)
      .catch((err) => {
        this.gameLogPersistQueued = true;
        console.error("[party] failed to persist game log", {
          room: this.name,
          error: resolveErrorMessage(err),
        });
      })
      .finally(() => {
        if (this.gameLogPersistInFlight === persistPromise) {
          this.gameLogPersistInFlight = null;
        }
      });
    this.gameLogPersistInFlight = persistPromise;
    await persistPromise;
  }

  onMessage(conn: Connection, message: WSMessage) {
    const state = (conn.state ?? {}) as IntentConnectionState;
    if (state.channel === "intent" || this.intentConnections.has(conn)) {
      this.intentConnections.add(conn);
      return this.handleIntentSocketMessage(conn, message);
    }
    return super.onMessage(conn, message);
  }

  private async handleIntentSocketMessage(conn: Connection, raw: WSMessage) {
    if (typeof raw !== "string") return;

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (_err) {
      return;
    }

    if (!parsed || typeof parsed.type !== "string") return;
    if (parsed.type === "hello") {
      this.handleHelloMessage(conn, parsed.payload);
      return;
    }
    if (parsed.type === "overlayResync") {
      await this.handleOverlayResync(conn, parsed.payload);
      return;
    }
    if (parsed.type === "shareLinksRequest") {
      await this.handleShareLinksRequest(conn, parsed.requestId);
      return;
    }
    if (parsed.type === "gameLogRequest") {
      await this.handleGameLogRequest(conn, parsed);
      return;
    }
    if (parsed.type !== "intent") return;
    const intent = parsed.intent as Intent | undefined;
    if (!intent || typeof intent.id !== "string") return;
    if (intent.type === "library.view.ping") {
      const ok = this.handleLibraryViewPingIntent(conn, intent);
      this.sendIntentAck(conn, intent.id, ok);
      return;
    }

    await this.handleIntent(conn, intent);
  }

  onClose(
    conn: Connection,
    code: number,
    reason: string,
    wasClean: boolean,
  ) {
    this.markConnectionClosed(conn);
    const handledPendingClose = this.runPendingCloseHandler(conn);
    const state = (conn.state ?? {}) as IntentConnectionState;
    if (state.channel === "intent" || this.intentConnections.has(conn)) {
      this.cleanupIntentConnection(conn);
      this.unregisterConnection(conn);
      const analyticsUserId =
        state.userId ??
        (state.viewerRole === "player" && state.playerId
          ? `player:${state.playerId}`
          : undefined);
      if (analyticsUserId) {
        this.roomAnalytics?.onUserLeave(analyticsUserId);
      }
      if (!wasClean || code !== 1000) {
        console.warn("[party] intent connection closed", {
          room: this.name,
          connId: conn.id,
          playerId: state.playerId,
          viewerRole: state.viewerRole,
          code,
          wasClean,
        });
      }
      return;
    }

    if (state.channel === "sync" || this.connectionRoles.has(conn)) {
      if (!handledPendingClose) {
        this.unregisterConnection(conn);
      }
    }
    return super.onClose(conn, code, reason, wasClean);
  }

  private markConnectionClosed(conn: Connection) {
    this.closedConnections.add(conn);
  }

  private isConnectionClosed(conn: Connection) {
    return this.closedConnections.has(conn);
  }

  private logHandoffDebug(
    event: string,
    buildDetails: () => Record<string, unknown>,
  ) {
    if (!HANDOFF_DEBUG_LOGS_ENABLED) return;
    console.info(`[handoff-debug] ${event}`, buildDetails());
  }

  private logRoutineConnection(
    event: string,
    buildDetails: () => Record<string, unknown>,
  ) {
    if (!ROUTINE_CONNECTION_LOGS_ENABLED) return;
    console.info(event, buildDetails());
  }

  private registerPendingCloseHandler(conn: Connection, handler: () => void) {
    this.pendingCloseHandlers.set(conn, handler);
  }

  private clearPendingCloseHandler(conn: Connection) {
    this.pendingCloseHandlers.delete(conn);
  }

  private runPendingCloseHandler(conn: Connection) {
    const handler = this.pendingCloseHandlers.get(conn);
    if (!handler) return false;
    this.pendingCloseHandlers.delete(conn);
    handler();
    return true;
  }

  private cleanupIntentConnection(conn: Connection) {
    this.intentConnections.delete(conn);
    this.connectionCapabilities.delete(conn.id);
    this.libraryViews.delete(conn.id);
    this.overlayService.removeConnection(conn.id);
  }

  private runBackground(promise: Promise<unknown>) {
    const waitUntil = (
      this.ctx as { waitUntil?: (promise: Promise<unknown>) => void }
    ).waitUntil;
    if (typeof waitUntil === "function") {
      waitUntil.call(this.ctx, promise);
    }
  }

  private sendIntentAck(
    conn: Connection,
    intentId: string,
    success: boolean,
    message?: string,
  ) {
    const ack = {
      type: "ack",
      intentId,
      ok: success,
      ...(message ? { error: message } : null),
    };
    try {
      conn.send(JSON.stringify(ack));
    } catch (_err) {}
  }

  private getIntentConnectionsSnapshot(): Connection[] {
    const byId = new Map<string, Connection>();
    for (const connection of this.intentConnections) {
      byId.set(connection.id, connection);
    }
    try {
      for (const connection of this.getConnections()) {
        const state = (connection.state ?? {}) as IntentConnectionState;
        if (state.channel !== "intent") continue;
        byId.set(connection.id, connection);
        this.intentConnections.add(connection);
      }
    } catch (_err) {}
    return [...byId.values()];
  }

  private getAllConnectionsSnapshot(): Connection[] {
    const byId = new Map<string, Connection>();
    for (const connection of this.connectionRoles.keys()) {
      byId.set(connection.id, connection);
    }
    for (const connection of this.intentConnections) {
      byId.set(connection.id, connection);
    }
    try {
      for (const connection of this.getConnections()) {
        byId.set(connection.id, connection);
      }
    } catch (_err) {}
    return [...byId.values()];
  }

  private getConnectionMetricsSnapshot() {
    const connections = this.getAllConnectionsSnapshot();
    let intentConnections = 0;
    for (const connection of connections) {
      const state = (connection.state ?? {}) as IntentConnectionState;
      if (state.channel === "intent" || this.intentConnections.has(connection)) {
        intentConnections += 1;
      }
    }
    return {
      connections: connections.length,
      intentConnections,
    };
  }

  private getPeerCountsSnapshot() {
    const peers = new Map<string, "player" | "spectator">();
    for (const connection of this.getAllConnectionsSnapshot()) {
      const state = (connection.state ?? {}) as IntentConnectionState;
      const role =
        state.viewerRole === "spectator" || state.viewerRole === "player"
          ? state.viewerRole
          : this.connectionRoles.get(connection);
      if (role !== "player" && role !== "spectator") continue;
      const key =
        normalizeNonEmptyString(state.playerId) ??
        normalizeNonEmptyString(this.connectionPlayers.get(connection)) ??
        normalizeNonEmptyString(state.userId) ??
        normalizeNonEmptyString(
          state.connectionGroupId ?? this.connectionGroups.get(connection),
        ) ??
        connection.id;
      const existing = peers.get(key);
      if (!existing || (existing === "spectator" && role === "player")) {
        peers.set(key, role);
      }
    }

    let players = 0;
    let spectators = 0;
    for (const role of peers.values()) {
      if (role === "spectator") spectators += 1;
      else players += 1;
    }
    return { total: peers.size, players, spectators };
  }

  private broadcastPeerCounts() {
    const payload = this.getPeerCountsSnapshot();
    const message = JSON.stringify({ type: "peerCounts", payload });
    for (const connection of this.getIntentConnectionsSnapshot()) {
      try {
        connection.send(message);
      } catch (_err) {}
    }
  }

  private getPlayerConnectionsSnapshot(): Array<{
    connection: Connection;
    playerId: string;
    connectionGroupId?: string;
    state: IntentConnectionState;
    isIntent: boolean;
  }> {
    const byId = new Map<
      string,
      {
        connection: Connection;
        playerId: string;
        connectionGroupId?: string;
        state: IntentConnectionState;
        isIntent: boolean;
      }
    >();

    const rememberConnection = (
      connection: Connection,
      playerId: string | undefined,
      state: IntentConnectionState,
    ) => {
      const normalizedPlayerId = normalizeNonEmptyString(playerId);
      if (!normalizedPlayerId) return;
      const connectionGroupId =
        normalizeNonEmptyString(
          this.connectionGroups.get(connection) ?? state.connectionGroupId,
        ) ?? undefined;
      const isIntent =
        state.channel === "intent" || this.intentConnections.has(connection);
      byId.set(connection.id, {
        connection,
        playerId: normalizedPlayerId,
        connectionGroupId,
        state,
        isIntent,
      });

      this.connectionPlayers.set(connection, normalizedPlayerId);
      if (connectionGroupId) {
        this.connectionGroups.set(connection, connectionGroupId);
      } else {
        this.connectionGroups.delete(connection);
      }
      if (state.viewerRole === "player" || state.viewerRole === "spectator") {
        this.connectionRoles.set(connection, state.viewerRole);
      }
      if (isIntent) {
        this.intentConnections.add(connection);
      }
    };

    for (const [connection, playerId] of this.connectionPlayers.entries()) {
      const state = (connection.state ?? {}) as IntentConnectionState;
      rememberConnection(connection, playerId, state);
    }

    try {
      for (const connection of this.getConnections()) {
        const state = (connection.state ?? {}) as IntentConnectionState;
        rememberConnection(connection, state.playerId, state);
      }
    } catch (_err) {}

    return [...byId.values()];
  }

  onError(conn: Connection, error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);
    const normalized = message.trim().replace(/\.$/, "").toLowerCase();
    if (normalized === "network connection lost") {
      return;
    }
    return super.onError(conn, error);
  }

  isReadOnly(): boolean {
    return true;
  }

  private async ensureHiddenState(doc: Y.Doc) {
    if (this.hiddenState) return this.hiddenState;
    if (this.snapshotMeta?.hiddenStateMeta) {
      const restored = await this.loadHiddenStateFromMeta(
        this.snapshotMeta.hiddenStateMeta,
      );
      if (restored) {
        this.hiddenState = restored;
        doc.transact(() => {
          syncPublicRevealsToAllFromHiddenState(getMaps(doc), this.hiddenState as HiddenState);
        });
        return this.hiddenState;
      }
    }
    const restored = await this.loadPersistedHiddenState();
    if (restored) {
      this.hiddenState = restored;
      doc.transact(() => {
        syncPublicRevealsToAllFromHiddenState(getMaps(doc), this.hiddenState as HiddenState);
      });
      return this.hiddenState;
    }
    let migrated: HiddenState | null = null;
    doc.transact(() => {
      migrated = migrateHiddenStateFromSnapshot(getMaps(doc));
    });
    this.hiddenState = migrated ?? createEmptyHiddenState();
    await this.persistHiddenState(undefined, undefined, {
      waitForIntentIdle: false,
    });
    return this.hiddenState;
  }

  private shouldPersistHiddenState(expectedResetGeneration?: number) {
    if (this.teardownInProgress) return false;
    if (
      typeof expectedResetGeneration === "number" &&
      expectedResetGeneration !== this.resetGeneration
    ) {
      return false;
    }
    return true;
  }

  private async persistHiddenState(
    expectedResetGeneration?: number,
    connId?: string | null,
    options: { waitForIntentIdle?: boolean } = {},
  ) {
    if (!this.hiddenState) return;
    if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
    if (this.snapshotBarrier) {
      await this.snapshotBarrier;
    }
    const releaseSnapshotBarrier = this.createSnapshotBarrier();
    try {
      if (options.waitForIntentIdle !== false && this.inflightIntentCount > 0) {
        await this.waitForIntentIdle();
      }
      if (this.intentLogWritePending) {
        await this.intentLogWritePromise;
      }
      if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;

      const previousSnapshot = this.snapshotMeta;
      const intentLogMeta = await this.ensureIntentLogMeta(
        this.snapshotMeta ?? undefined,
      );
      const lastIntentIndex = Math.max(
        intentLogMeta.snapshotIndex,
        intentLogMeta.nextIndex - 1,
      );
      const createdAt = Date.now();
      const snapshotMeta = await this.snapshotStore.writeSnapshot({
        doc: this.document,
        hiddenState: this.hiddenState,
        lastIntentIndex,
        createdAt,
        shouldAbort: () =>
          !this.shouldPersistHiddenState(expectedResetGeneration),
        logContext: { room: this.name, connId },
      });
      if (!snapshotMeta) return;

      if (!this.shouldPersistHiddenState(expectedResetGeneration)) {
        await this.snapshotStore.cleanupSnapshot(snapshotMeta);
        return;
      }
      this.snapshotMeta = snapshotMeta;

      if (!this.shouldPersistHiddenState(expectedResetGeneration)) {
        await this.snapshotStore.cleanupSnapshot(snapshotMeta);
        return;
      }
      const previousLogStart = intentLogMeta.logStartIndex;
      intentLogMeta.snapshotIndex = lastIntentIndex;
      intentLogMeta.lastSnapshotAt = createdAt;
      intentLogMeta.logStartIndex = Math.max(
        intentLogMeta.logStartIndex,
        lastIntentIndex + 1,
      );
      if (intentLogMeta.nextIndex < intentLogMeta.logStartIndex) {
        intentLogMeta.nextIndex = intentLogMeta.logStartIndex;
      }
      this.intentLogMeta = intentLogMeta;
      await this.ctx.storage.put(INTENT_LOG_META_KEY, intentLogMeta);

      if (intentLogMeta.logStartIndex > previousLogStart) {
        await this.pruneIntentLogEntries(
          previousLogStart,
          intentLogMeta.logStartIndex - 1,
          expectedResetGeneration,
        );
      }

      await this.cleanupPreviousSnapshot(
        previousSnapshot,
        expectedResetGeneration,
      );
      await this.cleanupLegacyHiddenStateStorage(expectedResetGeneration);
    } finally {
      releaseSnapshotBarrier();
    }
  }

  private async maybeCleanupHiddenStateChunks(
    meta: HiddenStateMeta,
    expectedResetGeneration?: number,
  ) {
    if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
    const now = Date.now();
    if (now - this.lastHiddenStateCleanupAt < HIDDEN_STATE_CLEANUP_INTERVAL_MS)
      return;
    this.lastHiddenStateCleanupAt = now;
    if (!Array.isArray(meta.cardChunkKeys)) return;

    const storage = this.ctx.storage as unknown as {
      list?: () => Promise<
        Map<string, unknown> | Iterable<[string, unknown]> | string[]
      >;
      delete?: (key: string) => Promise<void>;
    };
    if (
      typeof storage.list !== "function" ||
      typeof storage.delete !== "function"
    )
      return;

    let listed: Map<string, unknown> | Iterable<[string, unknown]> | string[];
    try {
      listed = await storage.list();
    } catch (_err) {
      return;
    }

    const allowed = new Set(meta.cardChunkKeys);
    const orphanKeys: string[] = [];
    const recordKey = (key: string) => {
      if (!key.startsWith(HIDDEN_STATE_CARDS_PREFIX)) return;
      if (allowed.has(key)) return;
      orphanKeys.push(key);
    };

    if (Array.isArray(listed)) {
      listed.forEach((key) => {
        if (typeof key === "string") recordKey(key);
      });
    } else if (listed instanceof Map) {
      listed.forEach((_value, key) => {
        if (typeof key === "string") recordKey(key);
      });
    } else if (Symbol.iterator in Object(listed)) {
      for (const entry of listed as Iterable<[string, unknown]>) {
        if (entry && typeof entry[0] === "string") recordKey(entry[0]);
      }
    }

    for (const key of orphanKeys) {
      if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
      try {
        await storage.delete(key);
      } catch (_err) {}
    }
  }

  private async pruneIntentLogEntries(
    startIndex: number,
    endIndex: number,
    expectedResetGeneration?: number,
  ) {
    if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
    if (endIndex < startIndex) return;
    for (let index = startIndex; index <= endIndex; index += 1) {
      if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
      try {
        await this.ctx.storage.delete(`${INTENT_LOG_PREFIX}${index}`);
      } catch (_err) {}
    }
  }

  private async cleanupPreviousSnapshot(
    previous: SnapshotMeta | null | undefined,
    expectedResetGeneration?: number,
  ) {
    if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
    if (!previous?.hiddenStateMeta?.cardChunkKeys?.length) return;
    for (const key of previous.hiddenStateMeta.cardChunkKeys) {
      if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
      try {
        await this.ctx.storage.delete(key);
      } catch (_err) {}
    }
  }

  private async cleanupLegacyHiddenStateStorage(
    expectedResetGeneration?: number,
  ) {
    if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
    let legacyMeta: HiddenStateMeta | null = null;
    try {
      legacyMeta =
        (await this.ctx.storage.get<HiddenStateMeta>(HIDDEN_STATE_META_KEY)) ??
        null;
    } catch (_err) {
      legacyMeta = null;
    }
    if (legacyMeta?.cardChunkKeys?.length) {
      for (const key of legacyMeta.cardChunkKeys) {
        if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
        try {
          await this.ctx.storage.delete(key);
        } catch (_err) {}
      }
      await this.maybeCleanupHiddenStateChunks(
        legacyMeta,
        expectedResetGeneration,
      );
    }
    if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
    try {
      await this.ctx.storage.delete(HIDDEN_STATE_META_KEY);
    } catch (_err) {}
    if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
    try {
      await this.ctx.storage.delete(HIDDEN_STATE_KEY);
    } catch (_err) {}
  }

  private async loadRoomTokens(): Promise<RoomTokens | null> {
    return this.admission.loadRoomTokens();
  }

  private async ensureRoomTokens(): Promise<RoomTokens> {
    return this.admission.ensureRoomTokens();
  }

  private isDiscordRoomInviteMetadata(
    value: unknown,
  ): value is DiscordRoomInviteMetadata {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
      record.source === "discord" &&
      typeof record.interactionId === "string" &&
      record.interactionId.trim().length > 0 &&
      typeof record.inviteExpiresAt === "number" &&
      Number.isFinite(record.inviteExpiresAt)
    );
  }

  private async ensurePlayerResumeToken(
    playerId: string,
    options?: { rotate?: boolean },
  ): Promise<string> {
    return this.admission.ensurePlayerResumeToken(playerId, options);
  }

  async validatePlayerResumeToken(
    playerId: string,
    resumeToken: string,
  ): Promise<boolean> {
    return this.admission.validatePlayerResumeToken(playerId, resumeToken);
  }

  private sendRoomTokens(
    conn: Connection,
    tokens: RoomTokens,
    viewerRole: "player" | "spectator",
    resumeToken?: string,
  ): boolean {
    const payload =
      viewerRole === "player"
        ? {
            ...tokens,
            ...(resumeToken ? { resumeToken } : {}),
          }
        : { spectatorToken: tokens.spectatorToken };
    try {
      conn.send(JSON.stringify({ type: "roomTokens", payload }));
      return true;
    } catch (_err) {
      return false;
    }
  }

  private buildRoomInviteUrl(
    webOrigin: string,
    params: {
      tokenParam?: { name: "gt" | "st" | "rt"; value: string };
      playerId?: string;
    } = {},
  ): string {
    const url = new URL(`/rooms/${this.name}`, webOrigin);
    if (params.tokenParam) {
      url.searchParams.set(params.tokenParam.name, params.tokenParam.value);
    }
    if (params.playerId) {
      url.searchParams.set("playerId", params.playerId);
    }
    return url.toString();
  }

  private sendShareLinksResponse(
    conn: Connection,
    response:
      | {
          requestId: string;
          ok: true;
          payload: ShareLinksPayload;
        }
      | {
          requestId: string;
          ok: false;
          error: string;
        },
  ): void {
    try {
      conn.send(
        JSON.stringify({
          type: "shareLinksResponse",
          ...response,
        }),
      );
    } catch (_err) {}
  }

  private async handleShareLinksRequest(
    conn: Connection,
    rawRequestId: unknown,
  ): Promise<void> {
    const requestId = normalizeNonEmptyString(rawRequestId);
    if (!requestId) return;

    const state = (conn.state ?? {}) as IntentConnectionState;
    if (state.viewerRole === "spectator") {
      this.sendShareLinksResponse(conn, {
        requestId,
        ok: false,
        error: "Spectators cannot request invite links.",
      });
      return;
    }

    const playerId = normalizeNonEmptyString(state.playerId);
    if (!playerId) {
      this.sendShareLinksResponse(conn, {
        requestId,
        ok: false,
        error: "Player identity is not available for this connection.",
      });
      return;
    }

    const webOrigin = resolveDrawspellWebOrigin(this.env);
    if (!webOrigin) {
      this.sendShareLinksResponse(conn, {
        requestId,
        ok: false,
        error: "Drawspell web origin is not configured.",
      });
      return;
    }

    try {
      const tokens = await this.ensureRoomTokens();
      const resumeToken = await this.ensurePlayerResumeToken(playerId);
      this.sendShareLinksResponse(conn, {
        requestId,
        ok: true,
        payload: {
          playerInviteUrl: this.buildRoomInviteUrl(webOrigin, {
            tokenParam: { name: "gt", value: tokens.playerToken },
          }),
          spectatorInviteUrl: this.buildRoomInviteUrl(webOrigin, {
            tokenParam: { name: "st", value: tokens.spectatorToken },
          }),
          resumeInviteUrl: this.buildRoomInviteUrl(webOrigin, {
            tokenParam: { name: "rt", value: resumeToken },
            playerId,
          }),
        },
      });
    } catch (error) {
      console.error("[party] failed to build share links", {
        room: this.name,
        connId: conn.id,
        playerId,
        message: resolveErrorMessage(error),
      });
      this.sendShareLinksResponse(conn, {
        requestId,
        ok: false,
        error: "Unable to generate invite links right now.",
      });
    }
  }

  private async restorePlayerResumeToken(
    playerId: string,
    resumeToken?: string,
  ): Promise<void> {
    await this.admission.restorePlayerResumeToken(playerId, resumeToken);
  }

  private hasPlayerConnections(excluding?: Connection): boolean {
    if (this.pendingPlayerConnections > 0) return true;
    return this.hasAuthenticatedPlayerConnections(excluding);
  }

  private hasAuthenticatedPlayerConnections(excluding?: Connection): boolean {
    for (const [connection, role] of this.connectionRoles.entries()) {
      if (connection === excluding) continue;
      if (role === "player") return true;
    }
    for (const existingConnection of this.getPlayerConnectionsSnapshot()) {
      if (existingConnection.connection === excluding) continue;
      return true;
    }
    return false;
  }

  private normalizeEmptyRoomStartedAt(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return null;
    }
    return value;
  }

  private getEmptyRoomTeardownAt(startedAt: number): number {
    return startedAt + EMPTY_ROOM_TOTAL_RESET_MS;
  }

  private async setEmptyRoomAlarm(teardownAt: number) {
    const storage = this.ctx.storage as DurableObjectStorage & {
      setAlarm?: (scheduledTimeMs: number) => Promise<void>;
    };
    if (typeof storage.setAlarm !== "function") return;
    await storage.setAlarm(teardownAt);
  }

  private async deleteEmptyRoomAlarm() {
    const storage = this.ctx.storage as DurableObjectStorage & {
      deleteAlarm?: () => Promise<void>;
    };
    if (typeof storage.deleteAlarm !== "function") return;
    await storage.deleteAlarm();
  }

  private async getEmptyRoomAlarm(): Promise<number | null> {
    const storage = this.ctx.storage as DurableObjectStorage & {
      getAlarm?: () => Promise<number | null>;
    };
    if (typeof storage.getAlarm !== "function") return null;
    return storage.getAlarm();
  }

  private persistEmptyRoomLifecycle(startedAt: number, generation: number) {
    this.runBackground((async () => {
      if (this.teardownGeneration !== generation) return;
      if (this.hasPlayerConnections()) return;
      try {
        await this.ctx.storage.put(EMPTY_ROOM_STARTED_AT_KEY, startedAt);
        await this.setEmptyRoomAlarm(this.getEmptyRoomTeardownAt(startedAt));
      } catch (error) {
        console.error("[party] failed to schedule empty room alarm", {
          room: this.name,
          message: resolveErrorMessage(error),
        });
        return;
      }
      if (
        this.teardownGeneration !== generation ||
        this.hasAuthenticatedPlayerConnections() ||
        this.emptyRoomStartedAt !== startedAt
      ) {
        try {
          await this.ctx.storage.delete(EMPTY_ROOM_STARTED_AT_KEY);
          await this.deleteEmptyRoomAlarm();
        } catch (_err) {}
      }
    })());
  }

  private ensureEmptyRoomStartedAt(): number {
    if (this.emptyRoomStartedAt !== null) return this.emptyRoomStartedAt;
    const startedAt = Date.now();
    this.emptyRoomStartedAt = startedAt;
    this.persistEmptyRoomLifecycle(startedAt, this.teardownGeneration);
    return startedAt;
  }

  private clearEmptyRoomLifecycle() {
    this.emptyRoomStartedAt = null;
    this.runBackground((async () => {
      try {
        await this.ctx.storage.delete(EMPTY_ROOM_STARTED_AT_KEY);
        await this.deleteEmptyRoomAlarm();
      } catch (_err) {}
    })());
  }

  private async restoreEmptyRoomLifecycle(): Promise<boolean> {
    const stored = await this.ctx.storage.get<unknown>(EMPTY_ROOM_STARTED_AT_KEY);
    const startedAt = this.normalizeEmptyRoomStartedAt(stored);
    if (startedAt === null) {
      if (stored !== undefined) {
        try {
          await this.ctx.storage.delete(EMPTY_ROOM_STARTED_AT_KEY);
          await this.deleteEmptyRoomAlarm();
        } catch (_err) {}
      }
      return false;
    }

    this.emptyRoomStartedAt = startedAt;
    const now = Date.now();
    const elapsed = now - startedAt;
    if (elapsed >= EMPTY_ROOM_TOTAL_RESET_MS) {
      await this.teardownRoomIfEmpty(this.teardownGeneration);
      return true;
    }

    if (elapsed >= EMPTY_ROOM_IDLE_GRACE_MS) {
      this.emptyRoomDormantAt = startedAt + EMPTY_ROOM_IDLE_GRACE_MS;
    }

    try {
      await this.setEmptyRoomAlarm(this.getEmptyRoomTeardownAt(startedAt));
    } catch (error) {
      console.error("[party] failed to restore empty room alarm", {
        room: this.name,
        message: resolveErrorMessage(error),
      });
    }
    this.scheduleEmptyRoomTeardown();
    return false;
  }

  private async handleEmptyRoomAlarm() {
    if (this.teardownInProgress) return;
    if (this.hasAuthenticatedPlayerConnections()) {
      this.markRoomActive();
      return;
    }

    const stored = await this.ctx.storage.get<unknown>(EMPTY_ROOM_STARTED_AT_KEY);
    const startedAt =
      this.normalizeEmptyRoomStartedAt(stored) ?? this.emptyRoomStartedAt;
    if (startedAt === null) {
      await this.deleteEmptyRoomAlarm();
      return;
    }

    const teardownAt = this.getEmptyRoomTeardownAt(startedAt);
    if (this.pendingPlayerConnections > 0) {
      await this.setEmptyRoomAlarm(
        Math.max(Date.now() + EMPTY_ROOM_PENDING_AUTH_RETRY_MS, teardownAt),
      );
      return;
    }
    if (Date.now() < teardownAt) {
      await this.setEmptyRoomAlarm(teardownAt);
      return;
    }

    await this.teardownRoomIfEmpty(this.teardownGeneration);
  }

  private markRoomActive() {
    this.clearEmptyRoomLifecycle();
    this.emptyRoomDormantAt = null;
  }

  private clearHiddenStatePersistQueue() {
    this.hiddenStatePersistQueued = null;
  }

  private async cancelAndDrainGameLogPersist() {
    const inFlight = this.gameLogPersistInFlight;
    if (inFlight) {
      await inFlight;
    }
    this.gameLogPersistQueued = false;
    this.gameLogPersistInFlight = null;
  }

  private getConnectionRateConfig() {
    return {
      windowMs: CONNECT_RATE_WINDOW_MS,
      maxAttempts: CONNECT_RATE_MAX_ATTEMPTS,
      blockMs: CONNECT_RATE_BLOCK_MS,
      pairWindowMs: CONNECT_RATE_PAIR_WINDOW_MS,
    };
  }

  private getConnectionRateChannel(url: URL): number {
    return url.searchParams.get("role") === INTENT_ROLE
      ? CONNECT_RATE_CHANNEL_INTENT
      : CONNECT_RATE_CHANNEL_SYNC;
  }

  private getConnectionRateAttemptKey(url: URL): string | null {
    const state = parseConnectionParams(url);
    const joinToken = normalizeNonEmptyString(url.searchParams.get("jt"));
    const identity =
      normalizeNonEmptyString(state.connectionGroupId) ??
      normalizeNonEmptyString(state.playerId) ??
      normalizeNonEmptyString(state.userId) ??
      joinToken ??
      normalizeNonEmptyString(state.resumeToken) ??
      normalizeNonEmptyString(state.token);
    if (!identity) return null;
    const viewerRole = state.viewerRole ?? "player";
    return `${this.name}:${viewerRole}:${identity}`;
  }

  private getClientIp(request: Request): string | null {
    const raw =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for");
    if (!raw) return null;
    return raw.split(",")[0]?.trim() ?? null;
  }

  private shouldRateLimitConnection(request: Request, url: URL): boolean {
    const ip = this.getClientIp(request);
    if (!ip) return false;
    const now = Date.now();
    const config = this.getConnectionRateConfig();
    const entry = this.connectionRate.get(ip) ?? {
      windowStart: now,
      attempts: 0,
      blockedUntil: 0,
      lastSeen: 0,
      recentAttempts: new Map(),
    };
    if (entry.blockedUntil > now) {
      this.connectionRate.set(ip, entry);
      return true;
    }
    if (now - entry.windowStart > config.windowMs) {
      entry.windowStart = now;
      entry.attempts = 0;
    }
    entry.lastSeen = now;
    const attemptKey = this.getConnectionRateAttemptKey(url);
    const channel = this.getConnectionRateChannel(url);
    let shouldCountAttempt = true;
    if (attemptKey) {
      const recent = entry.recentAttempts.get(attemptKey);
      if (
        recent &&
        now - recent.seenAt <= config.pairWindowMs &&
        (recent.channels & channel) === 0
      ) {
        recent.channels |= channel;
        recent.seenAt = now;
        shouldCountAttempt = false;
      } else {
        entry.recentAttempts.set(attemptKey, {
          seenAt: now,
          channels: channel,
        });
      }
    }
    if (shouldCountAttempt) {
      entry.attempts += 1;
    }
    if (entry.attempts > config.maxAttempts) {
      entry.blockedUntil = now + config.blockMs;
      entry.attempts = 0;
    }
    for (const [key, value] of entry.recentAttempts.entries()) {
      if (now - value.seenAt > config.pairWindowMs) {
        entry.recentAttempts.delete(key);
      }
    }
    this.connectionRate.set(ip, entry);

    if (now - this.lastConnectionRateCleanupAt > config.windowMs * 5) {
      this.lastConnectionRateCleanupAt = now;
      for (const [key, value] of this.connectionRate.entries()) {
        if (now - value.lastSeen > config.windowMs * 10) {
          this.connectionRate.delete(key);
        }
      }
    }

    return entry.blockedUntil > now;
  }

  private cleanupExpiredLibraryViews(options: { resend?: boolean } = {}) {
    const now = Date.now();
    const invalidConnections = new Map<string, Connection>();

    for (const connection of this.getIntentConnectionsSnapshot()) {
      const state = (connection.state ?? {}) as IntentConnectionState;
      const view = state.libraryView;
      if (!view) continue;
      const restored = this.normalizeConnectionLibraryView(connection, now);
      if (restored) {
        this.libraryViews.set(connection.id, restored);
      } else {
        invalidConnections.set(connection.id, connection);
      }
    }

    if (invalidConnections.size === 0) {
      return;
    }

    for (const connId of invalidConnections.keys()) {
      this.libraryViews.delete(connId);
      const connection = invalidConnections.get(connId);
      if (connection) {
        this.setConnectionLibraryView(connection, undefined);
      }
      if (options.resend === false) continue;
      if (connection) {
        void this.sendOverlayForConnection(connection);
      }
    }
  }

  private getLibraryViewMetricsCount() {
    this.cleanupExpiredLibraryViews({ resend: false });
    return this.libraryViews.size;
  }

  private normalizeConnectionLibraryView(
    conn: Connection,
    now = Date.now(),
  ): { playerId: string; count?: number; lastPingAt: number } | undefined {
    const state = (conn.state ?? {}) as IntentConnectionState;
    if (state.viewerRole === "spectator") return undefined;
    const view = state.libraryView;
    if (!view || typeof view.playerId !== "string") return undefined;
    const playerId = normalizeNonEmptyString(view.playerId);
    if (!playerId) return undefined;
    if (state.playerId && state.playerId !== playerId) return undefined;
    const count =
      typeof view.count === "number" &&
      Number.isFinite(view.count) &&
      view.count > 0
        ? Math.floor(view.count)
        : undefined;
    const lastPingAt =
      typeof view.lastPingAt === "number" && Number.isFinite(view.lastPingAt)
        ? view.lastPingAt
        : now;
    return {
      playerId,
      ...(count ? { count } : null),
      lastPingAt,
    };
  }

  private setConnectionLibraryView(
    conn: Connection,
    libraryView:
      | { playerId: string; count?: number; lastPingAt: number }
      | undefined,
  ) {
    const existingState = (conn.state ?? {}) as IntentConnectionState;
    const nextState: IntentConnectionState = { ...existingState };
    if (libraryView) {
      nextState.libraryView = libraryView;
    } else {
      delete nextState.libraryView;
    }
    this.setConnectionState(conn, nextState);
  }

  private setConnectionCapabilitiesState(conn: Connection, capabilities: string[]) {
    const existingState = (conn.state ?? {}) as IntentConnectionState;
    this.setConnectionState(conn, {
      ...existingState,
      capabilities,
    });
  }

  private sanitizeConnectionState(
    state: IntentConnectionState,
  ): IntentConnectionState {
    const { token: _token, ...safeState } = state;
    return safeState;
  }

  private setConnectionState(conn: Connection, state: IntentConnectionState) {
    try {
      conn.setState(this.sanitizeConnectionState(state));
    } catch (_err) {}
  }

  private getConnectionCapabilities(conn: Connection) {
    const existing = this.connectionCapabilities.get(conn.id);
    if (existing) return existing;
    const state = (conn.state ?? {}) as IntentConnectionState;
    const capabilities = Array.isArray(state.capabilities)
      ? state.capabilities.filter((value) => value === OVERLAY_DIFF_CAPABILITY)
      : [];
    const restored = new Set(capabilities);
    if (restored.size > 0) {
      this.connectionCapabilities.set(conn.id, restored);
    }
    return restored;
  }

  private getLibraryViewForConnection(conn: Connection) {
    const existing = this.libraryViews.get(conn.id);
    if (existing) return existing;
    const restored = this.normalizeConnectionLibraryView(conn);
    if (!restored) return undefined;
    this.libraryViews.set(conn.id, restored);
    return restored;
  }

  private scheduleHiddenStatePersist(
    expectedResetGeneration: number,
    connId?: string,
  ) {
    if (!this.hiddenState) return;
    if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
    const now = Date.now();
    const changeAt = Math.max(
      now,
      this.hiddenStateLastChangeAt + 1,
      this.lastHiddenStatePersistAt + 1,
    );
    this.hiddenStateLastChangeAt = changeAt;
    const meta = this.intentLogMeta;
    if (!meta) {
      this.maybeLogPerfMetrics("hidden-state-change");
      return;
    }
    const intentsSinceSnapshot = this.getIntentCountSinceSnapshot(meta);
    if (intentsSinceSnapshot <= 0) {
      this.maybeLogPerfMetrics("hidden-state-change");
      return;
    }
    const forceSnapshot = intentsSinceSnapshot >= INTENT_LOG_MAX_ENTRIES;
    const shouldSchedule =
      forceSnapshot ||
      intentsSinceSnapshot >= SNAPSHOT_INTENT_THRESHOLD ||
      now - meta.lastSnapshotAt >= SNAPSHOT_TIME_THRESHOLD_MS;
    if (forceSnapshot) {
      this.enqueueHiddenStatePersist(expectedResetGeneration, connId);
      this.maybeLogPerfMetrics("hidden-state-change");
      return;
    }
    if (!shouldSchedule) {
      this.maybeLogPerfMetrics("hidden-state-change");
      return;
    }
    this.enqueueHiddenStatePersist(expectedResetGeneration, connId);
    this.maybeLogPerfMetrics("hidden-state-change");
  }

  private async appendIntentLog(
    intent: Intent,
    expectedResetGeneration?: number,
    connId?: string,
  ) {
    let wrote = false;
    this.intentLogWritePending = true;
    const writePromise = this.intentLogWritePromise
      .then(async () => {
        if (!this.shouldPersistHiddenState(expectedResetGeneration)) return;
        const meta = await this.ensureIntentLogMeta(
          this.snapshotMeta ?? undefined,
        );
        const index = meta.nextIndex;
        const entry: IntentLogEntry = {
          index,
          ts: Date.now(),
          intent,
        };
        await this.ctx.storage.put(`${INTENT_LOG_PREFIX}${index}`, entry);
        meta.nextIndex = index + 1;
        if (meta.logStartIndex > meta.nextIndex) {
          meta.logStartIndex = meta.nextIndex;
        }
        this.intentLogMeta = meta;
        await this.ctx.storage.put(INTENT_LOG_META_KEY, meta);
        wrote = true;
      })
      .catch((err: any) => {
        console.error("[party] intent log append failed", {
          room: this.name,
          connId: connId ?? undefined,
          error: err?.message ?? String(err),
        });
      })
      .finally(() => {
        if (this.intentLogWritePromise === writePromise) {
          this.intentLogWritePending = false;
        }
      });
    this.intentLogWritePromise = writePromise;
    await this.intentLogWritePromise;
    return wrote;
  }

  private isHiddenStateDirty() {
    return (
      Boolean(this.hiddenState) &&
      this.hiddenStateLastChangeAt > this.lastHiddenStatePersistAt
    );
  }

  private getIntentCountSinceSnapshot(meta: IntentLogMeta) {
    return Math.max(0, meta.nextIndex - 1 - meta.snapshotIndex);
  }

  private shouldLogIntent(hiddenChanged: boolean, impact?: IntentImpact) {
    return hiddenChanged || Boolean(impact?.changedPublicDoc);
  }

  private enqueueHiddenStatePersist(
    expectedResetGeneration: number,
    connId?: string | null,
  ) {
    if (!this.isHiddenStateDirty()) return;
    if (this.hiddenStatePersistInFlight) {
      this.hiddenStatePersistQueued = {
        resetGeneration: expectedResetGeneration,
        connId: connId ?? null,
      };
      return;
    }
    this.hiddenStatePersistInFlight = this.flushHiddenStatePersist(
      expectedResetGeneration,
      connId,
    ).finally(() => {
      this.hiddenStatePersistInFlight = null;
      const queued = this.hiddenStatePersistQueued;
      this.hiddenStatePersistQueued = null;
      if (queued && this.shouldPersistHiddenState(queued.resetGeneration)) {
        this.enqueueHiddenStatePersist(
          queued.resetGeneration,
          queued.connId ?? null,
        );
      }
    });
    this.runBackground(this.hiddenStatePersistInFlight);
  }

  private async flushHiddenStatePersist(
    expectedResetGeneration?: number,
    connId?: string | null,
  ) {
    const persistStartedAt = Date.now();
    try {
      await this.persistHiddenState(expectedResetGeneration, connId);
      this.lastHiddenStatePersistAt = persistStartedAt;
    } catch (err: any) {
      let hiddenSize: number | null = null;
      try {
        hiddenSize = JSON.stringify(this.hiddenState ?? {}).length;
      } catch (_err) {
        hiddenSize = null;
      }
      console.error("[party] hidden state persist failed", {
        room: this.name,
        connId: connId ?? undefined,
        error: err?.message ?? String(err),
        hiddenSize,
      });
    }
  }

  private perfMetricsEnabled(): boolean {
    return PERF_METRICS_ENABLED || this.perfMetricsEnabledFlag;
  }

  private perfMetricsParamsAllowed(): boolean {
    return PERF_METRICS_ALLOW_PARAM;
  }

  private clampPerfMetricsInterval(value: number) {
    const min = PERF_METRICS_MIN_INTERVAL_MS;
    const max = PERF_METRICS_MAX_INTERVAL_MS;
    return Math.min(max, Math.max(min, Math.floor(value)));
  }

  private capturePerfMetricsFlag(url: URL) {
    const allowParams = this.perfMetricsParamsAllowed();
    if (allowParams) {
      const param = url.searchParams.get("perfMetrics");
      if (param === "1" || param === "true") {
        this.perfMetricsEnabledFlag = true;
      }
    }
    const rawInterval = allowParams
      ? url.searchParams.get("perfMetricsIntervalMs")
      : null;
    if (rawInterval) {
      const parsed = Number(rawInterval);
      if (Number.isFinite(parsed) && parsed > 0) {
        this.perfMetricsIntervalMs = this.clampPerfMetricsInterval(parsed);
      }
    }
    this.maybeLogPerfMetrics("connection");
  }

  private logPerfMetrics(reason: string) {
    if (!this.perfMetricsEnabled()) return;
    const now = Date.now();
    const previousMetricsAt = this.lastPerfMetricsAt || now;
    const metricsWindowSec = Math.max(1, (now - previousMetricsAt) / 1000);
    this.lastPerfMetricsAt = now;
    if (this.lastIntentMetricsAt === 0) {
      this.lastIntentMetricsAt = previousMetricsAt;
    }

    const maps = getMaps(this.document);
    const hidden = this.hiddenState;
    const countRecord = (record: Record<string, unknown>) =>
      Object.keys(record).length;
    const countOrderTotal = (record: Record<string, string[]>) => {
      let total = 0;
      for (const key in record) {
        const list = record[key];
        if (Array.isArray(list)) total += list.length;
      }
      return total;
    };

    const intentStats = computeMetricStats(this.intentApplySamples);
    const overlayMetrics = this.overlayService.getMetrics();
    const overlayPlayerStats = computeMetricStats(
      overlayMetrics.buildSamples.player,
    );
    const overlaySpectatorStats = computeMetricStats(
      overlayMetrics.buildSamples.spectator,
    );
    const totalOverlayBytes =
      overlayMetrics.bytesSent.snapshot + overlayMetrics.bytesSent.diff;
    const totalOverlayMessages =
      overlayMetrics.messagesSent.snapshot + overlayMetrics.messagesSent.diff;
    const connectionMetrics = this.getConnectionMetricsSnapshot();
    const intentRate =
      this.intentCountSinceMetrics > 0
        ? this.intentCountSinceMetrics / metricsWindowSec
        : 0;
    const yjsUpdatesPerSec =
      this.yjsUpdateCount > 0 ? this.yjsUpdateCount / metricsWindowSec : 0;

    const metrics = {
      ts: now,
      timestamp: new Date(now).toISOString(),
      intervalMs: this.perfMetricsIntervalMs,
      room: this.name,
      reason,
      connections: connectionMetrics.connections,
      intentConnections: connectionMetrics.intentConnections,
      overlays: this.overlayService.cacheSize,
      libraryViews: this.getLibraryViewMetricsCount(),
      roomHotness: {
        intentsPerSec: intentRate,
        intentCount: this.intentCountSinceMetrics,
      },
      intentApplyMs: intentStats,
      overlayBuildMs: {
        player: overlayPlayerStats,
        spectator: overlaySpectatorStats,
      },
      overlayBytesSent: {
        snapshot: overlayMetrics.bytesSent.snapshot,
        diff: overlayMetrics.bytesSent.diff,
        total: totalOverlayBytes,
      },
      overlayMessagesSent: {
        snapshot: overlayMetrics.messagesSent.snapshot,
        diff: overlayMetrics.messagesSent.diff,
        total: totalOverlayMessages,
      },
      overlayResyncCount: overlayMetrics.resyncCount,
      yjs: {
        players: maps.players.size,
        zones: maps.zones.size,
        cards: maps.cards.size,
        zoneCardOrders: maps.zoneCardOrders.size,
        handRevealsToAll: maps.handRevealsToAll.size,
        libraryRevealsToAll: maps.libraryRevealsToAll.size,
        faceDownRevealsToAll: maps.faceDownRevealsToAll.size,
        playerOrder: maps.playerOrder.length,
        bytesSent: this.yjsUpdateBytes,
        updateCount: this.yjsUpdateCount,
        updatesPerSec: yjsUpdatesPerSec,
      },
      hidden: hidden
        ? {
            cards: countRecord(hidden.cards),
            handPlayers: countRecord(hidden.handOrder),
            handCards: countOrderTotal(hidden.handOrder),
            libraryPlayers: countRecord(hidden.libraryOrder),
            libraryCards: countOrderTotal(hidden.libraryOrder),
            sideboardPlayers: countRecord(hidden.sideboardOrder),
            sideboardCards: countOrderTotal(hidden.sideboardOrder),
            faceDownBattlefield: countRecord(hidden.faceDownBattlefield),
            handReveals: countRecord(hidden.handReveals),
            libraryReveals: countRecord(hidden.libraryReveals),
            faceDownReveals: countRecord(hidden.faceDownReveals),
          }
        : null,
    };

    console.info("[party] perf metrics", metrics);

    this.intentApplySamples = [];
    this.overlayService.resetMetrics();
    this.intentCountSinceMetrics = 0;
    this.lastIntentMetricsAt = now;
    this.yjsUpdateBytes = 0;
    this.yjsUpdateCount = 0;
  }

  private maybeLogPerfMetrics(reason: string) {
    if (!this.perfMetricsEnabled()) return;
    const now = Date.now();
    if (
      this.lastPerfMetricsAt > 0 &&
      now - this.lastPerfMetricsAt < this.perfMetricsIntervalMs
    ) {
      return;
    }
    this.logPerfMetrics(reason);
  }

  private handleHelloMessage(conn: Connection, payload: unknown) {
    const requested =
      payload && typeof payload === "object"
        ? (payload as any).capabilities
        : null;
    const capabilities = Array.isArray(requested)
      ? requested.filter((value) => typeof value === "string")
      : [];
    const supported = new Set([OVERLAY_DIFF_CAPABILITY]);
    const accepted = capabilities.filter((value) => supported.has(value));
    this.connectionCapabilities.set(conn.id, new Set(accepted));
    this.setConnectionCapabilitiesState(conn, accepted);
    try {
      conn.send(
        JSON.stringify({
          type: "helloAck",
          payload: { acceptedCapabilities: accepted },
        }),
      );
    } catch (_err) {}
  }

  private async handleOverlayResync(conn: Connection, _payload: unknown) {
    await this.sendOverlayForConnection(
      conn,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        forceSnapshot: true,
      },
    );
  }

  private beginPendingPlayerConnection() {
    this.pendingPlayerConnections += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.pendingPlayerConnections = Math.max(
        0,
        this.pendingPlayerConnections - 1,
      );
      this.scheduleEmptyRoomTeardown();
    };
  }

  private scheduleEmptyRoomTeardown(excluding?: Connection) {
    if (this.teardownInProgress) return;
    if (this.hasAuthenticatedPlayerConnections(excluding)) {
      this.markRoomActive();
      return;
    }
    if (this.pendingPlayerConnections > 0) return;
    this.ensureEmptyRoomStartedAt();
    if (this.emptyRoomDormantAt !== null) return;
    const generation = this.teardownGeneration;
    this.runBackground(this.markRoomDormantIfEmpty(generation, excluding));
  }

  private async markRoomDormantIfEmpty(
    expectedGeneration: number,
    excluding?: Connection,
  ) {
    if (this.teardownInProgress) return;
    if (expectedGeneration !== this.teardownGeneration) return;
    if (this.hasPlayerConnections(excluding)) return;
    if (this.emptyRoomDormantAt !== null) {
      this.scheduleEmptyRoomTeardown(excluding);
      return;
    }

    this.emptyRoomDormantAt = Date.now();
    if (this.isHiddenStateDirty()) {
      await this.flushHiddenStatePersist(this.resetGeneration);
    }
    await this.flushGameLogPersist();
    this.scheduleEmptyRoomTeardown(excluding);
  }

  private registerConnection(
    conn: Connection,
    role: "player" | "spectator",
    state: IntentConnectionState,
  ) {
    this.connectionRoles.set(conn, role);
    if (role === "player" && state.playerId) {
      this.connectionPlayers.set(conn, state.playerId);
    } else {
      this.connectionPlayers.delete(conn);
    }
    if (state.connectionGroupId) {
      this.connectionGroups.set(conn, state.connectionGroupId);
    } else {
      this.connectionGroups.delete(conn);
    }
    if (role === "player") {
      this.teardownGeneration += 1;
      this.markRoomActive();
    }
    this.scheduleEmptyRoomTeardown();
    this.broadcastPeerCounts();
  }

  private unregisterConnection(conn: Connection) {
    this.connectionRoles.delete(conn);
    this.connectionPlayers.delete(conn);
    this.connectionGroups.delete(conn);
    this.scheduleEmptyRoomTeardown(conn);
    this.broadcastPeerCounts();
    if (!this.hasPlayerConnections(conn)) {
      this.enqueueHiddenStatePersist(this.resetGeneration, conn.id);
    }
  }

  private closeConnectionsForResumedPlayer(
    playerId: string,
    connectionGroupId: string | undefined,
    currentConnection: Connection,
    currentResumeToken?: string,
  ) {
    const normalizedResumeToken = normalizeNonEmptyString(currentResumeToken);
    for (const existingConnection of this.getPlayerConnectionsSnapshot()) {
      const { connection } = existingConnection;
      if (
        existingConnection.playerId !== playerId ||
        connection === currentConnection
      ) {
        continue;
      }
      const existingResumeToken = normalizeNonEmptyString(
        existingConnection.state.resumeToken,
      );
      const isSameGroupedSession =
        Boolean(connectionGroupId) &&
        existingConnection.connectionGroupId === connectionGroupId;
      const isSameLegacySyncSession =
        !connectionGroupId &&
        !existingConnection.isIntent &&
        Boolean(normalizedResumeToken) &&
        existingResumeToken === normalizedResumeToken;
      if (isSameGroupedSession || isSameLegacySyncSession) continue;
      try {
        connection.close(
          PLAYER_TAKEOVER_CLOSE_CODE,
          PLAYER_TAKEOVER_CLOSE_REASON,
        );
      } catch (_err) {}
    }
  }

  private updateConnectionResumeToken(
    connection: Connection,
    resumeToken?: string,
  ) {
    const normalizedResumeToken = normalizeNonEmptyString(resumeToken);
    if (!normalizedResumeToken) return;
    const existingState = (connection.state ?? null) as
      | IntentConnectionState
      | null;
    this.setConnectionState(connection, {
      ...(existingState ?? {}),
      resumeToken: normalizedResumeToken,
    });
  }

  private refreshLegacyResumeTokens(
    playerId: string,
    priorResumeToken: string | undefined,
    nextResumeToken: string | undefined,
    currentConnection: Connection,
    connectionGroupId: string | undefined,
  ) {
    const normalizedNextResumeToken = normalizeNonEmptyString(nextResumeToken);
    if (!normalizedNextResumeToken) return;

    this.updateConnectionResumeToken(currentConnection, normalizedNextResumeToken);

    if (connectionGroupId) return;

    const normalizedPriorResumeToken = normalizeNonEmptyString(priorResumeToken);
    if (
      !normalizedPriorResumeToken ||
      normalizedPriorResumeToken === normalizedNextResumeToken
    ) {
      return;
    }

    for (const existingConnection of this.getPlayerConnectionsSnapshot()) {
      const { connection } = existingConnection;
      if (
        existingConnection.playerId !== playerId ||
        connection === currentConnection
      ) {
        continue;
      }
      if (existingConnection.isIntent) continue;
      const existingResumeToken = normalizeNonEmptyString(
        existingConnection.state.resumeToken,
      );
      if (existingResumeToken !== normalizedPriorResumeToken) continue;
      this.updateConnectionResumeToken(connection, normalizedNextResumeToken);
    }
  }

  private async clearRoomStorage() {
    const storage = this.ctx.storage as unknown as {
      deleteAll?: () => Promise<void>;
      list?: () => Promise<
        Map<string, unknown> | Iterable<[string, unknown]> | string[]
      >;
      delete?: (key: string) => Promise<void>;
    };
    if (typeof storage.deleteAll === "function") {
      await storage.deleteAll();
      return;
    }
    if (
      typeof storage.list !== "function" ||
      typeof storage.delete !== "function"
    )
      return;
    const listed = await storage.list();
    const keys: string[] = [];
    if (Array.isArray(listed)) {
      listed.forEach((key) => {
        if (typeof key === "string") keys.push(key);
      });
    } else if (listed instanceof Map) {
      listed.forEach((_value, key) => {
        if (typeof key === "string") keys.push(key);
      });
    } else if (Symbol.iterator in Object(listed)) {
      for (const entry of listed as Iterable<[string, unknown]>) {
        if (entry && typeof entry[0] === "string") keys.push(entry[0]);
      }
    }
    await Promise.all(keys.map((key) => storage.delete!(key)));
  }

  private clearPublicState(doc: Y.Doc) {
    doc.transact(() => {
      const maps = getMaps(doc);
      clearYMap(maps.players);
      clearYMap(maps.zones);
      clearYMap(maps.cards);
      clearYMap(maps.zoneCardOrders);
      clearYMap(maps.globalCounters);
      clearYMap(maps.battlefieldViewScale);
      clearYMap(maps.meta);
      clearYMap(maps.handRevealsToAll);
      clearYMap(maps.libraryRevealsToAll);
      clearYMap(maps.faceDownRevealsToAll);
      syncPlayerOrder(maps.playerOrder, []);
    });
  }

  private async teardownRoomIfEmpty(expectedGeneration: number) {
    if (this.teardownInProgress) return;
    if (expectedGeneration !== this.teardownGeneration) return;
    if (this.hasPlayerConnections()) return;

    this.teardownInProgress = true;
    this.emptyRoomStartedAt = null;
    this.emptyRoomDormantAt = null;
    this.clearHiddenStatePersistQueue();
    await this.cancelAndDrainGameLogPersist();
    this.resetGeneration += 1;
    try {
      const connections = this.getAllConnectionsSnapshot();
      this.connectionRoles.clear();
      this.connectionPlayers.clear();
      this.connectionGroups.clear();
      this.connectionCapabilities.clear();
      this.intentConnections.clear();
      for (const connection of connections) {
        try {
          connection.close(ROOM_TEARDOWN_CLOSE_CODE, "room reset");
        } catch (_err) {}
      }
      this.roomAnalytics?.onRoomTeardown();

      if (this.isHiddenStateDirty()) {
        await this.flushHiddenStatePersist(this.resetGeneration);
      }
      this.hiddenState = null;
      this.admission.clearCache();
      this.intentLogMeta = null;
      this.snapshotMeta = null;
      this.intentLogWritePromise = Promise.resolve();
      this.gameLog.clear();
      this.libraryViews.clear();
      this.overlayService.clearCache();

      try {
        this.clearPublicState(this.document);
      } catch (_err) {}

      try {
        await this.ctx.storage.delete(EMPTY_ROOM_STARTED_AT_KEY);
        await this.deleteEmptyRoomAlarm();
        await this.clearRoomStorage();
      } catch (_err) {}
    } finally {
      this.teardownInProgress = false;
    }
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    this.ensureYjsMetricsListener();
    const url = new URL(ctx.request.url);
    if (this.teardownInProgress) {
      try {
        conn.close(ROOM_TEARDOWN_CLOSE_CODE, "room reset");
      } catch (_err) {}
      return;
    }
    if (this.shouldRateLimitConnection(ctx.request, url)) {
      try {
        conn.close(1013, "rate limited");
      } catch (_err) {}
      return;
    }
    const role = url.searchParams.get("role");
    if (role === INTENT_ROLE) {
      void this.bindIntentConnection(conn, url);
      return;
    }
    void this.bindSyncConnection(conn, url, ctx);
  }

  private async resolveConnectionAuthWithResume(
    state: IntentConnectionState,
    storedTokens: RoomTokens | null,
    options: { allowTokenCreation: boolean },
  ): Promise<ConnectionAuthWithResumeResult> {
    return this.admission.resolveConnectionAuthWithResume(
      state,
      storedTokens,
      options,
    );
  }

  private async bindIntentConnection(conn: Connection, url: URL) {
    this.intentConnections.add(conn);
    const state = parseConnectionParams(url);
    let connectionRegistered = false;
    let resolvedRole: "player" | "spectator" | undefined;
    let resolvedPlayerId: string | undefined;
    let resolvedUserId: string | undefined;
    let resolvedAnalyticsUserId: string | undefined;
    const rejectConnection = (reason: string, code = 1008) => {
      if (connectionRegistered) {
        connectionRegistered = false;
        this.unregisterConnection(conn);
        if (resolvedAnalyticsUserId) {
          this.roomAnalytics?.onUserLeave(resolvedAnalyticsUserId);
        }
      }
      this.cleanupIntentConnection(conn);
      try {
        conn.close(code, reason);
      } catch (_err) {}
    };

    this.logHandoffDebug("intent.auth.start", () => ({
      room: this.name,
      connId: conn.id,
      playerId: state.playerId ?? null,
      viewerRole: state.viewerRole ?? null,
      hasToken: Boolean(state.token),
      hasResumeToken: Boolean(state.resumeToken),
      resumeToken: summarizeSecretToken(state.resumeToken),
      hasConnectionGroupId: Boolean(state.connectionGroupId),
      connectionGroupId: state.connectionGroupId ?? null,
    }));

    const storedTokens = await this.loadRoomTokens();
    const auth = await this.resolveConnectionAuthWithResume(
      state,
      storedTokens,
      { allowTokenCreation: true },
    );
    if (!auth.ok) {
      this.logHandoffDebug("intent.auth.rejected", () => ({
        room: this.name,
        connId: conn.id,
        reason: auth.reason,
      }));
      rejectConnection(auth.reason);
      return;
    }
    const activeTokens = auth.tokens;
    resolvedRole = auth.resolvedRole;
    resolvedPlayerId = auth.playerId;
    if (typeof state.userId === "string") {
      const trimmed = state.userId.trim();
      resolvedUserId = trimmed.length ? trimmed : undefined;
    }
    resolvedAnalyticsUserId =
      resolvedUserId ??
      (resolvedRole === "player" && resolvedPlayerId
        ? `player:${resolvedPlayerId}`
        : undefined);
    const priorResumeToken =
      auth.resumed && resolvedRole === "player" ? state.resumeToken : undefined;
    const rollbackResumeToken = async () => {
      if (!priorResumeToken || !resolvedPlayerId) return;
      await this.restorePlayerResumeToken(resolvedPlayerId, priorResumeToken);
    };
    this.logHandoffDebug("intent.auth.accepted", () => ({
      room: this.name,
      connId: conn.id,
      resolvedRole,
      resolvedPlayerId: resolvedPlayerId ?? null,
      resumed: auth.resumed,
      hasActivePlayerToken: Boolean(activeTokens?.playerToken),
      hasActiveSpectatorToken: Boolean(activeTokens?.spectatorToken),
      priorResumeToken: summarizeSecretToken(priorResumeToken),
    }));
    if (this.isConnectionClosed(conn)) return;
    this.capturePerfMetricsFlag(url);
    this.setConnectionState(conn, {
      channel: "intent",
      playerId: resolvedPlayerId,
      viewerRole: resolvedRole,
      userId: resolvedUserId,
      resumeToken: state.resumeToken,
      connectionGroupId: state.connectionGroupId,
    });
    this.registerConnection(conn, resolvedRole, {
      channel: "intent",
      playerId: resolvedPlayerId,
      viewerRole: resolvedRole,
      userId: resolvedUserId,
      resumeToken: state.resumeToken,
      connectionGroupId: state.connectionGroupId,
    });
    connectionRegistered = true;

    let resumeToken: string | undefined;
    try {
      resumeToken =
        resolvedRole === "player" && resolvedPlayerId
          ? await this.ensurePlayerResumeToken(resolvedPlayerId, {
              rotate: auth.resumed,
            })
          : undefined;
    } catch (err) {
      console.error("[party] failed to rotate resume token", {
        room: this.name,
        connId: conn.id,
        playerId: resolvedPlayerId,
        error:
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: unknown }).message)
            : String(err),
      });
      try {
        await rollbackResumeToken();
        resumeToken = priorResumeToken;
      } catch (_rollbackErr) {
        rejectConnection("internal error", 1011);
        return;
      }
      console.warn("[party] continuing without rotating resume token", {
        room: this.name,
        connId: conn.id,
        playerId: resolvedPlayerId,
        reusedPriorToken: Boolean(priorResumeToken),
      });
    }

    if (this.isConnectionClosed(conn)) {
      await rollbackResumeToken();
      return;
    }

    this.logHandoffDebug("intent.roomTokens.sending", () => ({
      room: this.name,
      connId: conn.id,
      resolvedRole,
      resolvedPlayerId: resolvedPlayerId ?? null,
      hasActiveTokens: Boolean(activeTokens),
      hasPlayerToken: Boolean(activeTokens?.playerToken),
      hasSpectatorToken: Boolean(activeTokens?.spectatorToken),
      generatedResumeToken: summarizeSecretToken(resumeToken),
    }));

    if (activeTokens) {
      const sent = this.sendRoomTokens(
        conn,
        activeTokens,
        resolvedRole,
        resumeToken,
      );
      if (!sent) {
        try {
          await rollbackResumeToken();
        } catch (_rollbackErr) {}
        rejectConnection("internal error", 1011);
        return;
      }
    }

    if (auth.resumed && resolvedRole === "player" && resolvedPlayerId) {
      this.closeConnectionsForResumedPlayer(
        resolvedPlayerId,
        state.connectionGroupId,
        conn,
        state.resumeToken,
      );
    }

    if (resolvedRole === "player" && resolvedPlayerId && resumeToken) {
      this.refreshLegacyResumeTokens(
        resolvedPlayerId,
        priorResumeToken,
        resumeToken,
        conn,
        state.connectionGroupId,
      );
    }

    if (resolvedRole === "player") {
      this.roomAnalytics?.onPlayerJoin();
    }
    if (resolvedAnalyticsUserId) {
      this.roomAnalytics?.onUserJoin(resolvedAnalyticsUserId, resolvedRole);
    }
    this.logRoutineConnection("[party] intent connection established", () => ({
      room: this.name,
      connId: conn.id,
      playerId: resolvedPlayerId,
      viewerRole: resolvedRole,
      hasToken: Boolean(auth.token),
    }));

    void this.sendOverlayForConnection(conn);
  }

  private async bindSyncConnection(
    conn: Connection,
    url: URL,
    ctx: ConnectionContext,
  ) {
    let connectionRegistered = false;
    const state = parseConnectionParams(url);
    const initialRole = state.viewerRole ?? "player";
    const pendingRelease =
      initialRole === "player" ? this.beginPendingPlayerConnection() : null;
    let pendingReleased = false;
    const finalizePending = () => {
      if (pendingReleased) return;
      pendingReleased = true;
      this.clearPendingCloseHandler(conn);
      pendingRelease?.();
    };
    this.registerPendingCloseHandler(conn, () => {
      if (!connectionRegistered) {
        finalizePending();
        return;
      }
      this.unregisterConnection(conn);
    });

    const rejectConnection = (reason: string) => {
      finalizePending();
      try {
        conn.close(1008, reason);
      } catch (_err) {}
    };
    const rejectForReset = () => {
      finalizePending();
      try {
        conn.close(ROOM_TEARDOWN_CLOSE_CODE, "room reset");
      } catch (_err) {}
    };

    let storedTokens: RoomTokens | null = null;
    try {
      storedTokens = await this.loadRoomTokens();
    } catch (err) {
      finalizePending();
      throw err;
    }

    let resolvedRole: "player" | "spectator";
    let resolvedPlayerId: string | undefined;
    try {
      const auth = await this.resolveConnectionAuthWithResume(
        state,
        storedTokens,
        { allowTokenCreation: false },
      );
      if (!auth.ok) {
        rejectConnection(auth.reason);
        return;
      }
      resolvedRole = auth.resolvedRole;
      resolvedPlayerId = auth.playerId;
    } catch (err) {
      finalizePending();
      throw err;
    }

    if (this.isConnectionClosed(conn)) {
      finalizePending();
      return;
    }
    if (this.teardownInProgress) {
      rejectForReset();
      return;
    }
    this.capturePerfMetricsFlag(url);
    this.setConnectionState(conn, {
      channel: "sync",
      playerId: resolvedPlayerId,
      viewerRole: resolvedRole,
      userId: state.userId,
      resumeToken: state.resumeToken,
      connectionGroupId: state.connectionGroupId,
    });
    this.registerConnection(conn, resolvedRole, {
      channel: "sync",
      playerId: resolvedPlayerId,
      viewerRole: resolvedRole,
      userId: state.userId,
      resumeToken: state.resumeToken,
      connectionGroupId: state.connectionGroupId,
    });
    connectionRegistered = true;
    finalizePending();
    return super.onConnect(conn, ctx);
  }

  private async handleIntent(conn: Connection, intent: Intent) {
    if (this.snapshotBarrier) {
      await this.snapshotBarrier;
    }
    const finishIntent = this.beginIntentHandling();
    try {
      let ok = false;
      let error: string | undefined;
      let logEvents: { eventId: string; payload: Record<string, unknown> }[] =
        [];
      let hiddenChanged = false;
      let intentImpact: IntentImpact | undefined;
      this.intentCountSinceMetrics += 1;
      const resetGeneration = this.resetGeneration;
      const state = (conn.state ?? {}) as IntentConnectionState;

      if (state.viewerRole === "spectator") {
        this.sendIntentAck(
          conn,
          intent.id,
          false,
          "spectators cannot send intents",
        );
        return;
      }
      if (!state.playerId) {
        this.sendIntentAck(conn, intent.id, false, "missing player");
        return;
      }

      const payload = isRecord(intent.payload) ? { ...intent.payload } : {};
      if (
        typeof payload.actorId === "string" &&
        payload.actorId !== state.playerId
      ) {
        this.sendIntentAck(conn, intent.id, false, "actor mismatch");
        return;
      }
      payload.actorId = state.playerId;
      const normalizedIntent = { ...intent, payload };

      try {
        const applyStart = nowMs();
        const doc = this.document;
        const hidden = await this.ensureHiddenState(doc);
        const result = applyIntentToDoc(doc, normalizedIntent, hidden);
        const applyDuration = nowMs() - applyStart;
        sampleMetric(this.intentApplySamples, applyDuration);
        ok = result.ok;
        if (result.ok) {
          logEvents = result.logEvents;
          hiddenChanged = Boolean(result.hiddenChanged);
          intentImpact = result.impact;
        } else {
          error = result.error;
        }
      } catch (err: any) {
        ok = false;
        error = err?.message ?? "intent handler failed";
      }

      this.sendIntentAck(conn, intent.id, ok, error);

      const shouldLogIntent =
        ok && this.shouldLogIntent(hiddenChanged, intentImpact);
      if (shouldLogIntent) {
        const logged = await this.appendIntentLog(
          normalizedIntent,
          resetGeneration,
          conn.id,
        );
        if (!logged) {
          this.enqueueHiddenStatePersist(resetGeneration, conn.id);
        }
        this.scheduleHiddenStatePersist(resetGeneration, conn.id);
      }

      if (ok && hiddenChanged) {
        await this.broadcastOverlays(intentImpact);
      }

      if (ok && logEvents.length > 0) {
        try {
          await this.ensureGameLogRestored();
          const entries = this.gameLog.append(logEvents);
          this.scheduleGameLogPersist();
          this.broadcastGameLogEvents(entries);
        } catch (err: any) {
          console.error("[party] log events broadcast failed", {
            room: this.name,
            connId: conn.id,
            error: err?.message ?? String(err),
            eventIds: logEvents.map((event) => event.eventId),
          });
        }
      }

      if (ok) {
        if (normalizedIntent.type === "library.view") {
          await this.handleLibraryViewIntent(conn, normalizedIntent);
        } else if (normalizedIntent.type === "library.view.close") {
          await this.handleLibraryViewCloseIntent(conn, normalizedIntent);
        } else if (normalizedIntent.type === "library.view.ping") {
          this.handleLibraryViewPingIntent(conn, normalizedIntent);
        }
      }
    } finally {
      finishIntent();
    }
  }

  private async handleGameLogRequest(
    conn: Connection,
    parsed: Record<string, unknown>,
  ) {
    await this.ensureGameLogRestored();
    const lastLogSeq =
      typeof parsed.lastLogSeq === "number" ? parsed.lastLogSeq : undefined;
    const response = this.gameLog.replayAfter(lastLogSeq);
    const type =
      response.kind === "replay" ? "gameLogReplay" : "gameLogSnapshot";
    try {
      conn.send(JSON.stringify({ type, events: response.entries }));
    } catch (_err) {}
  }

  private broadcastGameLogEvents(entries: GameLogEntry[]) {
    if (entries.length === 0) return;
    const messages = entries.map((event) =>
      JSON.stringify({
        type: "gameLogEvent",
        seq: event.seq,
        ts: event.ts,
        eventId: event.eventId,
        payload: event.payload,
      }),
    );
    for (const connection of this.getIntentConnectionsSnapshot()) {
      for (const message of messages) {
        try {
          connection.send(message);
        } catch (_err) {}
      }
    }
  }

  private async sendOverlayForConnection(
    conn: Connection,
    maps?: ReturnType<typeof getMaps>,
    hidden?: HiddenState,
    snapshot?: Snapshot,
    zoneLookup?: ReturnType<typeof buildOverlayZoneLookup>,
    options?: { forceSnapshot?: boolean },
  ) {
    try {
      const activeHidden =
        hidden ?? (await this.ensureHiddenState(this.document));
      if (!activeHidden) return;
      const overlaySnapshot =
        snapshot ?? buildSnapshot(maps ?? getMaps(this.document));
      const overlayZoneLookup =
        zoneLookup ?? buildOverlayZoneLookup(overlaySnapshot);
      const state = (conn.state ?? {}) as IntentConnectionState;
      const viewerRole = state.viewerRole ?? "player";
      const viewerId = state.playerId;
      const libraryView = this.getLibraryViewForConnection(conn);
      const buildResult = this.overlayService.buildOverlaySnapshotData({
        snapshot: overlaySnapshot,
        zoneLookup: overlayZoneLookup,
        hidden: activeHidden,
        viewerRole,
        viewerId,
        libraryView,
      });
      const capabilities = this.getConnectionCapabilities(conn);
      const supportsDiff = capabilities?.has(OVERLAY_DIFF_CAPABILITY) ?? false;
      this.overlayService.sendOverlayForConnection({
        conn,
        buildResult,
        viewerId,
        supportsDiff,
        forceSnapshot: options?.forceSnapshot,
      });
    } catch (_err) {}
  }

  private async broadcastOverlays(impact?: IntentImpact) {
    const intentConnections = this.getIntentConnectionsSnapshot();
    if (intentConnections.length === 0) return;
    this.cleanupExpiredLibraryViews({ resend: false });

    const maps = getMaps(this.document);
    const hidden = await this.ensureHiddenState(this.document);
    const snapshot = buildSnapshot(maps);
    const zoneLookup = buildOverlayZoneLookup(snapshot);
    const overlayBuildCache = new Map<string, OverlayBuildResult>();
    const revealScopes = impact?.changedRevealScopes;
    const impactedOwners = new Set<string>(impact?.changedOwners ?? []);
    let unknownZoneImpact = false;
    if (Array.isArray(impact?.changedZones)) {
      impact.changedZones.forEach((zoneId) => {
        const zone = snapshot.zones[zoneId];
        if (zone?.ownerId) {
          impactedOwners.add(zone.ownerId);
        } else {
          unknownZoneImpact = true;
        }
      });
    }
    const shouldBroadcastAll =
      !impact ||
      Boolean(revealScopes?.toAll) ||
      unknownZoneImpact ||
      (impactedOwners.size === 0 &&
        (revealScopes?.toPlayers?.length ?? 0) === 0);
    const affectedPlayers = new Set<string>(
      shouldBroadcastAll ? [] : impactedOwners,
    );
    if (!shouldBroadcastAll && Array.isArray(revealScopes?.toPlayers)) {
      revealScopes?.toPlayers.forEach((playerId) => {
        if (typeof playerId === "string") affectedPlayers.add(playerId);
      });
    }
    for (const connection of intentConnections) {
      const state = (connection.state ?? {}) as IntentConnectionState;
      const viewerRole = state.viewerRole ?? "player";
      const viewerId = state.playerId;
      const libraryView = this.getLibraryViewForConnection(connection);
      const libraryViewOwner = libraryView?.playerId;
      const shouldSend =
        viewerRole === "spectator" ||
        shouldBroadcastAll ||
        (viewerId ? affectedPlayers.has(viewerId) : false) ||
        (libraryViewOwner ? impactedOwners.has(libraryViewOwner) : false);
      if (!shouldSend) continue;
      const cacheKey = `${viewerRole}|${viewerId ?? ""}|${libraryView?.playerId ?? ""}|${
        libraryView?.count ?? ""
      }`;
      let buildResult = overlayBuildCache.get(cacheKey);
      if (!buildResult) {
        buildResult = this.overlayService.buildOverlaySnapshotData({
          snapshot,
          zoneLookup,
          hidden,
          viewerRole,
          viewerId,
          libraryView,
        });
        overlayBuildCache.set(cacheKey, buildResult);
      }
      const capabilities = this.getConnectionCapabilities(connection);
      const supportsDiff = capabilities?.has(OVERLAY_DIFF_CAPABILITY) ?? false;
      this.overlayService.sendOverlayForConnection({
        conn: connection,
        buildResult,
        viewerId,
        supportsDiff,
      });
    }
    this.maybeLogPerfMetrics("overlay-broadcast");
  }

  private async handleLibraryViewIntent(conn: Connection, intent: Intent) {
    const state = (conn.state ?? {}) as IntentConnectionState;
    if (state.viewerRole === "spectator") return;
    const viewerId = state.playerId;
    const payload = isRecord(intent.payload) ? intent.payload : {};
    const playerId =
      typeof payload.playerId === "string" ? payload.playerId : null;
    if (!playerId) return;
    if (viewerId && viewerId !== playerId) return;
    const count =
      typeof payload.count === "number" &&
      Number.isFinite(payload.count) &&
      payload.count > 0
        ? Math.floor(payload.count)
        : undefined;
    const libraryView = {
      playerId,
      ...(count ? { count } : null),
      lastPingAt: Date.now(),
    };
    this.libraryViews.set(conn.id, libraryView);
    this.setConnectionLibraryView(conn, libraryView);
    this.cleanupExpiredLibraryViews();
    await this.sendOverlayForConnection(conn);
  }

  private async handleLibraryViewCloseIntent(conn: Connection, intent: Intent) {
    const state = (conn.state ?? {}) as IntentConnectionState;
    if (state.viewerRole === "spectator") return;
    const viewerId = state.playerId;
    const payload = isRecord(intent.payload) ? intent.payload : {};
    const playerId =
      typeof payload.playerId === "string" ? payload.playerId : null;
    if (!playerId) return;
    if (viewerId && viewerId !== playerId) return;
    this.libraryViews.delete(conn.id);
    this.setConnectionLibraryView(conn, undefined);
    await this.sendOverlayForConnection(conn);
  }

  private handleLibraryViewPingIntent(conn: Connection, intent: Intent): boolean {
    const state = (conn.state ?? {}) as IntentConnectionState;
    if (state.viewerRole === "spectator") return false;
    const viewerId = state.playerId;
    const payload = isRecord(intent.payload) ? intent.payload : {};
    const playerId =
      typeof payload.playerId === "string" ? payload.playerId : null;
    if (!playerId) return false;
    if (viewerId && viewerId !== playerId) return false;
    const existing = this.getLibraryViewForConnection(conn);
    if (!existing || existing.playerId !== playerId) return false;
    existing.lastPingAt = Date.now();
    this.libraryViews.set(conn.id, existing);
    this.setConnectionLibraryView(conn, existing);
    this.cleanupExpiredLibraryViews();
    return true;
  }
}
