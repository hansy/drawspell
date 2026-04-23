import type { IntentConnectionState, RoomTokens } from "../domain/types";

export type AuthRejectReason = "missing token" | "missing player" | "invalid token";

export type ConnectionAuthResult =
  | {
      ok: true;
      resolvedRole: "player" | "spectator";
      playerId?: string;
      token?: string;
      tokens: RoomTokens | null;
    }
  | {
      ok: false;
      reason: AuthRejectReason;
    };

export type ResolveAuthOptions = {
  allowTokenCreation?: boolean;
};

type ResolvedRole = Extract<ConnectionAuthResult, { ok: true }>["resolvedRole"];

const parseViewerRole = (
  value: string | null | undefined
): IntentConnectionState["viewerRole"] =>
  value === "player" || value === "spectator" ? value : undefined;

export const parseConnectionParams = (url: URL): IntentConnectionState => {
  const playerId = url.searchParams.get("playerId") ?? undefined;
  const userId = url.searchParams.get("uid") ?? undefined;
  const resumeToken =
    url.searchParams.get("rt") ??
    url.searchParams.get("resumeToken") ??
    undefined;
  const connectionGroupId =
    url.searchParams.get("cid") ??
    url.searchParams.get("connectionGroupId") ??
    undefined;
  const spectatorToken = url.searchParams.get("st");
  const playerToken = url.searchParams.get("gt");
  const token = spectatorToken ?? playerToken ?? undefined;
  const viewerRoleParam = url.searchParams.get("viewerRole");
  let viewerRole = parseViewerRole(viewerRoleParam);
  if (spectatorToken) {
    viewerRole = "spectator";
  } else if (playerToken && viewerRole !== "spectator") {
    viewerRole = "player";
  }
  return {
    playerId,
    viewerRole,
    token,
    userId,
    resumeToken,
    connectionGroupId,
  };
};

const resolveRequestedRole = (
  requestedRole: IntentConnectionState["viewerRole"],
  tokenRole: ResolvedRole
): ResolvedRole =>
  tokenRole === "spectator" || requestedRole === "spectator"
    ? "spectator"
    : "player";

const getMissingTokenReason = (
  state: IntentConnectionState,
  storedTokens: RoomTokens | null
): AuthRejectReason | null => {
  if (storedTokens) {
    return "missing token";
  }
  if (state.viewerRole === "spectator") {
    return "missing token";
  }
  if (!state.playerId) {
    return "missing player";
  }
  return null;
};

const createConnectionAuthResult = (
  state: IntentConnectionState,
  resolvedRole: ResolvedRole,
  token: string | undefined,
  tokens: RoomTokens | null
): ConnectionAuthResult => {
  const playerId = resolvedRole === "spectator" ? undefined : state.playerId;
  if (resolvedRole === "player" && !playerId) {
    return { ok: false, reason: "missing player" };
  }

  return {
    ok: true,
    resolvedRole,
    playerId,
    token,
    tokens,
  };
};

export const resolveConnectionAuth = async (
  state: IntentConnectionState,
  storedTokens: RoomTokens | null,
  ensureRoomTokens: () => Promise<RoomTokens>,
  options: ResolveAuthOptions = {}
): Promise<ConnectionAuthResult> => {
  const allowTokenCreation = options.allowTokenCreation ?? false;
  const providedToken = state.token;
  let activeTokens = storedTokens;

  if (!providedToken) {
    const missingReason = getMissingTokenReason(state, storedTokens);
    if (missingReason) {
      return { ok: false, reason: missingReason };
    }
    if (allowTokenCreation) {
      activeTokens = await ensureRoomTokens();
    }
    const resolvedRole = resolveRequestedRole(state.viewerRole, "player");
    return createConnectionAuthResult(
      state,
      resolvedRole,
      allowTokenCreation ? activeTokens?.playerToken : undefined,
      activeTokens ?? null
    );
  }

  if (!activeTokens) {
    activeTokens = await ensureRoomTokens();
  }
  if (
    providedToken !== activeTokens.playerToken &&
    providedToken !== activeTokens.spectatorToken
  ) {
    return { ok: false, reason: "invalid token" };
  }

  const tokenRole =
    activeTokens.spectatorToken === providedToken ? "spectator" : "player";
  const resolvedRole = resolveRequestedRole(state.viewerRole, tokenRole);
  return createConnectionAuthResult(
    state,
    resolvedRole,
    providedToken,
    activeTokens
  );
};
