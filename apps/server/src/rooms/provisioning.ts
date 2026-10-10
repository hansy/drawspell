import { ORIGINS } from "@mtg/shared/constants/hosts";
import { parseCreateRoomRequest, type CreateRoomRequest, type CreateRoomResponse, type ProvisionRoomRequest } from '@mtg/shared/api/rooms';
import type { RoomTokens } from '../domain/types';

export const ROOM_PROVISION_METADATA_KEY = 'roomProvision:v1';
export const ROOM_SETTINGS_KEY = 'roomSettings:v1';
export const PRELOAD_ATTEMPTS_KEY = 'roomPreloadAttempts:v1';
export type ProvisionMetadata = {
  creationId: string;
  activationExpiresAt: number;
  activatedAt?: number;
  request: CreateRoomRequest;
  tokens: RoomTokens;
  assignments: Array<{ assignmentId: string; token: string; externalId: string; deck?: { decklist: string; bracket?: number } }>;
};
export const provisionResponse = (roomId: string, origin: string, metadata: ProvisionMetadata): CreateRoomResponse => {
  const url = (name: string, token: string) => {
    const result = new URL(`/rooms/${roomId}`, origin);
    result.searchParams.set(name, token);
    return result.toString();
  };
  return {
    roomId,
    spectatorsEnabled: metadata.request.spectatorsEnabled,
    activationExpiresAt: new Date(metadata.activationExpiresAt).toISOString(),
    playerInviteUrl: url('gt', metadata.tokens.playerToken),
    ...(metadata.tokens.spectatorToken ? { spectatorInviteUrl: url('st', metadata.tokens.spectatorToken) } : {}),
    players: metadata.assignments.map(assignment => ({ externalId: assignment.externalId, joinUrl: url('invite', assignment.token) })),
  };
};
export const isProvisionRequest = (value: unknown): value is ProvisionRoomRequest => {
  if (!value || typeof value !== 'object') return false;
  const v = value as ProvisionRoomRequest;
  if (typeof v.roomId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(v.roomId) || typeof v.creationId !== 'string' || !v.creationId || v.creationId.length > 256 || !Number.isSafeInteger(v.activationExpiresAt)) return false;
  return parseCreateRoomRequest(v.request) !== null;
};
export class ProvisionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const parseBearerToken = (headerValue: string | null) => {
  if (!headerValue) return null;
  const [scheme, ...rest] = headerValue.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer") return null;
  return rest.join(" ").trim() || null;
};

export const resolveDrawspellWebOrigin = (env: Pick<Env, "NODE_ENV">): string | null =>
  ORIGINS[env.NODE_ENV as keyof typeof ORIGINS]?.web ?? null;

export const resolveErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "unknown";
};
