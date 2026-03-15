import { buildPlayerPart } from "../helpers";
import type { LogEventDefinition, LogEventId } from "@/logging/types";

import { DEFAULT_AGGREGATE_WINDOW_MS } from "./constants";

export type DrawPayload = { playerId: string; actorId?: string; count?: number };
export type DiscardPayload = { playerId: string; actorId?: string; count?: number };
export type ShufflePayload = { playerId: string; actorId?: string };
export type LibraryViewPayload = { playerId: string; actorId?: string; count?: number };
export type LibraryTopRevealPayload = {
  playerId: string;
  actorId?: string;
  recipientIds?: string[];
  toAllPlayers?: boolean;
};

const formatDraw: LogEventDefinition<DrawPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const count = payload.count || 1;
  const cardText = `drew ${count} card${count === 1 ? "" : "s"}`;
  return [player, { kind: "text", text: ` ${cardText}` }];
};

const formatDiscard: LogEventDefinition<DiscardPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const count = payload.count || 1;
  const cardText = `discarded ${count} card${count === 1 ? "" : "s"} from Library`;
  return [player, { kind: "text", text: ` ${cardText}` }];
};

const formatShuffle: LogEventDefinition<ShufflePayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [player, { kind: "text", text: " shuffled Library" }];
};

const formatLibraryView: LogEventDefinition<LibraryViewPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const count = typeof payload.count === "number" ? payload.count : 0;
  if (count > 0) {
    const cardText = `viewed top ${count} card${count === 1 ? "" : "s"} of Library`;
    return [player, { kind: "text", text: ` ${cardText}` }];
  }
  return [player, { kind: "text", text: " viewed all cards of Library" }];
};

const formatLibraryTopReveal: LogEventDefinition<LibraryTopRevealPayload>["format"] = (
  payload,
  ctx
) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const recipientIds = payload.recipientIds ?? [];
  if (recipientIds.length === 0) {
    return [player, { kind: "text", text: " hid top card reveal" }];
  }
  if (payload.toAllPlayers) {
    return [player, { kind: "text", text: " revealed top card to all players" }];
  }
  const audience = recipientIds
    .map((id) => (id === payload.playerId ? "self" : ctx.players[id]?.name ?? id))
    .join(", ");
  return [player, { kind: "text", text: ` revealed top card to ${audience}` }];
};

export const libraryEvents = {
  "library.shuffle": {
    format: formatShuffle,
  },
  "library.view": {
    format: formatLibraryView,
  },
  "library.topReveal": {
    format: formatLibraryTopReveal,
  },
  "card.draw": {
    format: formatDraw,
    aggregate: {
      key: (payload: DrawPayload) => `draw:${payload.playerId}`,
      mergePayload: (existing: DrawPayload, incoming: DrawPayload) => {
        const existingCount = existing.count || 1;
        const incomingCount = incoming.count || 1;
        return {
          ...incoming,
          count: existingCount + incomingCount,
        };
      },
      windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
    },
  },
  "card.discard": {
    format: formatDiscard,
    aggregate: {
      key: (payload: DiscardPayload) => `discard:${payload.playerId}`,
      mergePayload: (existing: DiscardPayload, incoming: DiscardPayload) => {
        const existingCount = existing.count || 1;
        const incomingCount = incoming.count || 1;
        return {
          ...incoming,
          count: existingCount + incomingCount,
        };
      },
      windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
    },
  },
} satisfies Partial<Record<LogEventId, LogEventDefinition<any>>>;
