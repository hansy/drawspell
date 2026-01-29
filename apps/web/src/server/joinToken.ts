import { createServerFn } from "@tanstack/react-start";
import { createJoinToken } from "@mtg/shared/security/joinToken";

type JoinTokenRequest = {
  roomId: string;
};

type JoinTokenResponse = {
  token: string;
  exp: number;
};

const CLIENT_ALLOWED_ORIGINS = new Set([
  "https://drawspell.space",
  "http://localhost:5173",
]);
const JOIN_TOKEN_TTL_MS = 5 * 60_000;

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch (_err) {
    return null;
  }
};

const isOriginAllowed = (origin: string | null, allowed: Set<string>) => {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return allowed.has(normalized);
};

export const getJoinToken = createServerFn({ method: "POST" }).handler(
  async ({ data, request }): Promise<JoinTokenResponse> => {
    const payload = data as JoinTokenRequest | undefined;
    const roomId = payload?.roomId?.trim();
    if (!roomId) {
      throw new Error("missing room");
    }

    const env = typeof process !== "undefined" ? process.env : {};
    const origin = request?.headers?.get("Origin") ?? null;
    if (!isOriginAllowed(origin, CLIENT_ALLOWED_ORIGINS)) {
      throw new Error("origin not allowed");
    }

    const secret = env.JOIN_TOKEN_SECRET;
    if (!secret) {
      throw new Error("join token secret missing");
    }
    const exp = Date.now() + JOIN_TOKEN_TTL_MS;
    const token = await createJoinToken({ roomId, exp }, secret);
    return { token, exp };
  }
);
