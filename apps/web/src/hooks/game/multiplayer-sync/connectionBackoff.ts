export type BackoffReason = "close" | "room-reset" | "resume";

export type BackoffConfig = {
  baseMs: number;
  maxMs: number;
  maxAttempts: number;
  roomResetMinMs: number;
  roomResetMaxMs: number;
  stableResetMs: number;
};

export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  baseMs: 1000,
  maxMs: 30000,
  maxAttempts: 10, // Stop trying after 10 failed attempts (~5 min total with backoff)
  roomResetMinMs: 5000,
  roomResetMaxMs: 15000,
  stableResetMs: 10000,
};

/**
 * Check if reconnection should be abandoned after too many attempts.
 */
export const shouldAbandonReconnect = (
  attempt: number,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG
): boolean => {
  return attempt >= config.maxAttempts;
};

export const computeBackoffDelay = (
  attempt: number,
  reason: BackoffReason,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG,
  random: () => number = Math.random
) => {
  if (reason === "room-reset") {
    const span = Math.max(0, config.roomResetMaxMs - config.roomResetMinMs);
    return config.roomResetMinMs + Math.floor(random() * span);
  }
  const clampedAttempt = Math.max(0, attempt);
  const maxDelay = Math.min(config.maxMs, config.baseMs * 2 ** clampedAttempt);
  return Math.floor(random() * maxDelay);
};

export const isRoomResetClose = (
  event?: { code?: number; reason?: string } | null
) => {
  if (!event) return false;
  if (event.code === 1013) return true;
  const reason = (event.reason ?? "").trim().replace(/\.$/, "").toLowerCase();
  return reason === "room reset";
};
