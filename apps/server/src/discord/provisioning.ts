import type {
  DiscordRoomInternalProvisionPayload,
  DiscordRoomInternalProvisionResponse,
  DiscordRoomProvisionRequest,
} from "@mtg/shared/discord/provisioning";
import { ORIGINS } from "@mtg/shared/constants/hosts";

const ROOM_ID_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DISCORD_ROOM_ID_LENGTH = 10;

export const DISCORD_SERVICE_AUTH_HEADER = "x-drawspell-service-auth";
export const DISCORD_REQUEST_ID_HEADER = "x-discord-request-id";
export const DISCORD_INVITE_TTL_MS = 10 * 60_000;

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeParticipantDiscordUserIds = (
  value: unknown,
  invokerDiscordUserId: string,
) => {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const candidate of value) {
    const parsed = normalizeNonEmptyString(candidate);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    normalized.push(parsed);
  }

  if (!seen.has(invokerDiscordUserId)) {
    normalized.unshift(invokerDiscordUserId);
  }

  return normalized;
};

export const createRoomIdFromSeed = async (
  seed: string,
  length = DISCORD_ROOM_ID_LENGTH,
): Promise<string> => {
  const safeLength =
    typeof length === "number" && Number.isFinite(length) && length > 0
      ? Math.floor(length)
      : DISCORD_ROOM_ID_LENGTH;
  const alphabetLength = ROOM_ID_ALPHABET.length;
  const seedBytes = new TextEncoder().encode(seed);
  const hash = await crypto.subtle.digest("SHA-256", seedBytes);
  const bytes = new Uint8Array(hash);

  let result = "";
  for (let i = 0; i < safeLength; i += 1) {
    result += ROOM_ID_ALPHABET[bytes[i % bytes.length] % alphabetLength];
  }
  return result;
};

export const parseBearerToken = (headerValue: string | null) => {
  if (!headerValue) return null;
  const [scheme, ...rest] = headerValue.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
};

export const resolveDrawspellWebOrigin = (
  env: Pick<Env, "NODE_ENV">,
): string | null => ORIGINS[env.NODE_ENV as keyof typeof ORIGINS]?.web ?? null;

export const resolveErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "unknown";
};

export const resolveDiscordRequestId = (request: Request): string =>
  normalizeNonEmptyString(request.headers.get(DISCORD_REQUEST_ID_HEADER)) ??
  crypto.randomUUID();

export const logDiscordProvisionEvent = (
  event: string,
  details: Record<string, unknown>,
) => {
  console.info("[discord-provision]", event, details);
};

export const parseDiscordProvisionRequest = (
  rawBody: unknown,
): DiscordRoomProvisionRequest | null => {
  if (!rawBody || typeof rawBody !== "object") return null;
  const record = rawBody as Record<string, unknown>;
  const interactionId = normalizeNonEmptyString(record.interactionId);
  const guildId = normalizeNonEmptyString(record.guildId);
  const channelId = normalizeNonEmptyString(record.channelId);
  const invokerDiscordUserId = normalizeNonEmptyString(
    record.invokerDiscordUserId,
  );
  if (!interactionId || !guildId || !channelId || !invokerDiscordUserId) {
    return null;
  }

  const participantDiscordUserIds = normalizeParticipantDiscordUserIds(
    record.participantDiscordUserIds,
    invokerDiscordUserId,
  );
  if (!participantDiscordUserIds || participantDiscordUserIds.length === 0) {
    return null;
  }

  return {
    interactionId,
    guildId,
    channelId,
    invokerDiscordUserId,
    participantDiscordUserIds,
  };
};

export const parseDiscordRoomProvisionPayload = (
  rawBody: unknown,
): DiscordRoomInternalProvisionPayload | null => {
  const parsed = parseDiscordProvisionRequest(rawBody);
  if (!parsed) return null;

  const record = rawBody as Record<string, unknown>;
  const inviteExpiresAtRaw = record.inviteExpiresAt;
  if (
    typeof inviteExpiresAtRaw !== "number" ||
    !Number.isFinite(inviteExpiresAtRaw)
  ) {
    return null;
  }

  const inviteExpiresAt = Math.floor(inviteExpiresAtRaw);
  if (inviteExpiresAt <= 0) return null;
  return { ...parsed, inviteExpiresAt };
};

export const parseDiscordRoomProvisionResponse = (
  rawBody: unknown,
): DiscordRoomInternalProvisionResponse | null => {
  if (!rawBody || typeof rawBody !== "object") return null;

  const record = rawBody as Record<string, unknown>;
  const roomId = normalizeNonEmptyString(record.roomId);
  const playerToken = normalizeNonEmptyString(record.playerToken);
  const expiresAt = record.expiresAt;
  const alreadyProvisioned = record.alreadyProvisioned;
  if (!roomId || !playerToken) return null;
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return null;
  if (typeof alreadyProvisioned !== "boolean") return null;

  return {
    roomId,
    playerToken,
    expiresAt: Math.floor(expiresAt),
    alreadyProvisioned,
  };
};

export const resolveDiscordServiceAuthSecret = (env: Env) => {
  const raw = (env as Env & { DISCORD_SERVICE_AUTH_SECRET?: string })
    .DISCORD_SERVICE_AUTH_SECRET;
  return normalizeNonEmptyString(raw);
};
