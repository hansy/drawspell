import type { DiscordRoomInternalProvisionPayload, DiscordRoomInternalProvisionResponse } from "@mtg/shared/discord/provisioning";
import type { ProvisionRoomRequest } from "@mtg/shared/api/rooms";
import { ROOM_PROVISION_METADATA_KEY, ROOM_SETTINGS_KEY, PRELOAD_ATTEMPTS_KEY, ProvisionError, type ProvisionMetadata } from "../rooms/provisioning";
import type {
  DiscordRoomInviteMetadata,
  IntentConnectionState,
  RoomTokens,
} from "../domain/types";
import {
  DISCORD_INVITE_METADATA_KEY,
  PLAYER_LEAVE_TOKENS_KEY,
  PLAYER_RESUME_TOKENS_KEY,
  ROOM_TOKENS_KEY,
} from "../domain/constants";
import {
  type AuthRejectReason,
  resolveConnectionAuth,
} from "./auth";

export type ConnectionAuthWithResumeResult =
  | {
      ok: true;
      resolvedRole: "player" | "spectator";
      playerId?: string;
      token?: string;
      tokens: RoomTokens | null;
      resumed: boolean;
    }
  | {
      ok: false;
      reason: AuthRejectReason;
    };

export type PlayerResumeTokenEntry = {
  token: string;
  expiresAt: number;
};

export type PlayerResumeTokens = Record<string, PlayerResumeTokenEntry>;
export type PlayerLeaveTokens = Record<string, string>;

type RoomAdmissionStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<unknown>;
};

type RoomAdmissionOptions = {
  storage: RoomAdmissionStorage;
  resumeTokenTtlMs: number;
  generateToken?: () => string;
  now?: () => number;
  onDiscordInviteActivationError?: (error: unknown) => void;
};

const defaultGenerateToken = () => crypto.randomUUID();

const isDiscordRoomInviteMetadata = (
  value: unknown,
): value is DiscordRoomInviteMetadata => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === "discord" &&
    typeof record.interactionId === "string" &&
    record.interactionId.trim().length > 0 &&
    typeof record.inviteExpiresAt === "number" &&
    Number.isFinite(record.inviteExpiresAt)
  );
};

const hasInviteActivated = (metadata: DiscordRoomInviteMetadata): boolean =>
  typeof metadata.inviteActivatedAt === "number" &&
  Number.isFinite(metadata.inviteActivatedAt) &&
  metadata.inviteActivatedAt > 0;

export class RoomAdmission {
  private roomTokens: RoomTokens | null = null;
  private initialization: Promise<unknown> = Promise.resolve();
  private preloadMutation: Promise<unknown> = Promise.resolve();
  private playerResumeTokens: PlayerResumeTokens | null = null;
  private playerResumeTokensMutation: Promise<void> = Promise.resolve();
  private playerLeaveTokens: PlayerLeaveTokens | null = null;
  private playerLeaveTokensMutation: Promise<void> = Promise.resolve();
  private storage: RoomAdmissionStorage;
  private resumeTokenTtlMs: number;
  private generateToken: () => string;
  private now: () => number;
  private onDiscordInviteActivationError?: (error: unknown) => void;

  constructor(options: RoomAdmissionOptions) {
    this.storage = options.storage;
    this.resumeTokenTtlMs = options.resumeTokenTtlMs;
    this.generateToken = options.generateToken ?? defaultGenerateToken;
    this.now = options.now ?? Date.now;
    this.onDiscordInviteActivationError = options.onDiscordInviteActivationError;
  }

  get roomTokensSnapshot(): RoomTokens | null {
    return this.roomTokens;
  }

  set roomTokensSnapshot(tokens: RoomTokens | null) {
    this.roomTokens = tokens;
  }

  get playerResumeTokensSnapshot(): PlayerResumeTokens | null {
    return this.playerResumeTokens;
  }

  clearCache() {
    this.roomTokens = null;
    this.playerResumeTokens = null;
    this.playerResumeTokensMutation = Promise.resolve();
    this.playerLeaveTokens = null;
    this.playerLeaveTokensMutation = Promise.resolve();
  }

