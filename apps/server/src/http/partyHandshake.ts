import { ORIGINS } from "@mtg/shared/constants/hosts";
import { verifyJoinToken } from "@mtg/shared/security/joinToken";

const JOIN_TOKEN_MAX_SKEW_MS = 30_000;

const normalizeOrigin = (value: string | undefined) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch (_error) {
    return null;
  }
};

const isOriginAllowed = (origin: string | null, allowedOrigin: string | null) => {
  if (!allowedOrigin) return false;
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return normalized === allowedOrigin;
};

const isDefaultPortForProtocol = (port: number, protocol: string) => {
  if (protocol === "https:" || protocol === "wss:") return port === 443;
  if (protocol === "http:" || protocol === "ws:") return port === 80;
  return false;
};

const isHostAllowed = (
  hostHeader: string | null,
  url: URL,
  allowedHost: string | null,
) => {
  if (!allowedHost) return false;
  if (!hostHeader) return false;
  const host = hostHeader.split(",")[0]?.trim().toLowerCase();
  if (!host) return false;
  if (host === allowedHost) return true;

  const [hostname, portRaw] = host.split(":");
  if (!hostname || !portRaw) return false;
  if (hostname !== allowedHost) return false;

  const port = Number(portRaw);
  if (!Number.isFinite(port)) return false;
  return isDefaultPortForProtocol(port, url.protocol);
};

const normalizeHostFromOrigin = (value: string | undefined): string | null => {
  const origin = normalizeOrigin(value ?? "");
  if (!origin) return null;

  try {
    return new URL(origin).host.toLowerCase();
  } catch (_error) {
    return null;
  }
};

const getPartyRequestInfo = (url: URL) => {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 3) return null;
  if (parts[0] !== "parties") return null;
  return { roomId: parts[2] };
};

export const validatePartyHandshake = async (
  request: Request,
  env: Pick<Env, "JOIN_TOKEN_SECRET"> & Partial<Pick<Env, "NODE_ENV">>,
  url: URL,
): Promise<Response | null> => {
  const info = getPartyRequestInfo(url);
  if (!info) return null;

  const origins = ORIGINS[env.NODE_ENV as keyof typeof ORIGINS];
  if (!origins) {
    return new Response("Drawspell environment not configured", {
      status: 500,
    });
  }

  const origin = request.headers.get("Origin");
  const allowedOrigin = normalizeOrigin(origins.web);
  if (!isOriginAllowed(origin, allowedOrigin)) {
    return new Response("Origin not allowed", { status: 403 });
  }

  const host = request.headers.get("Host") ?? url.host;
  const allowedHost = normalizeHostFromOrigin(origins.server);
  if (!isHostAllowed(host, url, allowedHost)) {
    return new Response("Host not allowed", { status: 403 });
  }

  const joinToken = url.searchParams.get("jt");
  if (!joinToken) {
    return new Response("Missing join token", { status: 403 });
  }
  if (!env.JOIN_TOKEN_SECRET) {
    return new Response("Join token not configured", { status: 500 });
  }

  const result = await verifyJoinToken(joinToken, env.JOIN_TOKEN_SECRET, {
    now: Date.now(),
    maxSkewMs: JOIN_TOKEN_MAX_SKEW_MS,
  });
  if (!result.ok || result.payload.roomId !== info.roomId) {
    return new Response("Invalid join token", { status: 403 });
  }

  return null;
};
