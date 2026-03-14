import type { PlayerId } from "./ids";
import type { Counter } from "./counters";

type LegacyLibraryTopRevealMode = "self" | "others" | "all";

export type LibraryTopReveal = {
  toAll?: boolean;
  to?: PlayerId[];
};

export type LibraryTopRevealMode =
  | LegacyLibraryTopRevealMode
  | LibraryTopReveal;

const uniquePlayerIds = (value: unknown[]): PlayerId[] =>
  Array.from(
    new Set(
      value.filter((entry): entry is PlayerId => typeof entry === "string"),
    ),
  );

export const isLibraryTopRevealMode = (
  value: unknown,
): value is LibraryTopRevealMode => {
  if (value === "self" || value === "others" || value === "all") return true;
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.toAll === true ||
    (Array.isArray(record.to) &&
      record.to.some((entry) => typeof entry === "string"))
  );
};

export const normalizeLibraryTopReveal = (
  value: unknown,
): LibraryTopRevealMode | undefined => {
  if (value === "self" || value === "others" || value === "all") return value;
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const toAll = record.toAll === true;
  const to = Array.isArray(record.to) ? uniquePlayerIds(record.to) : [];

  if (!toAll && to.length === 0) return undefined;
  return {
    ...(toAll ? { toAll: true } : null),
    ...(to.length ? { to } : null),
  };
};

export const normalizeLibraryTopRevealMode = (
  value: unknown,
): LibraryTopRevealMode | undefined =>
  normalizeLibraryTopReveal(value);

export const libraryTopRevealSelectedIds = (
  reveal: LibraryTopRevealMode | null | undefined,
  ownerId: PlayerId,
  allPlayerIds: PlayerId[],
): PlayerId[] => {
  if (!reveal) return [];
  if (reveal === "self") return allPlayerIds.includes(ownerId) ? [ownerId] : [];
  if (reveal === "others") return allPlayerIds.filter((id) => id !== ownerId);
  if (reveal === "all") return [...allPlayerIds];
  if (reveal.toAll) return [...allPlayerIds];

  return uniquePlayerIds(reveal.to ?? []).filter((id) =>
    allPlayerIds.includes(id),
  );
};

export const buildLibraryTopRevealFromSelectedIds = (
  selectedIds: PlayerId[],
  allPlayerIds: PlayerId[],
): LibraryTopReveal | null => {
  const uniqueSelectedIds = uniquePlayerIds(selectedIds).filter((id) =>
    allPlayerIds.includes(id),
  );
  if (uniqueSelectedIds.length === 0) return null;

  const isAllPlayersSelected =
    allPlayerIds.length > 1 &&
    allPlayerIds.every((id) => uniqueSelectedIds.includes(id));

  if (isAllPlayersSelected) {
    return { toAll: true };
  }

  return { to: uniqueSelectedIds };
};

export const libraryTopRevealIncludesPlayer = (
  reveal: LibraryTopRevealMode | null | undefined,
  playerId: PlayerId | undefined,
  ownerId: PlayerId,
  viewerRole?: "player" | "spectator",
) => {
  if (!playerId || viewerRole === "spectator" || !reveal) return false;
  if (reveal === "self") return playerId === ownerId;
  if (reveal === "others") return playerId !== ownerId;
  if (reveal === "all") return true;
  if (reveal.toAll) return true;
  return Boolean(reveal.to?.includes(playerId));
};

export const libraryTopRevealIsSelfOnly = (
  reveal: LibraryTopRevealMode | null | undefined,
  ownerId: PlayerId,
) => {
  if (!reveal) return false;
  if (reveal === "self") return true;
  if (typeof reveal === "string") return false;
  if (reveal.toAll) return false;
  const selectedIds = uniquePlayerIds(reveal.to ?? []);
  return selectedIds.length === 1 && selectedIds[0] === ownerId;
};

export const libraryTopRevealIsAllPlayers = (
  reveal: LibraryTopRevealMode | null | undefined,
) => {
  if (!reveal) return false;
  if (reveal === "all") return true;
  return typeof reveal === "object" && reveal.toAll === true;
};

export interface Player {
  id: PlayerId;
  name: string;
  life: number;
  color?: string; // Player identity color (shared across clients)
  cursor?: { x: number; y: number }; // For multiplayer presence
  counters: Counter[];
  commanderDamage: Record<PlayerId, number>;
  commanderTax: number;
  deckLoaded?: boolean;
  handCount?: number;
  libraryCount?: number;
  sideboardCount?: number;
  libraryTopReveal?: LibraryTopRevealMode | null;
}
