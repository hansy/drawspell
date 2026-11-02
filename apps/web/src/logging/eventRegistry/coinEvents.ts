import { m } from "@/paraglide/messages.js";
import { buildPlayerPart } from "../helpers";
import type { LogEventDefinition, PartialLogEventRegistry } from "@/logging/types";

export type CoinFlipPayload = {
  actorId?: string;
  count: number;
  results: ("heads" | "tails")[];
};

const formatCoinFlip: LogEventDefinition<CoinFlipPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.actorId);
  const coinLabel = payload.count === 1 ? m.coin_events_coin() : m.coin_events_coins();
  const localizedResults = payload.results.map((result) => result === "heads" ? m.coin_heads() : m.coin_tails());
  const resultsText =
    payload.count === 1
      ? localizedResults[0] ?? ""
      : `[${localizedResults.join(", ")}]`;

  return [
    player,
    { kind: "text", text: m.coin_events_flipped({ count: payload.count, coinLabel: coinLabel }) },
    { kind: "value", text: resultsText },
  ];
};

export const coinEvents = {
  "coin.flip": {
    format: formatCoinFlip,
  },
} satisfies PartialLogEventRegistry;
