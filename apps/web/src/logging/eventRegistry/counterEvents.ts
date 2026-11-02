import { m } from "@/paraglide/messages.js";
import { buildCardPart, buildPlayerPart, getLogZone } from "../helpers";
import type { LogEventDefinition, PartialLogEventRegistry } from "@/logging/types";
import type { ZoneType } from "@/types";
import { DEFAULT_AGGREGATE_WINDOW_MS } from "./constants";

export type CounterPayload = {
  cardId: string;
  zoneId: string;
  zoneType?: ZoneType;
  actorId?: string;
  counterType: string;
  delta: number;
  newTotal: number;
  cardName?: string;
};

export type GlobalCounterPayload = { counterType: string; color?: string; actorId?: string };

const buildCounterAggregate = (): NonNullable<LogEventDefinition<CounterPayload>["aggregate"]> => ({
  key: (payload) => `counter:${payload.cardId}:${payload.counterType}:${payload.actorId ?? "unknown"}`,
  mergePayload: (existing, incoming) => ({
    ...incoming,
    delta: existing.delta + incoming.delta,
    newTotal: incoming.newTotal,
  }),
  windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
});

const formatCounterAdd: LogEventDefinition<CounterPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  return [
    actor,
    {
      kind: "text",
      text: m.counter_events_added_counter_to({ delta: payload.delta, counterType: payload.counterType }),
    },
    cardPart,
    { kind: "text", text: m.counter_events_now({ newTotal: payload.newTotal }) },
  ];
};

const formatCounterRemove: LogEventDefinition<CounterPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  const absDelta = Math.abs(payload.delta);
  return [
    actor,
    {
      kind: "text",
      text: m.counter_events_removed_counter_from({ absDelta: absDelta, counterType: payload.counterType }),
    },
    cardPart,
    { kind: "text", text: m.counter_events_now({ newTotal: payload.newTotal }) },
  ];
};

const formatGlobalCounterAdd: LogEventDefinition<GlobalCounterPayload>["format"] = (payload, _ctx) => {
  const colorSuffix = payload.color ? ` (${payload.color})` : "";
  return [{ kind: "text", text: m.counter_events_added_global_counter_type({ counterType: payload.counterType, colorSuffix: colorSuffix }) }];
};

export const counterEvents = {
  "counter.add": {
    format: formatCounterAdd,
    aggregate: buildCounterAggregate(),
  },
  "counter.remove": {
    format: formatCounterRemove,
    aggregate: buildCounterAggregate(),
  },
  "counter.global.add": {
    format: formatGlobalCounterAdd,
  },
} satisfies PartialLogEventRegistry;
