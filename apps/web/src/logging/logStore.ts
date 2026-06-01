import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { logEventRegistry } from './eventRegistry';
import {
  LogContext,
  LogEventDefinition,
  LogEventId,
  LogEventPayloadMap,
  LogMessage,
} from './types';
import { buildLogEntry, computeAggregatedLogEntryUpdate } from './logEntryModel';
import type { GameLogEntry } from '@/partykit/messages';

const MAX_LOG_ENTRIES = 200;

interface LogStoreState {
  entries: LogMessage[];
  latestGameLogSeq?: number;
  seenGameLogSeqs: number[];
  emitLog: <K extends LogEventId>(
    eventId: K,
    payload: LogEventPayloadMap[K],
    ctx: LogContext
  ) => void;
  receiveGameLogEvents: (events: GameLogEntry[], ctx: LogContext) => void;
  replaceGameLog: (events: GameLogEntry[], ctx: LogContext) => void;
  clear: () => void;
}

export const useLogStore = create<LogStoreState>((set) => {
  const appendLocal = <K extends LogEventId>(
    def: LogEventDefinition<LogEventPayloadMap[K]>,
    eventId: K,
    payload: LogEventPayloadMap[K],
    ctx: LogContext,
    aggregateKey?: string,
    options?: { timestamp?: number; sourceClientId?: number }
  ) => {
    const now = options?.timestamp ?? Date.now();
    set((state) => {
      const entries = [...state.entries];

      const update = computeAggregatedLogEntryUpdate({
        eventId,
        def,
        payload,
        ctx,
        aggregateKey,
        lastEntry: entries[entries.length - 1] as LogMessage<K> | undefined,
        timestamp: now,
        sourceClientId: options?.sourceClientId,
        createId: uuidv4,
      });

      if (update.kind === 'replaceLast') {
        entries[entries.length - 1] = update.entry;
      } else {
        entries.push(update.entry);
      }

      if (entries.length > MAX_LOG_ENTRIES) {
        entries.splice(0, entries.length - MAX_LOG_ENTRIES);
      }

      return { entries };
    });
  };

  const appendGameLogEvents = (events: GameLogEntry[], ctx: LogContext) => {
    set((state) => {
      let nextState = state;
      const orderedEvents = [...events].sort((a, b) => a.seq - b.seq);
      for (const event of orderedEvents) {
        if (
          !Number.isSafeInteger(event.seq) ||
          nextState.seenGameLogSeqs.includes(event.seq)
        ) {
          continue;
        }
        const def = logEventRegistry[event.eventId as LogEventId] as
          | LogEventDefinition<LogEventPayloadMap[LogEventId]>
          | undefined;
        if (!def) continue;
        const payload = event.payload as LogEventPayloadMap[LogEventId];
        const redactedPayload = def.redact ? def.redact(payload, ctx) : payload;
        const aggregateKey = def.aggregate?.key ? def.aggregate.key(redactedPayload) : undefined;
        const entries = [...nextState.entries];
        const eventId = event.eventId as LogEventId;
        const insertIndex = entries.findIndex(
          (entry) =>
            typeof entry.sourceClientId === 'number' && entry.sourceClientId > event.seq
        );

        if (insertIndex === -1) {
          const update = computeAggregatedLogEntryUpdate({
            eventId,
            def,
            payload: redactedPayload,
            ctx,
            aggregateKey,
            lastEntry: entries[entries.length - 1],
            timestamp: event.ts,
            sourceClientId: event.seq,
            createId: uuidv4,
          });

          if (update.kind === 'replaceLast') {
            entries[entries.length - 1] = update.entry;
          } else {
            entries.push(update.entry);
          }
        } else {
          const entry = buildLogEntry({
            eventId,
            def,
            payload: redactedPayload,
            ctx,
            aggregateKey,
            timestamp: event.ts,
            sourceClientId: event.seq,
            createId: uuidv4,
          });
          entries.splice(insertIndex, 0, entry);
        }

        if (entries.length > MAX_LOG_ENTRIES) {
          entries.splice(0, entries.length - MAX_LOG_ENTRIES);
        }
        const seenGameLogSeqs = [...nextState.seenGameLogSeqs, event.seq].slice(-MAX_LOG_ENTRIES);
        nextState = {
          ...nextState,
          entries,
          seenGameLogSeqs,
          latestGameLogSeq: Math.max(nextState.latestGameLogSeq ?? 0, event.seq),
        };
      }
      return nextState;
    });
  };

  return {
    entries: [],
    latestGameLogSeq: undefined,
    seenGameLogSeqs: [],

    emitLog: (eventId, payload, ctx) => {
      const def = logEventRegistry[eventId] as LogEventDefinition<
        LogEventPayloadMap[typeof eventId]
      >;
      if (!def) return;

      const redactedPayload = def.redact ? def.redact(payload, ctx) : payload;
      const aggregateKey = def.aggregate?.key ? def.aggregate.key(redactedPayload) : undefined;

      appendLocal(def, eventId, redactedPayload, ctx, aggregateKey);
    },

    receiveGameLogEvents: (events, ctx) => {
      appendGameLogEvents(events, ctx);
    },

    replaceGameLog: (events, ctx) => {
      set({ entries: [], latestGameLogSeq: undefined, seenGameLogSeqs: [] });
      appendGameLogEvents(events, ctx);
    },

    clear: () => {
      set({ entries: [], latestGameLogSeq: undefined, seenGameLogSeqs: [] });
    },
  };
});

export const emitLog = <K extends LogEventId>(
  eventId: K,
  payload: LogEventPayloadMap[K],
  ctx: LogContext
) => useLogStore.getState().emitLog(eventId, payload, ctx);

export const receiveGameLogEvents = (events: GameLogEntry[], ctx: LogContext) =>
  useLogStore.getState().receiveGameLogEvents(events, ctx);

export const replaceGameLog = (events: GameLogEntry[], ctx: LogContext) =>
  useLogStore.getState().replaceGameLog(events, ctx);

export const getLatestGameLogSeq = () => useLogStore.getState().latestGameLogSeq;

export const clearLogs = () => useLogStore.getState().clear();
