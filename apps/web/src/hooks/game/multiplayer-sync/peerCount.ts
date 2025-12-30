export type PeerCounts = {
  total: number;
  players: number;
  spectators: number;
};

export const computePeerCounts = (states: Map<number, unknown>): PeerCounts => {
  const unique = new Map<string, "player" | "spectator">();

  states.forEach((state: any, clientId) => {
    const userId = state?.client?.id;
    const role = state?.client?.role === "spectator" ? "spectator" : "player";
    const key = typeof userId === "string" ? `u:${userId}` : `c:${clientId}`;
    const existing = unique.get(key);
    if (!existing || (existing === "spectator" && role === "player")) {
      unique.set(key, role);
    }
  });

  if (unique.size === 0) {
    return { total: 1, players: 1, spectators: 0 };
  }

  let players = 0;
  let spectators = 0;
  unique.forEach((role) => {
    if (role === "spectator") spectators += 1;
    else players += 1;
  });

  return { total: unique.size, players, spectators };
};
