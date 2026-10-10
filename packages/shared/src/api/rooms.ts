import { MAX_ROOM_PLAYERS } from "../constants/room";

export const CREATE_ROOM_PATH = "/api/v1/rooms";
export const ROOM_PROVISION_PATH = "/internal/rooms";
export const ROOM_PROVISION_STATUS_PATH = "/internal/rooms/status";
export const MAX_CREATE_ROOM_BYTES = 160 * 1024;
export const MAX_DECKLIST_BYTES = 32 * 1024;
export const ROOM_ACTIVATION_TTL_MS = 10 * 60_000;
export const ROOM_IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;

export type PreloadedDeck = { decklist: string; bracket?: number };
export type RoomPlayerAssignment = { externalId: string; deck?: PreloadedDeck };
export type CreateRoomRequest = {
  spectatorsEnabled: boolean;
  players: RoomPlayerAssignment[];
};
export type CreateRoomResponse = {
  roomId: string;
  spectatorsEnabled: boolean;
  activationExpiresAt: string;
  playerInviteUrl: string;
  spectatorInviteUrl?: string;
  players: Array<{ externalId: string; joinUrl: string }>;
};
export type ProvisionRoomRequest = {
  roomId: string;
  creationId: string;
  activationExpiresAt: number;
  request: CreateRoomRequest;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const encoder = new TextEncoder();

/** Normalizes request defaults without interpreting card names or deck legality. */
export const parseCreateRoomRequest = (value: unknown): CreateRoomRequest | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["spectatorsEnabled", "players"])) return null;
  if (value.spectatorsEnabled !== undefined && typeof value.spectatorsEnabled !== "boolean") return null;
  const rawPlayers = value.players ?? [];
  if (!Array.isArray(rawPlayers) || rawPlayers.length > MAX_ROOM_PLAYERS || value.players === null) return null;
  const externalIds = new Set<string>();
  const players: RoomPlayerAssignment[] = [];
  for (const player of rawPlayers) {
    if (!isRecord(player) || !hasOnlyKeys(player, ["externalId", "deck"])) return null;
    if (typeof player.externalId !== "string" || !player.externalId.trim() || player.externalId.length > 128) return null;
    const externalId = player.externalId.trim();
    if (externalIds.has(externalId)) return null;
    externalIds.add(externalId);
    if (player.deck === undefined) {
      players.push({ externalId });
      continue;
    }
    const deck = player.deck;
    if (!isRecord(deck) || !hasOnlyKeys(deck, ["decklist", "bracket"])) return null;
    if (typeof deck.decklist !== "string" || encoder.encode(deck.decklist).byteLength > MAX_DECKLIST_BYTES) return null;
    if (deck.bracket !== undefined && (typeof deck.bracket !== "number" || !Number.isInteger(deck.bracket) || deck.bracket < 1 || deck.bracket > 5)) return null;
    players.push({ externalId, deck: { decklist: deck.decklist, ...(deck.bracket !== undefined ? { bracket: deck.bracket } : {}) } });
  }
  return { spectatorsEnabled: value.spectatorsEnabled ?? true, players };
};
