import { formatNumber } from "@/i18n/format";
import { m } from "@/paraglide/messages.js";
import { buildPlayerPart } from "../helpers";
import type { LogEventDefinition, PartialLogEventRegistry } from "@/logging/types";

export type DiceRollPayload = {
  actorId?: string;
  sides: number;
  count: number;
  results: number[];
};

const formatDiceRoll: LogEventDefinition<DiceRollPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.actorId);
  const dieLabel = payload.count === 1 ? m.dice_events_die() : m.dice_events_dice();
  const resultsText =
    payload.count === 1
      ? payload.results[0] === undefined ? "" : formatNumber(payload.results[0])
      : `[${payload.results.map((value) => formatNumber(value)).join(", ")}]`;

  return [
    player,
    { kind: "text", text: m.dice_events_rolled_sided({ count: payload.count, sides: payload.sides, dieLabel: dieLabel }) },
    { kind: "value", text: resultsText },
  ];
};

export const diceEvents = {
  "dice.roll": {
    format: formatDiceRoll,
  },
} satisfies PartialLogEventRegistry;
