import { toast } from "sonner";

import { logEventRegistry } from "./eventRegistry";
import type { LogContext, LogEventDefinition, LogEventId, LogEventPayloadMap } from "./types";

// Coin and dice results are easy to miss in a closed log, so every player sees them as a toast.
const RANDOM_RESULT_EVENT_IDS = new Set<string>(["coin.flip", "dice.roll"]);

export const formatRandomResult = (
  eventId: string,
  payload: Record<string, unknown>,
  ctx: LogContext,
): string | null => {
  if (!RANDOM_RESULT_EVENT_IDS.has(eventId)) return null;
  const def = logEventRegistry[eventId as LogEventId] as
    | LogEventDefinition<LogEventPayloadMap[LogEventId]>
    | undefined;
  if (!def) return null;
  const parts = def.format(payload as LogEventPayloadMap[LogEventId], ctx);
  return parts.map((part) => part.text).join("").trim() || null;
};

export const announceRandomResult = (
  eventId: string,
  payload: Record<string, unknown>,
  ctx: LogContext,
) => {
  const message = formatRandomResult(eventId, payload, ctx);
  if (message) toast(message);
};
