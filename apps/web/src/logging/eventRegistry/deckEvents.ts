import { m } from "@/paraglide/messages.js";
import { buildPlayerPart } from "../helpers";
import type { LogEventDefinition, PartialLogEventRegistry } from "@/logging/types";

export type DeckPayload = { playerId: string; actorId?: string };

const formatDeckReset: LogEventDefinition<DeckPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [player, { kind: "text", text: m.deck_events_reset_and_shuffled_library() }];
};

const formatDeckUnload: LogEventDefinition<DeckPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [player, { kind: "text", text: m.deck_events_unloaded_their_deck() }];
};

export const deckEvents = {
  "deck.load": {
    format: (payload: DeckPayload, ctx) => [buildPlayerPart(ctx, payload.playerId), { kind: "text", text: m.deck_events_loaded_a_deck() }],
  },
  "deck.reset": {
    format: formatDeckReset,
  },
  "deck.unload": {
    format: formatDeckUnload,
  },
} satisfies PartialLogEventRegistry;
