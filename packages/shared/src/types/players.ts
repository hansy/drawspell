import type { PlayerId } from "./ids";
import type { Counter } from "./counters";

export const MANA_TYPES = ["W", "U", "B", "R", "G", "C"] as const;
export const MAX_FLOATING_MANA_PER_TYPE = 99;

export type ManaType = (typeof MANA_TYPES)[number];
export type ManaPool = Partial<Record<ManaType, number>>;

export const isManaType = (value: unknown): value is ManaType =>
  typeof value === "string" && MANA_TYPES.includes(value as ManaType);

export const normalizeManaAmount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(
    MAX_FLOATING_MANA_PER_TYPE,
    Math.max(0, Math.trunc(value)),
  );
};

export const normalizeManaPool = (value: unknown): ManaPool => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const pool: ManaPool = {};
  MANA_TYPES.forEach((manaType) => {
    const amount = normalizeManaAmount(record[manaType]);
    if (amount > 0) pool[manaType] = amount;
  });
  return pool;
};

type LegacyLibraryTopRevealMode = "self" | "others" | "all";

export type LibraryTopReveal = {
  toAll?: boolean;
  to?: PlayerId[];
};

export type LibraryTopRevealMode =
  | LegacyLibraryTopRevealMode
  | LibraryTopReveal;

const isLegacyLibraryTopRevealMode = (
  value: unknown,
): value is LegacyLibraryTopRevealMode =>
  value === "self" || value === "others" || value === "all";

const isLibraryTopRevealObject = (
  value: unknown,
): value is LibraryTopReveal =>
  Boolean(value) && typeof value === "object";

const uniquePlayerIds = (value: unknown): PlayerId[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter((entry): entry is PlayerId => typeof entry === "string"),
    ),
  );
};

const normalizeLibraryTopRevealObject = (
  value: unknown,
): LibraryTopReveal | undefined => {
  if (!isLibraryTopRevealObject(value)) return undefined;

  const toAll = value.toAll === true;
  const to = uniquePlayerIds(value.to);

  if (!toAll && to.length === 0) return undefined;
  return {
    ...(toAll ? { toAll: true } : null),
    ...(to.length ? { to } : null),
  };
};

export const isLibraryTopRevealMode = (
  value: unknown,
): value is LibraryTopRevealMode => {
  return (
    isLegacyLibraryTopRevealMode(value) ||
    normalizeLibraryTopRevealObject(value) !== undefined
  );
};

export const normalizeLibraryTopReveal = (
  value: unknown,
): LibraryTopRevealMode | undefined => {
  return isLegacyLibraryTopRevealMode(value)
    ? value
    : normalizeLibraryTopRevealObject(value);
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
  return uniquePlayerIds(reveal.to).includes(playerId);
};

export const libraryTopRevealIsSelfOnly = (
  reveal: LibraryTopRevealMode | null | undefined,
  ownerId: PlayerId,
) => {
  if (!reveal) return false;
  if (reveal === "self") return true;
  if (!isLibraryTopRevealObject(reveal)) return false;
  if (reveal.toAll) return false;
  const selectedIds = uniquePlayerIds(reveal.to ?? []);
  return selectedIds.length === 1 && selectedIds[0] === ownerId;
};

export const libraryTopRevealIsAllPlayers = (
  reveal: LibraryTopRevealMode | null | undefined,
) => {
  if (!reveal) return false;
  if (reveal === "all") return true;
  return isLibraryTopRevealObject(reveal) && reveal.toAll === true;
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
  manaPool?: ManaPool;
}
