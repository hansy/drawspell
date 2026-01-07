import { Card, CardId, Player, PlayerId, Zone, ZoneId } from '@/types';
import type { LogEventPayloadMap } from './payloads';

export type LogEventId = keyof LogEventPayloadMap;

export type LogMessagePartKind = 'text' | 'player' | 'card' | 'zone' | 'value';

export interface LogMessagePart {
  kind: LogMessagePartKind;
  text: string;
  playerId?: PlayerId;
  cardId?: CardId;
  zoneId?: ZoneId;
}

export interface LogContext {
  players: Record<PlayerId, Player>;
  cards: Record<CardId, Card>;
  zones: Record<ZoneId, Zone>;
}

export interface LogMessage<K extends LogEventId = LogEventId> {
  id: string;
  ts: number;
  eventId: K;
  actorId?: PlayerId;
  visibility: 'public';
  parts: LogMessagePart[];
  payload?: LogEventPayloadMap[K];
  aggregateKey?: string;
  sourceClientId?: number;
}

export interface LogEventAggregateConfig<P = LogEventPayloadMap[LogEventId]> {
  key: (payload: P) => string | undefined;
  mergePayload: (existing: P, incoming: P) => P;
  windowMs?: number;
}

export interface LogEventDefinition<P = LogEventPayloadMap[LogEventId]> {
  format: (payload: P, ctx: LogContext) => LogMessagePart[];
  redact?: (payload: P, ctx: LogContext) => P;
  aggregate?: LogEventAggregateConfig<P>;
}

export type LogEventRegistry = {
  [K in LogEventId]: LogEventDefinition<LogEventPayloadMap[K]>;
};

export type { LogEventPayloadMap };
