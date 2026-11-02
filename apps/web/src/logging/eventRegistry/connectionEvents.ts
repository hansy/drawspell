import { formatNumber } from "@/i18n/format";
import { m } from "@/paraglide/messages.js";
import type { LogEventDefinition } from "../types";
import type { BackoffReason } from "@/hooks/game/multiplayer-sync/connectionBackoff";

export type ConnectionReconnectPayload = {
  reason: BackoffReason;
  attempt: number;
  delayMs: number;
};

export type ConnectionReconnectAbandonedPayload = {
  attempt: number;
};

export type ConnectionAuthFailurePayload = {
  reason?: string | null;
};

const formatDelay = (delayMs: number) => {
  if (delayMs < 1000) return formatNumber(delayMs, { style: "unit", unit: "millisecond", unitDisplay: "narrow" });
  const seconds = Math.round(delayMs / 100) / 10;
  return formatNumber(seconds, { style: "unit", unit: "second", unitDisplay: "narrow" });
};

const formatReconnectReason = (reason: BackoffReason) => {
  switch (reason) {
    case "room-reset":
      return m.reconnect_room_reset();
    case "resume":
      return m.reconnect_resume();
    case "rate-limit":
      return m.reconnect_rate_limited();
    case "join-token":
      return m.reconnect_join_token();
    case "close":
    default:
      return m.reconnect_closed();
  }
};

export const connectionEvents: Record<
  "connection.reconnect" | "connection.reconnectAbandoned" | "connection.authFailure",
  LogEventDefinition<any>
> = {
  "connection.reconnect": {
    format: (payload: ConnectionReconnectPayload) => [{
      kind: "text",
      text: m.connection_events_reconnecting_after_attempt_in({ value_1: formatReconnectReason(payload.reason), attempt: payload.attempt, value_3: formatDelay(payload.delayMs) }),
    }],
  },
  "connection.reconnectAbandoned": {
    format: (payload: ConnectionReconnectAbandonedPayload) => [{
      kind: "text",
      text: m.connection_events_stopped_reconnecting_after_attempts({ attempt: payload.attempt }),
    }],
  },
  "connection.authFailure": {
    format: (payload: ConnectionAuthFailurePayload) => [{
      kind: "text",
      text: payload.reason
        ? m.connection_events_connection_auth_failed({ reason: payload.reason })
        : m.connection_events_connection_auth_failed_2(),
    }],
  },
};
