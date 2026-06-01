import {
  buildCardPart,
  buildPlayerPart,
  getLogZone,
  getLogZoneLabel,
} from "../helpers";
import type { LogEventDefinition, LogEventId } from "@/logging/types";
import type { ZoneType } from "@/types";
import { DEFAULT_AGGREGATE_WINDOW_MS } from "./constants";

export type MovePayload = {
  cardId: string;
  fromZoneId: string;
  toZoneId: string;
  actorId?: string;
  gainsControlBy?: string;
  placement?: "top" | "bottom";
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

const formatMove: LogEventDefinition<MovePayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const fromZone = getLogZone(ctx, payload.fromZoneId, payload.fromZoneType);
  const toZone = getLogZone(ctx, payload.toZoneId, payload.toZoneType);
  const forceHidden = payload.forceHidden || payload.faceDown;
  const fallbackCardName = forceHidden ? "a card" : payload.cardName;
  const cardPart = buildCardPart(ctx, payload.cardId, fromZone, toZone, fallbackCardName, forceHidden);

  const fromLabel = getLogZoneLabel(ctx, payload.fromZoneId, payload.fromZoneType);
  const toLabel = getLogZoneLabel(ctx, payload.toZoneId, payload.toZoneType);
  const placementLabel =
    payload.placement === "top" || payload.placement === "bottom" ? payload.placement : null;

  if (payload.gainsControlBy && toZone?.type === "battlefield") {
    const controller = buildPlayerPart(ctx, payload.gainsControlBy);
    return [controller, { kind: "text", text: " gains control of " }, cardPart];
  }

  // Within the same zone: treat as a reorder/move inside the zone
  if (payload.fromZoneId === payload.toZoneId) {
    if (toZone?.type === "library" && placementLabel) {
      return [
        actor,
        { kind: "text", text: " moved " },
        cardPart,
        { kind: "text", text: ` to the ${placementLabel} of ${toLabel}` },
      ];
    }
    return [
      actor,
      { kind: "text", text: " moved " },
      cardPart,
      { kind: "text", text: ` within ${toLabel}` },
    ];
  }

  if (toZone?.type === "library" && placementLabel) {
    return [
      actor,
      { kind: "text", text: " moved " },
      cardPart,
      { kind: "text", text: ` from ${fromLabel} to the ${placementLabel} of ${toLabel}` },
    ];
  }

  if (toZone?.type === "battlefield") {
    return [actor, { kind: "text", text: " played " }, cardPart, { kind: "text", text: ` from ${fromLabel}` }];
  }

  if (toZone?.type === "exile") {
    return [actor, { kind: "text", text: " exiled " }, cardPart, { kind: "text", text: ` from ${fromLabel}` }];
  }

  if (toZone?.type === "graveyard") {
    return [
      actor,
      { kind: "text", text: payload.random ? " randomly sent " : " sent " },
      cardPart,
      { kind: "text", text: ` from ${fromLabel} to ${toLabel}` },
    ];
  }

  if (toZone?.type === "commander") {
    return [
      actor,
      { kind: "text", text: " returned commander " },
      cardPart,
      { kind: "text", text: ` from ${fromLabel}` },
    ];
  }

  return [
    actor,
    { kind: "text", text: " moved " },
    cardPart,
    { kind: "text", text: ` from ${fromLabel} to ${toLabel}` },
  ];
};

const formatTap: LogEventDefinition<TapPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const card = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  const verb = payload.tapped ? "tapped" : "untapped";
  return [actor, { kind: "text", text: ` ${verb} ` }, card];
};

const formatUntapAll: LogEventDefinition<UntapAllPayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  return [player, { kind: "text", text: " untapped all permanents" }];
};

const formatTransform: LogEventDefinition<TransformPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  const includeFace = cardPart.text !== "a card" && payload.toFaceName;
  const verb =
    payload.verb ??
    (ctx.cards[payload.cardId]?.scryfall?.layout === "flip" ? "flipped" : "transformed");
  return [
    actor,
    { kind: "text" as const, text: ` ${verb} ` },
    cardPart,
    ...(includeFace ? [{ kind: "text" as const, text: ` to ${payload.toFaceName}` }] : []),
  ];
};

const formatDuplicate: LogEventDefinition<DuplicatePayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.sourceCardId, zone, zone, payload.cardName);
  return [actor, { kind: "text", text: " created a token copy of " }, cardPart];
};

const formatRemove: LogEventDefinition<RemoveCardPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  return [actor, { kind: "text", text: " removed " }, cardPart];
};

const formatPT: LogEventDefinition<PTPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  const from = `${payload.fromPower ?? "?"} / ${payload.fromToughness ?? "?"}`;
  const to = `${payload.toPower ?? "?"} / ${payload.toToughness ?? "?"}`;
  return [actor, { kind: "text", text: " set " }, cardPart, { kind: "text", text: ` P/T to ${to} (was ${from})` }];
};

const formatTokenCreate: LogEventDefinition<TokenCreatePayload>["format"] = (payload, ctx) => {
  const player = buildPlayerPart(ctx, payload.playerId);
  const count = payload.count ?? 1;
  const tokenName = payload.tokenName?.trim() || "Token";
  const suffix = count === 1 ? "" : "s";
  return [player, { kind: "text", text: ` created ${count} ${tokenName} token${suffix}` }];
};

const formatFaceUp: LogEventDefinition<FaceUpPayload>["format"] = (payload, ctx) => {
  const actor = buildPlayerPart(ctx, payload.actorId);
  const zone = getLogZone(ctx, payload.zoneId, payload.zoneType);
  const cardPart = buildCardPart(ctx, payload.cardId, zone, zone, payload.cardName);
  return [
    actor,
    { kind: "text", text: " revealed " },
    cardPart,
    { kind: "text", text: " from facedown" },
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
        const name = payload.tokenName?.trim() || "Token";
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
} satisfies Partial<Record<LogEventId, LogEventDefinition<any>>>;
