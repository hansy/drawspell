import { buildCardPart, buildPlayerPart, getLogZone } from "../helpers";
import type { LogEventDefinition, PartialLogEventRegistry } from "@/logging/types";
import type { ManaPool, ManaType, ZoneType } from "@/types";

import { DEFAULT_AGGREGATE_WINDOW_MS } from "./constants";

export type LifePayload = {
  playerId: string;
  actorId?: string;
  from: number;
  to: number;
  delta?: number;
};

export type CommanderTaxPayload = {
  playerId: string;
  actorId?: string;
  from: number;
  to: number;
  delta?: number;
  cardId?: string;
  zoneId?: string;
  zoneType?: ZoneType;
  cardName?: string;
};

export type EndTurnPayload = {
  actorId?: string;
};

export type ManaPayload = {
  playerId: string;
  actorId?: string;
  manaType: ManaType;
  from: number;
  to: number;
  delta?: number;
};

export type ManaClearPayload = {
  playerId: string;
  actorId?: string;
  total: number;
  previousPool: ManaPool;
};

const MANA_NAMES: Record<ManaType, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
};

const resolveDelta = (payload: { from: number; to: number; delta?: number }) =>
  typeof payload.delta === "number" ? payload.delta : payload.to - payload.from;

const formatLife: LogEventDefinition<LifePayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const delta = resolveDelta(payload);
  const signed = delta >= 0 ? `+${delta}` : `${delta}`;
  return [player, { kind: "text", text: ` life ${signed} (${payload.from} -> ${payload.to})` }];
};

const formatCommanderTax: LogEventDefinition<CommanderTaxPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const delta = resolveDelta(payload);
  const absDelta = Math.abs(delta);
  const verb = delta >= 0 ? "added" : "removed";
  const preposition = delta >= 0 ? "to" : "from";
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(
    ctx,
    payload.cardId,
    zone,
    zone,
    payload.cardName ?? "their commander"
  );
  return [
    player,
    {
      kind: "text",
      text: ` ${verb} ${absDelta} commander tax ${preposition} `,
    },
    cardPart,
  ];
};

const formatEndTurn: LogEventDefinition<EndTurnPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.actorId);
  return [player, { kind: "text", text: " ended their turn" }];
};

const formatMana: LogEventDefinition<ManaPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const delta = resolveDelta(payload);
  const amount = Math.abs(delta);
  const verb = delta > 0 ? "added" : "removed";
  return [
    player,
    {
      kind: "text",
      text: ` ${verb} ${amount} ${MANA_NAMES[payload.manaType]} mana (${payload.to} floating)`,
    },
  ];
};

const formatManaClear: LogEventDefinition<ManaClearPayload>["format"] = (
  payload,
  ctx,
) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [
    player,
    {
      kind: "text",
      text: ` cleared ${payload.total} floating mana`,
    },
  ];
};

export const playerEvents = {
  "player.life": {
    format: formatLife,
    aggregate: {
      key: (payload: LifePayload) => `life:${payload.playerId}`,
      mergePayload: (existing: LifePayload, incoming: LifePayload) => {
        const existingDelta = resolveDelta(existing);
        const nextDelta = resolveDelta(incoming);
        const totalDelta = existingDelta + nextDelta;
        return {
          ...incoming,
          from: existing.from,
          to: existing.from + totalDelta,
          delta: totalDelta,
        };
      },
      windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
    },
  },
  "player.commanderTax": {
    format: formatCommanderTax,
  },
  "player.endTurn": {
    format: formatEndTurn,
  },
  "player.mana": {
    format: formatMana,
    aggregate: {
      key: (payload: ManaPayload) =>
        `mana:${payload.playerId}:${payload.manaType}:${Math.sign(resolveDelta(payload))}`,
      mergePayload: (existing: ManaPayload, incoming: ManaPayload) => ({
        ...incoming,
        from: existing.from,
        delta: incoming.to - existing.from,
      }),
      windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
    },
  },
  "player.mana.clear": {
    format: formatManaClear,
  },
} satisfies PartialLogEventRegistry;
