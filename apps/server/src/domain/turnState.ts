import type { Player } from "@mtg/shared/types/players";
import { resolveActiveTurnPlayerId } from "@mtg/shared/turns";

import type { Maps } from "./types";
import { readPlayer } from "./yjsStore";

export const readTurnOrder = (maps: Maps) =>
  maps.playerOrder
    .toArray()
    .filter((id): id is string => typeof id === "string" && Boolean(readPlayer(maps, id)));

export const readTurnPlayers = (maps: Maps, order: readonly string[]) =>
  Object.fromEntries(order.map((id) => [id, readPlayer(maps, id)])) as Record<string, Player | null>;

export const repairActiveTurn = (maps: Maps): string | null => {
  const order = readTurnOrder(maps);
  const players = readTurnPlayers(maps, order);
  const stored = maps.meta.get("activePlayerId");
  const current = typeof stored === "string" ? stored : null;
  const active = resolveActiveTurnPlayerId(order, players, current);
  if (active !== stored) maps.meta.set("activePlayerId", active);
  return active;
};
