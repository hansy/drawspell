import { getCardDisplayName, getPlayerName, getZoneLabel } from './helpers';
import { LogContext, LogEventDefinition, LogEventId } from './types';

const DEFAULT_AGGREGATE_WINDOW_MS = 2000;

type LifePayload = { playerId: string; actorId?: string; from: number; to: number; delta?: number };
type CommanderTaxPayload = { playerId: string; actorId?: string; from: number; to: number; delta?: number };
type DrawPayload = { playerId: string; actorId?: string; count?: number };
type ShufflePayload = { playerId: string; actorId?: string };
type DeckPayload = { playerId: string; actorId?: string };
type MovePayload = { cardId: string; fromZoneId: string; toZoneId: string; actorId?: string };
type TapPayload = { cardId: string; zoneId: string; actorId?: string; tapped: boolean };
type UntapAllPayload = { playerId: string; actorId?: string };
type TransformPayload = { cardId: string; zoneId: string; actorId?: string; toFaceName?: string };
type DuplicatePayload = { sourceCardId: string; newCardId: string; zoneId: string; actorId?: string };
type RemoveCardPayload = { cardId: string; zoneId: string; actorId?: string };
type CounterPayload = { cardId: string; zoneId: string; actorId?: string; counterType: string; delta: number; newTotal: number };
type GlobalCounterPayload = { counterType: string; color?: string; actorId?: string };

const formatLife: LogEventDefinition<LifePayload>['format'] = (payload, ctx) => {
  const playerName = getPlayerName(ctx, payload.playerId);
  const delta = typeof payload.delta === 'number' ? payload.delta : payload.to - payload.from;
  const signed = delta >= 0 ? `+${delta}` : `${delta}`;
  return [
    { kind: 'player', text: playerName },
    { kind: 'text', text: ` life ${signed} (${payload.from} -> ${payload.to})` },
  ];
};

const formatCommanderTax: LogEventDefinition<CommanderTaxPayload>['format'] = (payload, ctx) => {
  const playerName = getPlayerName(ctx, payload.playerId);
  const delta = typeof payload.delta === 'number' ? payload.delta : payload.to - payload.from;
  const signed = delta >= 0 ? `+${delta}` : `${delta}`;
  return [
    { kind: 'player', text: playerName },
    { kind: 'text', text: ` commander tax ${signed} (${payload.from} -> ${payload.to})` },
  ];
};

const formatDraw: LogEventDefinition<DrawPayload>['format'] = (payload, ctx) => {
  const playerName = getPlayerName(ctx, payload.playerId);
  const count = payload.count || 1;
  const cardText = count === 1 ? 'drew a card' : `drew ${count} cards`;
  return [
    { kind: 'player', text: playerName },
    { kind: 'text', text: ` ${cardText}` },
  ];
};

const formatShuffle: LogEventDefinition<ShufflePayload>['format'] = (payload, ctx) => {
  const playerName = getPlayerName(ctx, payload.playerId);
  return [
    { kind: 'player', text: playerName },
    { kind: 'text', text: ' shuffled library' },
  ];
};

const formatMove: LogEventDefinition<MovePayload>['format'] = (payload, ctx) => {
  const actorName = getPlayerName(ctx, payload.actorId);
  const fromZone = ctx.zones[payload.fromZoneId];
  const toZone = ctx.zones[payload.toZoneId];
  const cardLabel = getCardDisplayName(ctx, payload.cardId, fromZone, toZone);

  const verb = fromZone?.type === 'hand' && toZone?.type === 'battlefield' ? 'played' : 'moved';

  return [
    { kind: 'player', text: actorName },
    { kind: 'text', text: ` ${verb} ` },
    { kind: 'card', text: cardLabel },
    { kind: 'text', text: ' — ' },
    { kind: 'zone', text: getZoneLabel(ctx, payload.fromZoneId) },
    { kind: 'text', text: ' -> ' },
    { kind: 'zone', text: getZoneLabel(ctx, payload.toZoneId) },
  ];
};

const formatTap: LogEventDefinition<TapPayload>['format'] = (payload, ctx) => {
  const actorName = getPlayerName(ctx, payload.actorId);
  const zone = ctx.zones[payload.zoneId];
  const cardLabel = getCardDisplayName(ctx, payload.cardId, zone, zone);
  const verb = payload.tapped ? 'tapped' : 'untapped';
  return [
    { kind: 'player', text: actorName },
    { kind: 'text', text: ` ${verb} ` },
    { kind: 'card', text: cardLabel },
  ];
};

const formatUntapAll: LogEventDefinition<UntapAllPayload>['format'] = (payload, ctx) => {
  const playerName = getPlayerName(ctx, payload.playerId);
  return [
    { kind: 'player', text: playerName },
    { kind: 'text', text: ' untapped all permanents' },
  ];
};

