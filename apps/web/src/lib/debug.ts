export const DEBUG_FLAGS = {
  faceDownDrag: false,
} as const;

export type DebugFlagKey = keyof typeof DEBUG_FLAGS;

export const isDebugEnabled = (key: DebugFlagKey): boolean => DEBUG_FLAGS[key];

export const debugLog = (key: DebugFlagKey, ...args: unknown[]) => {
  if (!isDebugEnabled(key)) return;
  console.log(`[${key}]`, ...args);
};

const summarizeToken = (token: string | undefined) => {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const suffix = trimmed.length > 6 ? trimmed.slice(-6) : trimmed;
  return { length: trimmed.length, suffix };
};

export const handoffDebugLog = (event: string, payload?: Record<string, unknown>) => {
  console.info("[handoff-debug]", event, payload ?? {});
};

export const handoffDebugTokenSummary = (token: string | undefined) =>
  summarizeToken(token);
