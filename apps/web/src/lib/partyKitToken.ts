import type { ViewerRole } from "@/types";
import type { RoomTokensPayload } from "@/partykit/messages";
import { createSafeStorage } from "@/lib/safeStorage";

export type ResolvedInviteToken = {
  token?: string;
  role?: ViewerRole;
  playerId?: string;
  resumeToken?: string;
};

const TOKEN_STORAGE_PREFIX = "drawspell:roomTokens:";
const PENDING_HOST_PREFIX = "drawspell:pendingHost:";
const ROOM_UNAVAILABLE_PREFIX = "drawspell:roomUnavailable:";
const storage = createSafeStorage();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const resolveInviteTokenFromUrl = (href?: string): ResolvedInviteToken => {
  if (!href) return {};
  try {
    const url = new URL(href);
    const playerId = url.searchParams.get("playerId") ?? undefined;
    const resumeToken =
      url.searchParams.get("rt") ??
      url.searchParams.get("resumeToken") ??
      undefined;
    const spectatorToken = url.searchParams.get("st");
    if (spectatorToken) {
      return {
        token: spectatorToken,
        role: "spectator",
        playerId,
        resumeToken,
      };
    }
    const playerToken = url.searchParams.get("gt");
    if (playerToken) {
      return { token: playerToken, role: "player", playerId, resumeToken };
    }
    if (resumeToken || playerId) {
      return { playerId, resumeToken };
    }
    return {};
  } catch (_err) {
    return {};
  }
};

export const clearInviteTokenFromUrl = (href?: string) => {
  if (typeof window === "undefined") return;
  const currentHref = href ?? window.location.href;
  try {
    const url = new URL(currentHref);
    url.searchParams.delete("gt");
    url.searchParams.delete("st");
    url.searchParams.delete("viewerRole");
    url.searchParams.delete("playerToken");
    url.searchParams.delete("spectatorToken");
    url.searchParams.delete("rt");
    url.searchParams.delete("resumeToken");
    url.searchParams.delete("connectionGroupId");
    url.searchParams.delete("cid");
    url.searchParams.delete("token");
    url.searchParams.delete("role");
    url.searchParams.delete("playerId");
    window.history.replaceState({}, "", url.toString());
  } catch (_err) {}
};

const tokenKey = (sessionId: string) => `${TOKEN_STORAGE_PREFIX}${sessionId}`;
const pendingHostKey = (sessionId: string) => `${PENDING_HOST_PREFIX}${sessionId}`;
const roomUnavailableKey = (sessionId: string) =>
  `${ROOM_UNAVAILABLE_PREFIX}${sessionId}`;

export const readRoomTokensFromStorage = (
  sessionId: string
): RoomTokensPayload | null => {
  if (!sessionId) return null;
  try {
    const raw = storage.getItem(tokenKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const payload: RoomTokensPayload = {};
    if (typeof parsed.playerToken === "string") payload.playerToken = parsed.playerToken;
    if (typeof parsed.spectatorToken === "string") payload.spectatorToken = parsed.spectatorToken;
    if (typeof parsed.resumeToken === "string") payload.resumeToken = parsed.resumeToken;
    return payload.playerToken || payload.spectatorToken || payload.resumeToken
      ? payload
      : null;
  } catch (_err) {
    return null;
  }
};

export const writeRoomTokensToStorage = (
  sessionId: string,
  tokens: RoomTokensPayload | null
) => {
  if (!sessionId) return;
  if (!tokens || (!tokens.playerToken && !tokens.spectatorToken && !tokens.resumeToken)) {
    storage.removeItem(tokenKey(sessionId));
    return;
  }
  const payload: RoomTokensPayload = {};
  if (tokens.playerToken) payload.playerToken = tokens.playerToken;
  if (tokens.spectatorToken) payload.spectatorToken = tokens.spectatorToken;
  if (tokens.resumeToken) payload.resumeToken = tokens.resumeToken;
  try {
    storage.setItem(tokenKey(sessionId), JSON.stringify(payload));
  } catch (_err) {}
};

export const markRoomAsHostPending = (sessionId: string) => {
  if (!sessionId) return;
  try {
    storage.setItem(pendingHostKey(sessionId), "1");
  } catch (_err) {}
};

export const isRoomHostPending = (sessionId: string): boolean => {
  if (!sessionId) return false;
  try {
    return storage.getItem(pendingHostKey(sessionId)) === "1";
  } catch (_err) {
    return false;
  }
};

export const clearRoomHostPending = (sessionId: string) => {
  if (!sessionId) return;
  try {
    storage.removeItem(pendingHostKey(sessionId));
  } catch (_err) {}
};

export const markRoomUnavailable = (sessionId: string) => {
  if (!sessionId) return;
  try {
    storage.setItem(roomUnavailableKey(sessionId), "1");
  } catch (_err) {}
};

export const isRoomUnavailable = (sessionId: string): boolean => {
  if (!sessionId) return false;
  try {
    return storage.getItem(roomUnavailableKey(sessionId)) === "1";
  } catch (_err) {
    return false;
  }
};

export const clearRoomUnavailable = (sessionId: string) => {
  if (!sessionId) return;
  try {
    storage.removeItem(roomUnavailableKey(sessionId));
  } catch (_err) {}
};

export const mergeRoomTokens = (
  base: RoomTokensPayload | null,
  update: RoomTokensPayload | null
): RoomTokensPayload | null => {
  if (!base && !update) return null;
  const next = { ...(base ?? {}), ...(update ?? {}) };
  return next.playerToken || next.spectatorToken || next.resumeToken ? next : null;
};
