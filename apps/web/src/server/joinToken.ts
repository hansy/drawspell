import { createServerFn } from "@tanstack/react-start";
import { ORIGINS } from "@mtg/shared/constants/hosts";
import { createJoinToken } from "@mtg/shared/security/joinToken";

type JoinTokenRequest = {
  roomId: string;
};

type JoinTokenResponse = {
  token: string;
  exp: number;
};

const JOIN_TOKEN_TTL_MS = 5 * 60_000;
const viteEnv = import.meta.env.VITE_ENV;
const origins = ORIGINS[viteEnv as keyof typeof ORIGINS];

if (!origins) {
  throw new Error(`Unsupported VITE_ENV: ${viteEnv}`);
}

const joinTokenValidator = (input: JoinTokenRequest) => input;

const normalizeOrigin = (value: string | undefined) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch (_err) {
    return null;
  }
};

const isOriginAllowed = (
  origin: string | null,
  allowedOrigin: string | null,
) => {
  if (!allowedOrigin) return false;
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return normalized === allowedOrigin;
};

export const getJoinToken = createServerFn({ method: "POST" })
  .inputValidator(joinTokenValidator)
  .handler(async (ctx): Promise<JoinTokenResponse> => {
    try {
      const payload = ctx.data;
      const roomId = payload?.roomId?.trim();
      if (!roomId) {
        console.error("[joinToken] missing room");
        throw new Error("missing room");
      }

      const env = process.env;
      const request = (ctx as { request?: Request }).request;
      const origin = request?.headers?.get("Origin") ?? null;
      const allowedOrigin = normalizeOrigin(origins.web);
      if (!isOriginAllowed(origin, allowedOrigin)) {
        console.error("[joinToken] origin not allowed", { origin, roomId });
        throw new Error("origin not allowed");
      }

      const secret = env.JOIN_TOKEN_SECRET;
      if (!secret) {
        console.error("[joinToken] secret missing", {
          roomId,
          hasContextEnv: Boolean(env),
        });
        throw new Error("join token secret missing");
      }
      const exp = Date.now() + JOIN_TOKEN_TTL_MS;
      const token = await createJoinToken({ roomId, exp }, secret);

      return { token, exp };
    } catch (error) {
      console.error("[joinToken] error", {
        message:
          typeof error === "string"
            ? error
            : typeof error === "object" && error && "message" in error
              ? String((error as { message?: unknown }).message)
              : "unknown",
      });
      throw error;
    }
  });
