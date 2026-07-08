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
      text: ` added ${payload.delta} ${payload.counterType} counter${payload.delta === 1 ? "" : "s"} to `,
    },
    cardPart,
    { kind: "text", text: ` (now ${payload.newTotal})` },
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
      text: ` removed ${absDelta} ${payload.counterType} counter${absDelta === 1 ? "" : "s"} from `,
    },
    cardPart,
    { kind: "text", text: ` (now ${payload.newTotal})` },
  ];
};

const formatGlobalCounterAdd: LogEventDefinition<GlobalCounterPayload>["format"] = (payload, _ctx) => {
  const colorSuffix = payload.color ? ` (${payload.color})` : "";
  return [{ kind: "text", text: `Added global counter type ${payload.counterType}${colorSuffix}` }];
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
