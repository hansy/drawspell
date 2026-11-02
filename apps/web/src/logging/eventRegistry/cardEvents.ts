import { formatNumber } from "@/i18n/format";
import { m } from "@/paraglide/messages.js";
import {
  buildCardPart,
  buildPlayerPart,
  getLogZone,
  getLogZoneLabel,
} from "../helpers";
import type { LogEventDefinition, PartialLogEventRegistry } from "@/logging/types";
import type { ZoneType } from "@/types";
import { ZONE } from "@/constants/zones";
import { DEFAULT_AGGREGATE_WINDOW_MS } from "./constants";

export type MovePayload = {
  cardId: string;
  fromZoneId: string;
  toZoneId: string;
  actorId?: string;
  gainsControlBy?: string;
  placement?: "top" | "bottom";
  libraryPositionFromTop?: number;
  cardName?: string;
  fromZoneType?: ZoneType;
  toZoneType?: ZoneType;
  faceDown?: boolean;
  forceHidden?: boolean;
  random?: boolean;
};

export type TapPayload = {
  cardId: string;
  zoneId: string;
  zoneType?: ZoneType;
  actorId?: string;
  tapped: boolean;
  cardName?: string;
};

export type UntapAllPayload = { playerId: string; actorId?: string };

export type TransformPayload = {
  cardId: string;
  zoneId: string;
  zoneType?: ZoneType;
  actorId?: string;
  fromFaceName?: string;
  toFaceName?: string;
  cardName?: string;
  verb?: "flipped" | "transformed";
};

export type DuplicatePayload = {
  sourceCardId: string;
  newCardId: string;
  zoneId: string;
  zoneType?: ZoneType;
  actorId?: string;
  cardName?: string;
};

export type RemoveCardPayload = { cardId: string; zoneId: string; zoneType?: ZoneType; actorId?: string; cardName?: string };

export type PTPayload = {
  cardId: string;
  zoneId: string;
  zoneType?: ZoneType;
  actorId?: string;
  fromPower?: string;
  fromToughness?: string;
  toPower?: string;
  toToughness?: string;
  cardName?: string;
};

export type TokenCreatePayload = {
  playerId: string;
  actorId?: string;
  tokenName: string;
  count?: number;
};

export type FaceUpPayload = {
  cardId: string;
  zoneId: string;
  zoneType?: ZoneType;
  actorId?: string;
  cardName?: string;
};

export type ExileRevealPayload = {
  actorId?: string;
  audience: "everyone" | "players" | "nobody";
  playerIds?: string[];
};

const formatMove: LogEventDefinition<MovePayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const fromZone = getLogZone(ctx, payload.fromZoneId, payload.fromZoneType);
  const toZone = getLogZone(ctx, payload.toZoneId, payload.toZoneType);
  const forceHidden = payload.forceHidden || payload.faceDown;
  const fallbackCardName = forceHidden ? m.hidden_card() : payload.cardName;
  const cardPart = buildCardPart(ctx, payload.cardId, fromZone, toZone, fallbackCardName, forceHidden);

  const fromLabel = getLogZoneLabel(ctx, payload.fromZoneId, payload.fromZoneType);
  const toLabel = getLogZoneLabel(ctx, payload.toZoneId, payload.toZoneType);
  const placementLabel =
    typeof payload.libraryPositionFromTop === "number" &&
    Number.isFinite(payload.libraryPositionFromTop) &&
    payload.libraryPositionFromTop >= 1
      ? m.card_events_position_from_the_top({ value_1: formatNumber(Math.floor(payload.libraryPositionFromTop)) })
      : payload.placement === "top" || payload.placement === "bottom"
        ? payload.placement === "top" ? m.position_top() : m.position_bottom()
        : null;

  if (payload.gainsControlBy && toZone?.type === "battlefield") {
    const controller = buildPlayerPart(ctx, payload.gainsControlBy);
    return [controller, { kind: "text", text: m.card_events_gains_control_of() }, cardPart];
  }

  // Within the same zone: treat as a reorder/move inside the zone
  if (payload.fromZoneId === payload.toZoneId) {
    if (toZone?.type === "library" && placementLabel) {
      return [
        actor,
        { kind: "text", text: m.card_events_moved() },
        cardPart,
        { kind: "text", text: m.card_events_to_the_of({ placementLabel: placementLabel, toLabel: toLabel }) },
      ];
    }
    return [
      actor,
      { kind: "text", text: m.card_events_moved() },
      cardPart,
      { kind: "text", text: m.card_events_within({ toLabel: toLabel }) },
    ];
  }

  if (toZone?.type === "library" && placementLabel) {
    return [
      actor,
      { kind: "text", text: m.card_events_moved() },
      cardPart,
      { kind: "text", text: m.card_events_from_to_the_of({ fromLabel: fromLabel, placementLabel: placementLabel, toLabel: toLabel }) },
    ];
  }

  if (toZone?.type === "battlefield") {
    return [actor, { kind: "text", text: m.card_events_played() }, cardPart, { kind: "text", text: m.card_events_from({ fromLabel: fromLabel }) }];
  }

  if (toZone?.type === "exile") {
    return [actor, { kind: "text", text: m.card_events_exiled() }, cardPart, { kind: "text", text: m.card_events_from({ fromLabel: fromLabel }) }];
  }

  if (toZone?.type === "graveyard") {
    return [
      actor,
      { kind: "text", text: payload.random ? m.card_events_randomly_sent() : m.card_events_sent() },
      cardPart,
      { kind: "text", text: m.card_events_from_to({ fromLabel: fromLabel, toLabel: toLabel }) },
    ];
  }

  if (toZone?.type === "commander") {
    return [
      actor,
      { kind: "text", text: m.card_events_returned_commander() },
      cardPart,
      { kind: "text", text: m.card_events_from({ fromLabel: fromLabel }) },
    ];
  }

  return [
    actor,
    { kind: "text", text: m.card_events_moved() },
    cardPart,
    { kind: "text", text: m.card_events_from_to({ fromLabel: fromLabel, toLabel: toLabel }) },
  ];
};

