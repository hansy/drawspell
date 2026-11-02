import { m } from "@/paraglide/messages.js";
import { buildPlayerPart } from "../helpers";
import type { LogEventDefinition, PartialLogEventRegistry } from "@/logging/types";

import { DEFAULT_AGGREGATE_WINDOW_MS } from "./constants";

export type DrawPayload = { playerId: string; actorId?: string; count?: number };
export type DiscardPayload = { playerId: string; actorId?: string; count?: number };
export type ShufflePayload = { playerId: string; actorId?: string };
export type LibraryBottomToHandPayload = { playerId: string; actorId?: string };
export type LibraryViewPayload = { playerId: string; actorId?: string; count?: number };
export type LibraryTopRevealPayload = {
  playerId: string;
  actorId?: string;
  recipientIds?: string[];
  toAllPlayers?: boolean;
};

type CountedLibraryPayload = { count?: number };

const getLoggedCardCount = (payload: CountedLibraryPayload) => payload.count || 1;

const mergeLoggedCardCounts = <T extends CountedLibraryPayload>(existing: T, incoming: T): T => ({
  ...incoming,
  count: getLoggedCardCount(existing) + getLoggedCardCount(incoming),
});

const formatDraw: LogEventDefinition<DrawPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const count = getLoggedCardCount(payload);
  const cardText = m.library_events_drew_card({ count: count });
  return [player, { kind: "text", text: ` ${cardText}` }];
};

const formatDiscard: LogEventDefinition<DiscardPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const count = getLoggedCardCount(payload);
  const cardText = m.library_events_milled_card({ count: count });
  return [player, { kind: "text", text: ` ${cardText}` }];
};

const formatShuffle: LogEventDefinition<ShufflePayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [player, { kind: "text", text: m.library_events_shuffled_library() }];
};

const formatLibraryBottomToHand: LogEventDefinition<LibraryBottomToHandPayload>["format"] = (
  payload,
  ctx,
) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [
    player,
    { kind: "text", text: m.library_events_put_the_bottom_card_of_library_into_hand() },
  ];
};

const formatLibraryView: LogEventDefinition<LibraryViewPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const count = typeof payload.count === "number" ? payload.count : 0;
  if (count > 0) {
    const cardText = m.library_events_viewed_top_card_of_library({ count: count });
    return [player, { kind: "text", text: ` ${cardText}` }];
  }
  return [player, { kind: "text", text: m.library_events_viewed_all_cards_of_library() }];
};

const formatLibraryTopReveal: LogEventDefinition<LibraryTopRevealPayload>["format"] = (
  payload,
  ctx
) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const recipientIds = payload.recipientIds ?? [];
  if (recipientIds.length === 0) {
    return [player, { kind: "text", text: m.library_events_hid_top_card_reveal() }];
  }
  if (payload.toAllPlayers) {
    return [player, { kind: "text", text: m.library_events_revealed_top_card_to_all_players() }];
  }
  const audience = recipientIds
    .map((id) => (id === payload.playerId ? m.log_self() : ctx.players[id]?.name ?? id))
    .join(", ");
  return [player, { kind: "text", text: m.library_events_revealed_top_card_to({ audience: audience }) }];
};

export const libraryEvents = {
  "library.bottomToHand": {
    format: formatLibraryBottomToHand,
  },
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
      mergePayload: mergeLoggedCardCounts,
      windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
    },
  },
  "card.discard": {
    format: formatDiscard,
    aggregate: {
      key: (payload: DiscardPayload) => `discard:${payload.playerId}`,
      mergePayload: mergeLoggedCardCounts,
      windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
    },
  },
} satisfies PartialLogEventRegistry;
