export type PeerCounts = {
  total: number;
  players: number;
  spectators: number;
};

type PeerRole = "player" | "spectator";
type PeerClientState = {
  id?: string;
  role?: string;
};
type PeerAwarenessState = {
  client?: PeerClientState;
};

const EMPTY_PEER_COUNTS: PeerCounts = {
  total: 1,
  players: 1,
  spectators: 0,
};

const getPeerRole = (state: PeerAwarenessState | null | undefined): PeerRole =>
  state?.client?.role === "spectator" ? "spectator" : "player";

const getPeerKey = (
  state: PeerAwarenessState | null | undefined,
  clientId: number
) => {
  const userId = state?.client?.id;
  return typeof userId === "string" ? `u:${userId}` : `c:${clientId}`;
};

const shouldTrackRole = (existing: PeerRole | undefined, next: PeerRole) =>
  !existing || (existing === "spectator" && next === "player");

export const computePeerCounts = (
  states: ReadonlyMap<number, PeerAwarenessState | null | undefined>
): PeerCounts => {
  const unique = new Map<string, PeerRole>();

  states.forEach((state, clientId) => {
    const role = getPeerRole(state);
    const key = getPeerKey(state, clientId);
    if (shouldTrackRole(unique.get(key), role)) {
      unique.set(key, role);
    }
  });

  if (unique.size === 0) {
    return { ...EMPTY_PEER_COUNTS };
  }

  let players = 0;
  let spectators = 0;
  unique.forEach((role) => {
    if (role === "spectator") spectators += 1;
    else players += 1;
  });

  return { total: unique.size, players, spectators };
};