const formatTransform: LogEventDefinition<TransformPayload>['format'] = (payload, ctx) => {
  const actorName = getPlayerName(ctx, payload.actorId);
  const zone = ctx.zones[payload.zoneId];
  const cardLabel = getCardDisplayName(ctx, payload.cardId, zone, zone);
  const includeFace = cardLabel !== 'a card' && payload.toFaceName;
  return [
    { kind: 'player', text: actorName },
    { kind: 'text', text: ' transformed ' },
    { kind: 'card', text: cardLabel },
    ...(includeFace ? [{ kind: 'text', text: ` to ${payload.toFaceName}` }] : []),
  ];
};

const formatDuplicate: LogEventDefinition<DuplicatePayload>['format'] = (payload, ctx) => {
  const actorName = getPlayerName(ctx, payload.actorId);
  const zone = ctx.zones[payload.zoneId];
  const cardLabel = getCardDisplayName(ctx, payload.sourceCardId, zone, zone);
  return [
    { kind: 'player', text: actorName },
    { kind: 'text', text: ' created a token copy of ' },
    { kind: 'card', text: cardLabel },
  ];
};

const formatRemove: LogEventDefinition<RemoveCardPayload>['format'] = (payload, ctx) => {
  const actorName = getPlayerName(ctx, payload.actorId);
  const zone = ctx.zones[payload.zoneId];
  const cardLabel = getCardDisplayName(ctx, payload.cardId, zone, zone);
  return [
    { kind: 'player', text: actorName },
    { kind: 'text', text: ' removed ' },
    { kind: 'card', text: cardLabel },
  ];
};

const formatCounterAdd: LogEventDefinition<CounterPayload>['format'] = (payload, ctx) => {
  const actorName = getPlayerName(ctx, payload.actorId);
  const zone = ctx.zones[payload.zoneId];
  const cardLabel = getCardDisplayName(ctx, payload.cardId, zone, zone);
  return [
    { kind: 'player', text: actorName },
    { kind: 'text', text: ` added ${payload.delta} ${payload.counterType} counter${payload.delta === 1 ? '' : 's'} to ` },
    { kind: 'card', text: cardLabel },
    { kind: 'text', text: ` (now ${payload.newTotal})` },
  ];
};

const formatCounterRemove: LogEventDefinition<CounterPayload>['format'] = (payload, ctx) => {
  const actorName = getPlayerName(ctx, payload.actorId);
  const zone = ctx.zones[payload.zoneId];
  const cardLabel = getCardDisplayName(ctx, payload.cardId, zone, zone);
  const absDelta = Math.abs(payload.delta);
  return [
    { kind: 'player', text: actorName },
    { kind: 'text', text: ` removed ${absDelta} ${payload.counterType} counter${absDelta === 1 ? '' : 's'} from ` },
    { kind: 'card', text: cardLabel },
    { kind: 'text', text: ` (now ${payload.newTotal})` },
  ];
};

const formatGlobalCounterAdd: LogEventDefinition<GlobalCounterPayload>['format'] = (payload, _ctx) => {
  const colorSuffix = payload.color ? ` (${payload.color})` : '';
  return [
    { kind: 'text', text: `Added global counter type ${payload.counterType}${colorSuffix}` },
  ];
};

const formatDeckReset: LogEventDefinition<DeckPayload>['format'] = (payload, ctx) => {
  const playerName = getPlayerName(ctx, payload.playerId);
  return [
    { kind: 'player', text: playerName },
    { kind: 'text', text: ' reset their deck' },
  ];
};

const formatDeckUnload: LogEventDefinition<DeckPayload>['format'] = (payload, ctx) => {
  const playerName = getPlayerName(ctx, payload.playerId);
  return [
    { kind: 'player', text: playerName },
    { kind: 'text', text: ' unloaded their deck' },
  ];
};

export const logEventRegistry: Record<LogEventId, LogEventDefinition<any>> = {
  'player.life': {
    format: formatLife,
    aggregate: {
      key: (payload: LifePayload) => `life:${payload.playerId}`,
      mergePayload: (existing: LifePayload, incoming: LifePayload) => {
        const existingDelta = typeof existing.delta === 'number' ? existing.delta : existing.to - existing.from;
        const nextDelta = typeof incoming.delta === 'number' ? incoming.delta : incoming.to - incoming.from;
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
  'player.commanderTax': {
    format: formatCommanderTax,
  },
  'card.draw': {
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
  'library.shuffle': {
    format: formatShuffle,
  },
  'deck.reset': {
    format: formatDeckReset,
  },
  'deck.unload': {
    format: formatDeckUnload,
  },
  'card.move': {
    format: formatMove,
  },
  'card.tap': {
    format: formatTap,
  },
  'card.untapAll': {
    format: formatUntapAll,
  },
  'card.transform': {
    format: formatTransform,
  },
  'card.duplicate': {
    format: formatDuplicate,
  },
  'card.remove': {
    format: formatRemove,
  },
  'counter.add': {
    format: formatCounterAdd,
  },
  'counter.remove': {
    format: formatCounterRemove,
  },
  'counter.global.add': {
    format: formatGlobalCounterAdd,
  },
};
