import type { LogContext, LogEventDefinition, LogEventId, LogMessage } from "./types";

import { DEFAULT_AGGREGATE_WINDOW_MS } from "./eventRegistry/constants";

export const buildLogEntry = (params: {
  eventId: LogEventId;
  def: LogEventDefinition<any>;
  payload: any;
  ctx: LogContext;
  aggregateKey?: string;
  existingId?: string;
  timestamp: number;
  sourceClientId?: number;
  createId: () => string;
}): LogMessage => {
  const parts = params.def.format(params.payload, params.ctx);

  return {
    id: params.existingId ?? params.createId(),
    ts: params.timestamp,
    eventId: params.eventId,
    actorId: params.payload?.actorId,
    visibility: "public",
    parts,
    payload: params.payload,
    aggregateKey: params.aggregateKey,
    sourceClientId: params.sourceClientId,
  };
};

export const computeAggregatedLogEntryUpdate = (params: {
  eventId: LogEventId;
  def: LogEventDefinition<any>;
  payload: any;
  ctx: LogContext;
  aggregateKey?: string;
  lastEntry?: LogMessage;
  timestamp: number;
  sourceClientId?: number;
  createId: () => string;
}): { kind: "append" | "replaceLast"; entry: LogMessage } => {
  const aggregate = params.def.aggregate;
  const canAggregate = Boolean(params.aggregateKey && aggregate);

  if (
    canAggregate &&
    params.lastEntry &&
    params.lastEntry.aggregateKey === params.aggregateKey
  ) {
    const windowMs = aggregate?.windowMs ?? DEFAULT_AGGREGATE_WINDOW_MS;
    if (params.timestamp - params.lastEntry.ts <= windowMs) {
      const mergedPayload = aggregate!.mergePayload(params.lastEntry.payload, params.payload);
      return {
        kind: "replaceLast",
        entry: buildLogEntry({
          eventId: params.eventId,
          def: params.def,
          payload: mergedPayload,
          ctx: params.ctx,
          aggregateKey: params.aggregateKey,
          existingId: params.lastEntry.id,
          timestamp: params.timestamp,
          sourceClientId: params.sourceClientId,
          createId: params.createId,
        }),
      };
    }
  }

  return {
    kind: "append",
    entry: buildLogEntry({
      eventId: params.eventId,
      def: params.def,
      payload: params.payload,
      ctx: params.ctx,
      aggregateKey: params.aggregateKey,
      timestamp: params.timestamp,
      sourceClientId: params.sourceClientId,
      createId: params.createId,
    }),
  };
};

