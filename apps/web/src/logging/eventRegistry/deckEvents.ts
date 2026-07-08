import { buildPlayerPart } from "../helpers";
import type { LogEventDefinition, PartialLogEventRegistry } from "@/logging/types";

export type DeckPayload = { playerId: string; actorId?: string };

const formatDeckReset: LogEventDefinition<DeckPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [player, { kind: "text", text: " reset and shuffled Library" }];
};

const formatDeckUnload: LogEventDefinition<DeckPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [player, { kind: "text", text: " unloaded their deck" }];
};

export const deckEvents = {
  "deck.reset": {
    format: formatDeckReset,
  },
  "deck.unload": {
    format: formatDeckUnload,
  },
} satisfies PartialLogEventRegistry;
