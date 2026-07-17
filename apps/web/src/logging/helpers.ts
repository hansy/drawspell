import { ZONE_LABEL } from '@/constants/zones';
import { Card, CardId, PlayerId, Zone, ZoneType } from '@/types';
import { LogContext, LogMessagePart } from './types';

type ZoneLike = Pick<Zone, 'type'> | undefined;

const HIDDEN_LOG_ZONE_TYPES = new Set<string>(['library', 'hand']);

export const isPublicLogZoneType = (zoneType?: string): boolean => {
  if (!zoneType) return false;
  return !HIDDEN_LOG_ZONE_TYPES.has(zoneType);
};

export const isPublicLogZone = (zone?: ZoneLike) => (zone ? isPublicLogZoneType(zone.type) : false);

const isFaceDownInBattlefield = (card?: Card, zone?: ZoneLike) => zone?.type === 'battlefield' && card?.faceDown;

const shouldHideCardName = (card: Card | undefined, fromZone?: ZoneLike, toZone?: ZoneLike) => {
  if (!card) return true;

  const faceDown = isFaceDownInBattlefield(card, fromZone) || isFaceDownInBattlefield(card, toZone);
  if (faceDown) return true;

  const fromPublic = isPublicLogZone(fromZone);
  const toPublic = isPublicLogZone(toZone);

  // If the card is or will be in a public zone, it's safe to show its name.
  if (fromPublic || toPublic) return false;

  // Moving between hidden zones keeps the card name hidden.
  return true;
};

const resolveCardName = (card: Card) =>
  card.name ||
  card.scryfall?.card_faces?.[card.currentFaceIndex ?? 0]?.name ||
  card.scryfall?.card_faces?.[0]?.name ||
  'Card';

export const getPlayerName = (ctx: LogContext, playerId?: PlayerId) => {
  if (!playerId) return 'Unknown player';
  return ctx.players[playerId]?.name || 'Player';
};

export const getZoneLabel = (ctx: LogContext, zoneId?: string) => {
  if (!zoneId) return 'Unknown zone';
  const zone = ctx.zones[zoneId];
  if (!zone) return 'Unknown zone';
  return ZONE_LABEL[zone.type] || zone.type;
};

export const getZoneLabelFromType = (zoneType?: ZoneType) =>
  zoneType ? ZONE_LABEL[zoneType] || zoneType : 'Unknown zone';

export const getLogZone = (
  ctx: LogContext,
  zoneId?: string,
  fallbackType?: ZoneType,
): ZoneLike => {
  const zone = zoneId ? ctx.zones[zoneId] : undefined;
  return zone ?? (fallbackType ? { type: fallbackType } : undefined);
};

export const getLogZoneLabel = (
  ctx: LogContext,
  zoneId?: string,
  fallbackType?: ZoneType,
) => {
  if (!zoneId) return getZoneLabelFromType(fallbackType);
  const zone = ctx.zones[zoneId];
  if (zone) return ZONE_LABEL[zone.type] || zone.type;
  return getZoneLabelFromType(fallbackType);
};

export const getCardDisplayName = (
  ctx: LogContext,
  cardId?: string,
  fromZone?: ZoneLike,
  toZone?: ZoneLike,
  fallbackName?: string,
  forceHidden?: boolean,
) => {
  if (forceHidden) return 'a card';

  const card = cardId ? ctx.cards[cardId] : undefined;

  if (!card) {
    const fromPublic = isPublicLogZone(fromZone);
    const toPublic = isPublicLogZone(toZone);
    if (fromPublic || toPublic) {
      return fallbackName || 'a card';
    }
    return 'a card';
  }

  const hideName = shouldHideCardName(card, fromZone, toZone);
  if (hideName) {
    const fromPublic = isPublicLogZone(fromZone);
    const toPublic = isPublicLogZone(toZone);
    if (fallbackName && (fromPublic || toPublic)) return fallbackName;
    return 'a card';
  }

  return resolveCardName(card);
};

export const buildPlayerPart = (ctx: LogContext, playerId?: PlayerId): LogMessagePart => ({
  kind: 'player',
  text: getPlayerName(ctx, playerId),
  playerId,
});

export const buildCardPart = (
  ctx: LogContext,
  cardId?: CardId,
  fromZone?: ZoneLike,
  toZone?: ZoneLike,
  fallbackName?: string,
  forceHidden?: boolean,
): LogMessagePart => ({
  kind: 'card',
  text: getCardDisplayName(ctx, cardId, fromZone, toZone, fallbackName, forceHidden),
  cardId,
});
