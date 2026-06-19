import type { Player } from "@/types";
import { normalizeLibraryTopRevealMode } from "@mtg/shared/types/players";
import { MAX_PLAYER_LIFE, MIN_PLAYER_LIFE } from "@/lib/limits";

import { MAX_NAME_LENGTH } from "../sanitizeLimits";

import { sanitizeCounters } from "./counters";
import { clampNumber } from "./utils";

export const sanitizePlayer = (value: unknown): Player | null => {
  const rawPlayer = value as Record<string, unknown>;
  if (!rawPlayer || typeof rawPlayer.id !== "string") return null;
  const id = rawPlayer.id;
  const name =
    typeof rawPlayer.name === "string" && rawPlayer.name.trim().length
      ? rawPlayer.name.slice(0, MAX_NAME_LENGTH)
      : `Player ${id.slice(0, 4)}`;
  const commanderDamage: Record<string, number> = {};
  if (rawPlayer.commanderDamage && typeof rawPlayer.commanderDamage === "object") {
    Object.entries(rawPlayer.commanderDamage).forEach(([pid, dmg]) => {
      if (typeof pid === "string") {
        commanderDamage[pid] = clampNumber(dmg, 0, 999, 0);
      }
    });
  }
  const libraryTopReveal = normalizeLibraryTopRevealMode(
    rawPlayer.libraryTopReveal,
  );
  const handCount =
    typeof rawPlayer.handCount === "number"
      ? clampNumber(rawPlayer.handCount, 0, 999, 0)
      : undefined;
  const libraryCount =
    typeof rawPlayer.libraryCount === "number"
      ? clampNumber(rawPlayer.libraryCount, 0, 999, 0)
      : undefined;
  const sideboardCount =
    typeof rawPlayer.sideboardCount === "number"
      ? clampNumber(rawPlayer.sideboardCount, 0, 999, 0)
      : undefined;
  const cursor = rawPlayer.cursor as { x?: unknown; y?: unknown } | undefined;
  return {
    id,
    name,
    life: clampNumber(rawPlayer.life, MIN_PLAYER_LIFE, MAX_PLAYER_LIFE, 40),
    color: typeof rawPlayer.color === "string" ? rawPlayer.color.slice(0, 16) : undefined,
    cursor:
      cursor &&
      typeof cursor.x === "number" &&
      typeof cursor.y === "number"
        ? { x: cursor.x, y: cursor.y }
        : undefined,
    counters: sanitizeCounters(rawPlayer.counters),
    commanderDamage,
    commanderTax: clampNumber(rawPlayer.commanderTax, 0, 99, 0),
    deckLoaded: Boolean(rawPlayer.deckLoaded),
    handCount,
    libraryCount,
    sideboardCount,
    libraryTopReveal,
  };
};

export const sanitizePlayerOrder = (
  value: unknown,
  players: Record<string, Player>,
  max: number
): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();
  const source = Array.isArray(value) ? value : [];
  for (const id of source) {
    if (typeof id !== "string") continue;
    if (!players[id]) continue;
    if (seen.has(id)) continue;
    result.push(id);
    seen.add(id);
    if (result.length >= max) return result;
  }
  const remaining = Object.keys(players).sort();
  for (const id of remaining) {
    if (seen.has(id)) continue;
    result.push(id);
    if (result.length >= max) break;
  }
  return result;
};