  async loadRoomTokens(): Promise<RoomTokens | null> {
    if (this.roomTokens) return this.roomTokens;
    const provision = await this.storage.get<ProvisionMetadata>(ROOM_PROVISION_METADATA_KEY);
    const legacy = await this.storage.get<DiscordRoomInviteMetadata & { tokens?: RoomTokens }>(DISCORD_INVITE_METADATA_KEY);
    const stored = provision?.tokens ?? legacy?.tokens ?? await this.storage.get<RoomTokens>(ROOM_TOKENS_KEY);
    if (
      stored &&
      typeof stored.playerToken === "string" &&
      (stored.spectatorToken === undefined || typeof stored.spectatorToken === "string")
    ) {
      this.roomTokens = stored;
      return stored;
    }
    return null;
  }

  private serializeInitialization<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.initialization.then(operation);
    this.initialization = pending.catch(() => undefined);
    return pending;
  }

  async spectatorsEnabled(): Promise<boolean> {
    const provision = await this.storage.get<ProvisionMetadata>(ROOM_PROVISION_METADATA_KEY);
    if (provision) return provision.request.spectatorsEnabled;
    const settings = await this.storage.get<{ spectatorsEnabled: boolean }>(ROOM_SETTINGS_KEY);
    return settings?.spectatorsEnabled !== false;
  }

  async ensureRoomTokens(): Promise<RoomTokens> {
    return this.serializeInitialization(async () => {
      const provision = await this.storage.get<ProvisionMetadata>(ROOM_PROVISION_METADATA_KEY);
      if (provision) {
        this.roomTokens = provision.tokens;
        return provision.tokens;
      }
      const existing = await this.loadRoomTokens();
      if (existing) return existing;
      const spectatorsEnabled = await this.spectatorsEnabled();
      const generated = {
        playerToken: this.generateToken(),
        ...(spectatorsEnabled ? { spectatorToken: this.generateToken() } : {}),
      };
      await this.storage.put(ROOM_SETTINGS_KEY, { spectatorsEnabled });
      await this.storage.put(ROOM_TOKENS_KEY, generated);
      this.roomTokens = generated;
      return generated;
    });
  }

  async provisionLegacyDiscord(
    roomId: string,
    payload: DiscordRoomInternalProvisionPayload,
  ): Promise<DiscordRoomInternalProvisionResponse> {
    return this.serializeInitialization(async () => {
      if (await this.storage.get(ROOM_PROVISION_METADATA_KEY)) {
        throw new ProvisionError(409, "Room already exists");
      }
      const raw = await this.storage.get<unknown>(DISCORD_INVITE_METADATA_KEY);
      const existing = isDiscordRoomInviteMetadata(raw) ? raw : null;
      if (existing && existing.interactionId !== payload.interactionId) {
        throw new ProvisionError(409, "Room creation conflicts with existing room");
      }
      if (!existing && (await this.loadRoomTokens() || await this.storage.get(ROOM_SETTINGS_KEY))) {
        throw new ProvisionError(409, "Room already exists");
      }
      if (!existing && this.now() >= payload.inviteExpiresAt) {
        throw new ProvisionError(410, "Room invitation expired");
      }
      const tokens = await this.loadRoomTokens() ?? {
        playerToken: this.generateToken(),
        spectatorToken: this.generateToken(),
      };
      if (!existing) {
        const metadata: DiscordRoomInviteMetadata & { tokens: RoomTokens } = {
          source: "discord", interactionId: payload.interactionId,
          inviteExpiresAt: payload.inviteExpiresAt,
          createdByDiscordUserId: payload.invokerDiscordUserId,
          participantDiscordUserIds: payload.participantDiscordUserIds,
          guildId: payload.guildId, channelId: payload.channelId, tokens,
        };
        // Persist credentials with legacy metadata too, so a failed second write
        // cannot change invitations during a compatibility-route retry.
        await this.storage.put(DISCORD_INVITE_METADATA_KEY, metadata);
      }
      this.roomTokens = tokens;
      await this.storage.put(ROOM_TOKENS_KEY, tokens);
      return {
        roomId, playerToken: tokens.playerToken,
        expiresAt: existing?.inviteExpiresAt ?? payload.inviteExpiresAt,
        alreadyProvisioned: Boolean(existing),
      };
    });
  }

  async provision(payload: ProvisionRoomRequest): Promise<ProvisionMetadata> {
    return this.serializeInitialization(async () => {
      const existing = await this.storage.get<ProvisionMetadata>(ROOM_PROVISION_METADATA_KEY);
      if (existing) {
        if (existing.creationId !== payload.creationId || existing.activationExpiresAt !== payload.activationExpiresAt || JSON.stringify(existing.request) !== JSON.stringify(payload.request)) {
          throw new ProvisionError(409, "Room creation conflicts with existing room");
        }
        if (!existing.activatedAt && this.now() >= existing.activationExpiresAt) throw new ProvisionError(410, "Room invitation expired");
        return existing;
      }
      if (this.now() >= payload.activationExpiresAt) throw new ProvisionError(410, "Room invitation expired");
      if (await this.loadRoomTokens() || await this.storage.get(ROOM_SETTINGS_KEY) || await this.storage.get(DISCORD_INVITE_METADATA_KEY)) {
        throw new ProvisionError(409, "Room already exists");
      }
      const metadata: ProvisionMetadata = {
        creationId: payload.creationId,
        activationExpiresAt: payload.activationExpiresAt,
        request: payload.request,
        tokens: {
          playerToken: this.generateToken(),
          ...(payload.request.spectatorsEnabled ? { spectatorToken: this.generateToken() } : {}),
        },
        assignments: payload.request.players.map(player => ({ ...player, assignmentId: this.generateToken(), token: this.generateToken() })),
      };
      // This single durable record owns settings, assignments and tokens, including recovery
      // after a timeout before the compatibility token record has been written.
      await this.storage.put(ROOM_PROVISION_METADATA_KEY, metadata);
      this.roomTokens = metadata.tokens;
      await this.storage.put(ROOM_TOKENS_KEY, metadata.tokens);
      return metadata;
    });
  }

  async provisionExists(creationId: string): Promise<boolean> {
    const metadata = await this.storage.get<ProvisionMetadata>(ROOM_PROVISION_METADATA_KEY);
    return Boolean(metadata && metadata.creationId === creationId && (metadata.activatedAt || this.now() < metadata.activationExpiresAt));
  }

  async takePreload(playerId: string, invite: string | undefined, deckLoaded: boolean) {
    const operation = this.preloadMutation.then(async () => {
      if (!invite) return null;
      const metadata = await this.storage.get<ProvisionMetadata>(ROOM_PROVISION_METADATA_KEY);
      const assignment = metadata?.assignments.find(item => item.token === invite);
      if (!assignment?.deck) return null;
      const attempts = await this.storage.get<Record<string, string>>(PRELOAD_ATTEMPTS_KEY) ?? {};
      if (attempts[playerId]) return null;
      await this.storage.put(PRELOAD_ATTEMPTS_KEY, { ...attempts, [playerId]: assignment.assignmentId });
      return deckLoaded ? null : { assignmentId: assignment.assignmentId, ...assignment.deck };
    });
    this.preloadMutation = operation.catch(() => undefined);
    return operation;
  }

  async clearPendingDiscordInviteState() {
    this.roomTokens = null;
    try {
      await this.storage.delete(DISCORD_INVITE_METADATA_KEY);
    } catch (_err) {}
    try {
      await this.storage.delete(ROOM_TOKENS_KEY);
    } catch (_err) {}
  }

  async evaluateDiscordInviteForJoin(): Promise<
    | { allow: true; pendingInvite: DiscordRoomInviteMetadata | null }
    | { allow: false; reason: AuthRejectReason }
  > {
    const rawMetadata = await this.storage.get<unknown>(
      DISCORD_INVITE_METADATA_KEY,
    );
    if (!isDiscordRoomInviteMetadata(rawMetadata)) {
      return { allow: true, pendingInvite: null };
    }
    if (hasInviteActivated(rawMetadata)) {
      return { allow: true, pendingInvite: null };
    }
    if (this.now() > rawMetadata.inviteExpiresAt) {
      await this.clearPendingDiscordInviteState();
      return { allow: false, reason: "invalid token" };
    }
    return { allow: true, pendingInvite: rawMetadata };
  }

  async activateDiscordInvite(metadata: DiscordRoomInviteMetadata) {
    if (hasInviteActivated(metadata)) return;
    await this.storage.put(DISCORD_INVITE_METADATA_KEY, {
      ...metadata,
      inviteActivatedAt: this.now(),
    });
  }

  normalizePlayerResumeTokens(value: unknown): PlayerResumeTokens | null {
    if (!value || typeof value !== "object") return null;
    const now = this.now();
    const normalized: PlayerResumeTokens = {};
    for (const [playerId, rawEntry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      let token: string | undefined;
      let expiresAt: number | undefined;
      if (typeof rawEntry === "string") {
        token = rawEntry;
        expiresAt = now + this.resumeTokenTtlMs;
      } else if (rawEntry && typeof rawEntry === "object") {
        const entryRecord = rawEntry as Record<string, unknown>;
        token =
          typeof entryRecord.token === "string" ? entryRecord.token : undefined;
        const parsedExpiresAt =
          typeof entryRecord.expiresAt === "number" &&
          Number.isFinite(entryRecord.expiresAt)
            ? entryRecord.expiresAt
            : undefined;
        expiresAt = parsedExpiresAt ?? now + this.resumeTokenTtlMs;
      }
      if (typeof playerId !== "string" || typeof token !== "string") continue;
      const trimmedPlayerId = playerId.trim();
      const trimmedToken = token.trim();
      if (!trimmedPlayerId || !trimmedToken) continue;
      if (!expiresAt || expiresAt <= now) continue;
      normalized[trimmedPlayerId] = {
        token: trimmedToken,
        expiresAt,
      };
    }
    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  async loadPlayerResumeTokens(): Promise<PlayerResumeTokens> {
    if (this.playerResumeTokens) return this.playerResumeTokens;
    const stored = await this.storage.get<unknown>(
      PLAYER_RESUME_TOKENS_KEY,
    );
    const normalized = this.normalizePlayerResumeTokens(stored) ?? {};
    this.playerResumeTokens = normalized;
    return normalized;
  }

  async mutatePlayerResumeTokens<T>(
    mutator: (
      tokens: PlayerResumeTokens,
    ) =>
      | Promise<{ result: T; nextTokens?: PlayerResumeTokens }>
      | { result: T; nextTokens?: PlayerResumeTokens },
  ): Promise<T> {
    const operation = this.playerResumeTokensMutation.then(async () => {
      const tokens = await this.loadPlayerResumeTokens();
      const { result, nextTokens } = await mutator(tokens);
      if (nextTokens) {
        this.playerResumeTokens = nextTokens;
        await this.storage.put(PLAYER_RESUME_TOKENS_KEY, nextTokens);
      }
      return result;
    });
    this.playerResumeTokensMutation = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async ensurePlayerResumeToken(
    playerId: string,
    options?: { rotate?: boolean },
  ): Promise<string> {
    return this.mutatePlayerResumeTokens((tokens) => {
      const rotate = options?.rotate ?? false;
      const now = this.now();
      const normalizedPlayerId = playerId.trim();
      const current = tokens[normalizedPlayerId];
      if (
        current &&
        typeof current.token === "string" &&
        current.token.length > 0 &&
        current.expiresAt > now &&
        !rotate
      ) {
        if (current.expiresAt - now > this.resumeTokenTtlMs / 2) {
          return { result: current.token };
        }
        const refreshed = {
          token: current.token,
          expiresAt: now + this.resumeTokenTtlMs,
        };
        const nextTokens = {
          ...tokens,
          [normalizedPlayerId]: refreshed,
        };
        return { result: refreshed.token, nextTokens };
      }

      const created = this.generateToken();
      const nextTokens = {
        ...tokens,
        [normalizedPlayerId]: {
          token: created,
          expiresAt: now + this.resumeTokenTtlMs,
        },
      };
      return { result: created, nextTokens };
    });
  }

  async validatePlayerResumeToken(
    playerId: string,
    resumeToken: string,
  ): Promise<boolean> {
    const normalizedPlayerId = playerId.trim();
    const normalizedToken = resumeToken.trim();
    if (!normalizedPlayerId || !normalizedToken) return false;
    return this.mutatePlayerResumeTokens((tokens) => {
      const now = this.now();
      const existing = tokens[normalizedPlayerId];
      if (!existing) return { result: false };
      if (existing.expiresAt <= now) {
        const { [normalizedPlayerId]: _expired, ...nextTokens } = tokens;
        return { result: false, nextTokens };
      }
      return { result: existing.token === normalizedToken };
    });
  }

  private async loadPlayerLeaveTokens(): Promise<PlayerLeaveTokens> {
    if (this.playerLeaveTokens) return this.playerLeaveTokens;
    const stored = await this.storage.get<unknown>(PLAYER_LEAVE_TOKENS_KEY);
    const normalized: PlayerLeaveTokens = {};
    if (stored && typeof stored === "object") {
      for (const [playerId, token] of Object.entries(
        stored as Record<string, unknown>,
      )) {
        if (typeof token !== "string") continue;
        const normalizedPlayerId = playerId.trim();
        const normalizedToken = token.trim();
        if (normalizedPlayerId && normalizedToken) {
          normalized[normalizedPlayerId] = normalizedToken;
        }
      }
    }
    this.playerLeaveTokens = normalized;
    return normalized;
  }

  private async mutatePlayerLeaveTokens<T>(
    mutator: (tokens: PlayerLeaveTokens) => {
      result: T;
      nextTokens?: PlayerLeaveTokens;
    },
  ): Promise<T> {
    const operation = this.playerLeaveTokensMutation.then(async () => {
      const tokens = await this.loadPlayerLeaveTokens();
      const { result, nextTokens } = mutator(tokens);
      if (nextTokens) {
        this.playerLeaveTokens = nextTokens;
        await this.storage.put(PLAYER_LEAVE_TOKENS_KEY, nextTokens);
      }
      return result;
    });
    this.playerLeaveTokensMutation = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async ensurePlayerLeaveToken(
    playerId: string,
    options?: { rotate?: boolean },
  ): Promise<string> {
    const normalizedPlayerId = playerId.trim();
    return this.mutatePlayerLeaveTokens((tokens) => {
      const existing = tokens[normalizedPlayerId];
      if (existing && !options?.rotate) return { result: existing };
      const created = this.generateToken();
      return {
        result: created,
        nextTokens: { ...tokens, [normalizedPlayerId]: created },
      };
    });
  }

  async validatePlayerLeaveToken(
    playerId: string,
    leaveToken: string,
  ): Promise<boolean> {
    const normalizedPlayerId = playerId.trim();
    const normalizedToken = leaveToken.trim();
    if (!normalizedPlayerId || !normalizedToken) return false;
    const tokens = await this.loadPlayerLeaveTokens();
    return tokens[normalizedPlayerId] === normalizedToken;
  }

  async revokePlayerLeaveToken(playerId: string): Promise<void> {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) return;
    await this.mutatePlayerLeaveTokens((tokens) => {
      if (!tokens[normalizedPlayerId]) return { result: undefined };
      const { [normalizedPlayerId]: _removed, ...nextTokens } = tokens;
      return { result: undefined, nextTokens };
    });
  }

  async restorePlayerLeaveToken(
    playerId: string,
    leaveToken?: string,
  ): Promise<void> {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) return;
    const normalizedToken =
      typeof leaveToken === "string" ? leaveToken.trim() : "";
    await this.mutatePlayerLeaveTokens((tokens) => {
      if (!normalizedToken) {
        const { [normalizedPlayerId]: _removed, ...nextTokens } = tokens;
        return { result: undefined, nextTokens };
      }
      return {
        result: undefined,
        nextTokens: { ...tokens, [normalizedPlayerId]: normalizedToken },
      };
    });
  }

  async restorePlayerResumeToken(
    playerId: string,
    resumeToken?: string,
  ): Promise<void> {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) return;
    const normalizedToken =
      typeof resumeToken === "string" ? resumeToken.trim() : "";
    await this.mutatePlayerResumeTokens((tokens) => {
      if (!normalizedToken) {
        const { [normalizedPlayerId]: _removed, ...nextTokens } = tokens;
        return { result: undefined, nextTokens };
      }
      const expiresAt =
        tokens[normalizedPlayerId]?.expiresAt ??
        this.now() + this.resumeTokenTtlMs;
      const nextTokens = {
        ...tokens,
        [normalizedPlayerId]: {
          token: normalizedToken,
          expiresAt,
        },
      };
      return { result: undefined, nextTokens };
    });
  }

  async resolveConnectionAuthWithResume(
    state: IntentConnectionState,
    storedTokens: RoomTokens | null,
    options: { allowTokenCreation: boolean },
  ): Promise<ConnectionAuthWithResumeResult> {
    const provision = await this.serializeInitialization(async () => {
      const current = await this.storage.get<ProvisionMetadata>(ROOM_PROVISION_METADATA_KEY);
      if (!current && !storedTokens && !state.token && !state.invite && state.playerId && state.viewerRole !== "spectator") {
        await this.storage.put(ROOM_SETTINGS_KEY, { spectatorsEnabled: true });
      }
      return current;
    });
    if (provision) storedTokens = provision.tokens;
    const spectatorsEnabled = await this.spectatorsEnabled();
    if (!spectatorsEnabled && (state.viewerRole === "spectator" || (storedTokens?.spectatorToken && state.token === storedTokens.spectatorToken))) {
      return { ok: false, reason: "invalid token" };
    }
    if (provision && !provision.activatedAt && this.now() >= provision.activationExpiresAt) {
      return { ok: false, reason: "invalid token" };
    }
    if (state.invite) {
      if (!provision?.assignments.some(assignment => assignment.token === state.invite)) return { ok: false, reason: "invalid token" };
      state = { ...state, token: provision.tokens.playerToken };
    }
    const inviteGate = await this.evaluateDiscordInviteForJoin();
    if (!inviteGate.allow) {
      return { ok: false, reason: inviteGate.reason };
    }

    const finalizeInviteState = async (
      resultOrPromise:
        | ConnectionAuthWithResumeResult
        | Promise<ConnectionAuthWithResumeResult>,
    ): Promise<ConnectionAuthWithResumeResult> => {
      const result = await resultOrPromise;
      if (!result.ok) return result;
      if (result.resolvedRole === "spectator" && !spectatorsEnabled) return { ok: false, reason: "invalid token" };
      if (result.resolvedRole === "player" && provision && !provision.activatedAt) {
        const activated = await this.serializeInitialization(async () => {
          const current = await this.storage.get<ProvisionMetadata>(ROOM_PROVISION_METADATA_KEY);
          if (!current || current.creationId !== provision.creationId) return false;
          if (!current.activatedAt) {
            if (this.now() >= current.activationExpiresAt) return false;
            await this.storage.put(ROOM_PROVISION_METADATA_KEY, { ...current, activatedAt: this.now() });
          }
          return true;
        });
        if (!activated) return { ok: false, reason: "invalid token" };
      }
      if (!inviteGate.pendingInvite || result.resolvedRole !== "player") return result;
      try {
        await this.activateDiscordInvite(inviteGate.pendingInvite);
      } catch (error) {
        this.onDiscordInviteActivationError?.(error);
        return { ok: false, reason: "invalid token" };
      }
      return result;
    };

    const resolveStandardAuth =
      async (): Promise<ConnectionAuthWithResumeResult> => {
        const auth = await resolveConnectionAuth(
          state,
          storedTokens,
          () => this.ensureRoomTokens(),
          { allowTokenCreation: options.allowTokenCreation },
        );
        return auth.ok ? { ...auth, resumed: false } : auth;
      };

    const resumePlayerId = state.playerId;
    const resumeToken = state.resumeToken;
    const shouldAttemptResume =
      state.viewerRole !== "spectator" &&
      Boolean(resumePlayerId && resumeToken);
    if (shouldAttemptResume && resumePlayerId && resumeToken) {
      const canResume = await this.validatePlayerResumeToken(
        resumePlayerId,
        resumeToken,
      );
      if (!canResume) {
        return state.token
          ? finalizeInviteState(resolveStandardAuth())
          : { ok: false, reason: "invalid token" };
      }
      let activeTokens = storedTokens;
      if (!activeTokens && options.allowTokenCreation) {
        activeTokens = await this.ensureRoomTokens();
      }
      return finalizeInviteState({
        ok: true,
        resolvedRole: "player",
        playerId: resumePlayerId,
        token: activeTokens?.playerToken,
        tokens: activeTokens ?? null,
        resumed: true,
      });
    }
    return finalizeInviteState(resolveStandardAuth());
  }
}
