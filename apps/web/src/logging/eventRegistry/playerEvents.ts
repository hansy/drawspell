import { m } from "@/paraglide/messages.js";
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
  nextPlayerId?: string;
};

export type PlayerOutPayload = {
  playerId: string;
  actorId?: string;
  out: boolean;
  reason?: "life" | "poison" | "commander" | "self" | "skipped";
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
  get W() { return m.player_events_white(); },
  get U() { return m.player_events_blue(); },
  get B() { return m.player_events_black(); },
  get R() { return m.player_events_red(); },
  get G() { return m.player_events_green(); },
  get C() { return m.player_events_colorless(); },
};

const resolveDelta = (payload: { from: number; to: number; delta?: number }) =>
  typeof payload.delta === "number" ? payload.delta : payload.to - payload.from;

const formatLife: LogEventDefinition<LifePayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const delta = resolveDelta(payload);
  const signed = delta >= 0 ? `+${delta}` : `${delta}`;
  return [player, { kind: "text", text: m.player_events_life({ signed: signed, from: payload.from, to: payload.to }) }];
};

const formatCommanderTax: LogEventDefinition<CommanderTaxPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const delta = resolveDelta(payload);
  const absDelta = Math.abs(delta);
  const verb = delta >= 0 ? m.log_added() : m.log_removed();
  const preposition = delta >= 0 ? m.log_to() : m.log_from();
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(
    ctx,
    payload.cardId,
    zone,
    zone,
    payload.cardName ?? m.log_their_commander()
  );
  return [
    player,
    {
      kind: "text",
      text: m.player_events_commander_tax({ verb: verb, absDelta: absDelta, preposition: preposition }),
    },
    cardPart,
  ];
};

const formatEndTurn: LogEventDefinition<EndTurnPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.actorId);
  return [player, { kind: "text", text: m.player_events_ended_their_turn() }];
};

const OUT_REASON_TEXT: Record<NonNullable<PlayerOutPayload["reason"]>, string> = {
  get life() { return m.player_events_is_out_no_life_left(); },
  get poison() { return m.player_events_is_out_10_poison(); },
  get commander() { return m.player_events_is_out_21_commander_damage(); },
  get self() { return m.player_events_is_out(); },
  get skipped() { return m.player_events_is_out(); },
};

const formatPlayerOut: LogEventDefinition<PlayerOutPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  if (!payload.out) return [player, { kind: "text", text: m.player_events_is_back_in() }];
  if (payload.reason === "skipped" && payload.actorId && payload.actorId !== payload.playerId) {
    return [
      buildPlayerPart(ctx, payload.actorId),
      { kind: "text", text: m.player_events_skipped() },
      player,
      { kind: "text", text: m.player_events_s_turn_and_marked_them_out() },
    ];
  }
  return [player, { kind: "text", text: OUT_REASON_TEXT[payload.reason ?? "self"] }];
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
      text: m.player_events_mana_floating({ verb: verb, amount: amount, value_3: MANA_NAMES[payload.manaType], to: payload.to }),
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
      text: m.player_events_cleared_floating_mana({ total: payload.total }),
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
  "player.out": {
    format: formatPlayerOut,
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
