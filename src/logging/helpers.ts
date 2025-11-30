import { ZONE_LABEL } from '../constants/zones';
import { Card, PlayerId, Zone } from '../types';
import { LogContext } from './types';

const HIDDEN_ZONE_TYPES: Zone['type'][] = ['library', 'hand'];

const isHiddenZone = (zone?: Zone) => zone ? HIDDEN_ZONE_TYPES.includes(zone.type) : false;

const isFaceDownInBattlefield = (card?: Card, zone?: Zone) => zone?.type === 'battlefield' && card?.faceDown;

const shouldHideCardName = (card: Card | undefined, fromZone?: Zone, toZone?: Zone) => {
  const faceDown = isFaceDownInBattlefield(card, fromZone) || isFaceDownInBattlefield(card, toZone);
  if (faceDown) return true;

  const fromPublic = fromZone ? !isHiddenZone(fromZone) : false;
  const toPublic = toZone ? !isHiddenZone(toZone) : false;

  // If the card is or will be in a public zone, it's safe to show its name.
  if (fromPublic || toPublic) return false;

  // Moving between hidden zones keeps the card name hidden.
  return true;
};

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

export const getCardDisplayName = (ctx: LogContext, cardId?: string, fromZone?: Zone, toZone?: Zone) => {
  const card = cardId ? ctx.cards[cardId] : undefined;
  if (!card) return 'a card';

  const hideName = shouldHideCardName(card, fromZone, toZone);
  if (hideName) return 'a card';

  return card.name || 'Card';
};
