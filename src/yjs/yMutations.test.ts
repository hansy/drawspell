import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { moveCard, SharedMaps } from './yMutations';
import { ZONE } from '../constants/zones';
import { Card, Zone } from '../types';
import { SNAP_GRID_SIZE } from '../lib/snapping';

const createSharedMaps = (): SharedMaps => {
  const doc = new Y.Doc();
  return {
    players: doc.getMap('players'),
    zones: doc.getMap('zones'),
    cards: doc.getMap('cards'),
    globalCounters: doc.getMap('globalCounters'),
  };
};

describe('moveCard', () => {
  it('does not duplicate card ids when moving within the same zone', () => {
    const maps = createSharedMaps();

    const zone: Zone = {
      id: 'z1',
      type: ZONE.BATTLEFIELD,
      ownerId: 'p1',
      cardIds: ['c1'],
    };

    const card: Card = {
      id: 'c1',
      ownerId: 'p1',
      controllerId: 'p1',
      zoneId: zone.id,
      name: 'Test Card',
      tapped: false,
      faceDown: false,
      position: { x: 0, y: 0 },
      rotation: 0,
      counters: [],
    };

    maps.zones.set(zone.id, zone);
    maps.cards.set(card.id, card);

    moveCard(maps, card.id, zone.id, { x: SNAP_GRID_SIZE, y: SNAP_GRID_SIZE });

    const updatedZone = maps.zones.get(zone.id) as Zone | undefined;
    expect(updatedZone?.cardIds).toEqual(['c1']);
  });
});