const formatTap: LogEventDefinition<TapPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const card = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  const verb = payload.tapped ? m.log_tapped() : m.log_untapped();
  return [actor, { kind: "text", text: ` ${verb} ` }, card];
};

const formatUntapAll: LogEventDefinition<UntapAllPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [player, { kind: "text", text: m.card_events_untapped_all_permanents() }];
};

const formatTransform: LogEventDefinition<TransformPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  const includeFace = cardPart.text !== m.hidden_card() && payload.toFaceName;
  const verb =
    (payload.verb ?? (ctx.cards[payload.cardId]?.scryfall?.layout === "flip" ? "flipped" : "transformed")) === "flipped" ? m.log_flipped() : m.log_transformed();
  return [
    actor,
    { kind: "text" as const, text: ` ${verb} ` },
    cardPart,
    ...(includeFace ? [{ kind: "text" as const, text: m.card_events_to({ toFaceName: payload.toFaceName ?? "" }) }] : []),
  ];
};

const formatDuplicate: LogEventDefinition<DuplicatePayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.sourceCardId, zone, zone, payload.cardName);
  return [actor, { kind: "text", text: m.card_events_created_a_token_copy_of() }, cardPart];
};

const formatRemove: LogEventDefinition<RemoveCardPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  return [actor, { kind: "text", text: m.card_events_removed() }, cardPart];
};

const formatPT: LogEventDefinition<PTPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  const from = `${payload.fromPower ?? "?"} / ${payload.fromToughness ?? "?"}`;
  const to = `${payload.toPower ?? "?"} / ${payload.toToughness ?? "?"}`;
  return [actor, { kind: "text", text: m.card_events_set() }, cardPart, { kind: "text", text: m.card_events_p_t_to_was({ to: to, from: from }) }];
};

const formatTokenCreate: LogEventDefinition<TokenCreatePayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const count = payload.count ?? 1;
  const tokenName = payload.tokenName?.trim() || m.card_preview_view_token();
  return [player, { kind: "text", text: m.card_events_created_token({ count: count, tokenName: tokenName }) }];
};

const formatFaceUp: LogEventDefinition<FaceUpPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  if (payload.zoneType === ZONE.EXILE || zone?.type === ZONE.EXILE) {
    return [
      actor,
      { kind: "text", text: m.card_events_turned() },
      cardPart,
      { kind: "text", text: m.card_events_face_up_in_exile() },
    ];
  }
  return [
    actor,
    { kind: "text", text: m.card_events_revealed() },
    cardPart,
    { kind: "text", text: m.card_events_from_facedown() },
  ];
};

const formatExileReveal: LogEventDefinition<ExileRevealPayload>["format"] = (
  payload,
  ctx,
) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  if (payload.audience === "nobody") {
    return [
      actor,
      { kind: "text", text: m.card_events_hid_the_identity_of_a_face_down_exiled_card_from_everyone() },
    ];
  }
  if (payload.audience === "everyone") {
    return [
      actor,
      { kind: "text", text: m.card_events_revealed_the_identity_of_a_face_down_exiled_card_to_everyone() },
    ];
  }

  const playerIds = payload.playerIds ?? [];
  const audienceParts = playerIds.flatMap((playerId, index) => [
    ...(index > 0
      ? [{ kind: "text" as const, text: index === playerIds.length - 1 ? m.card_events_and() : ", " }]
      : []),
    buildPlayerPart(ctx, playerId),
  ]);
  return [
    actor,
    { kind: "text", text: m.card_events_revealed_the_identity_of_a_face_down_exiled_card_to() },
    ...audienceParts,
  ];
};

export const cardEvents = {
  "card.move": {
    format: formatMove,
  },
  "card.tap": {
    format: formatTap,
  },
  "card.untapAll": {
    format: formatUntapAll,
  },
  "card.faceUp": {
    format: formatFaceUp,
  },
  "card.exileReveal": {
    format: formatExileReveal,
  },
  "card.transform": {
    format: formatTransform,
  },
  "card.duplicate": {
    format: formatDuplicate,
  },
  "card.remove": {
    format: formatRemove,
  },
  "card.pt": {
    format: formatPT,
    aggregate: {
      key: (payload: PTPayload) => `pt:${payload.cardId}:${payload.actorId ?? "unknown"}`,
      mergePayload: (existing: PTPayload, incoming: PTPayload) => ({
        ...incoming,
        fromPower: existing.fromPower ?? incoming.fromPower,
        fromToughness: existing.fromToughness ?? incoming.fromToughness,
      }),
      windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
    },
  },
  "card.tokenCreate": {
    format: formatTokenCreate,
    aggregate: {
      key: (payload: TokenCreatePayload) => {
        const name = payload.tokenName?.trim() || m.card_preview_view_token();
        return `token:${payload.playerId}:${name}`;
      },
      mergePayload: (existing: TokenCreatePayload, incoming: TokenCreatePayload) => {
        const existingCount = existing.count ?? 1;
        const incomingCount = incoming.count ?? 1;
        return { ...incoming, count: existingCount + incomingCount };
      },
      windowMs: DEFAULT_AGGREGATE_WINDOW_MS,
    },
  },
} satisfies PartialLogEventRegistry;
