// Lightweight permission logger. In the future this can be wired to a UI console or persisted history.
export interface PermissionLogEntry {
  action: string;
  actorId: string;
  allowed: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

const nodeProcessEnv = (() => {
  const maybeProcess = (globalThis as { process?: unknown }).process;
  if (!maybeProcess || typeof maybeProcess !== 'object') return undefined;
  const maybeEnv = (maybeProcess as { env?: unknown }).env;
  if (!maybeEnv || typeof maybeEnv !== 'object') return undefined;
  return maybeEnv as Record<string, unknown>;
})();

const isTestEnv =
  import.meta.env.MODE === 'test' || Boolean(nodeProcessEnv?.VITEST);

const nodeEnv =
  typeof nodeProcessEnv?.NODE_ENV === 'string' ? nodeProcessEnv.NODE_ENV : undefined;

const isDevEnv =
  import.meta.env.DEV === true ||
  (nodeEnv != null && nodeEnv !== 'production');

const ENABLE_PERMISSION_LOGS = isDevEnv && !isTestEnv;

export const logPermission = ({ action, actorId, allowed, reason, details }: PermissionLogEntry) => {
  if (!ENABLE_PERMISSION_LOGS) return;
  const payload = { action, actorId, allowed, reason, ...details };
  if (allowed) {
    console.info('[perm allow]', payload);
  } else {
    console.warn('[perm deny]', payload);
  }
};
