import type {
  DiscordRoomInviteMetadata,
  IntentConnectionState,
  RoomTokens,
} from "../domain/types";
import {
  DISCORD_INVITE_METADATA_KEY,
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
  private playerResumeTokens: PlayerResumeTokens | null = null;
  private playerResumeTokensMutation: Promise<void> = Promise.resolve();
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
  }

  async loadRoomTokens(): Promise<RoomTokens | null> {
    if (this.roomTokens) return this.roomTokens;
    const stored = await this.storage.get<RoomTokens>(ROOM_TOKENS_KEY);
    if (
      stored &&
      typeof stored.playerToken === "string" &&
      typeof stored.spectatorToken === "string"
    ) {
      this.roomTokens = stored;
      return stored;
    }
    return null;
  }

  async ensureRoomTokens(): Promise<RoomTokens> {
    const existing = await this.loadRoomTokens();
    if (existing) return existing;
    const generated = {
      playerToken: this.generateToken(),
      spectatorToken: this.generateToken(),
    };
    this.roomTokens = generated;
    await this.storage.put(ROOM_TOKENS_KEY, generated);
    return generated;
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
      if (!result.ok || !inviteGate.pendingInvite) return result;
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
