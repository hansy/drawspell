import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { moveCard, patchCard, removePlayer, SharedMaps, sharedSnapshot, upsertCard as yUpsertCard, upsertPlayer as yUpsertPlayer, upsertZone as yUpsertZone } from './yMutations';
import { ZONE } from '../constants/zones';
import { Card, Player, Zone } from '../types';
import { SNAP_GRID_SIZE } from '../lib/snapping';

const createSharedMaps = (): SharedMaps => {
  const doc = new Y.Doc();
  return {
    players: doc.getMap('players'),
    playerOrder: doc.getArray('playerOrder'),
    zones: doc.getMap('zones'),
    cards: doc.getMap('cards'),
    zoneCardOrders: doc.getMap('zoneCardOrders'),
    globalCounters: doc.getMap('globalCounters'),
    battlefieldViewScale: doc.getMap('battlefieldViewScale'),
  };
};

const createDocAndMaps = (): { doc: Y.Doc; maps: SharedMaps } => {
  const doc = new Y.Doc();
  const maps: SharedMaps = {
    players: doc.getMap('players'),
    playerOrder: doc.getArray('playerOrder'),
    zones: doc.getMap('zones'),
    cards: doc.getMap('cards'),
    zoneCardOrders: doc.getMap('zoneCardOrders'),
    globalCounters: doc.getMap('globalCounters'),
    battlefieldViewScale: doc.getMap('battlefieldViewScale'),
  };
  return { doc, maps };
};

const measureTransactionUpdateBytes = (doc: Y.Doc, fn: () => void) => {
  let bytes = 0;
  const handler = (update: Uint8Array) => {
    bytes += update.byteLength;
  };
  doc.on('update', handler);
  doc.transact(fn);
  doc.off('update', handler);
  return bytes;
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

    yUpsertZone(maps, zone);
    yUpsertCard(maps, card);

    moveCard(maps, card.id, zone.id, { x: SNAP_GRID_SIZE, y: SNAP_GRID_SIZE });

    const updatedZone = sharedSnapshot(maps).zones[zone.id];
    expect(updatedZone?.cardIds).toEqual(['c1']);
  });
});

describe('Yjs update size regression', () => {
  it('moveCard does not rewrite the whole doc', () => {
    const { doc, maps } = createDocAndMaps();

    const zone: Zone = {
      id: 'z1',
      type: ZONE.BATTLEFIELD,
      ownerId: 'p1',
      cardIds: [],
    };
    yUpsertZone(maps, zone);

    const bigText = 'x'.repeat(5_000);

    // Add 100 cards with large identity fields.
    doc.transact(() => {
      for (let i = 0; i < 100; i++) {
        const id = `c${i}`;
        const card: Card = {
          id,
          ownerId: 'p1',
          controllerId: 'p1',
          zoneId: zone.id,
          name: `Card ${i}`,
          oracleText: bigText,
          tapped: false,
          faceDown: false,
          position: { x: 0.02 + i * 0.001, y: 0.02 + i * 0.001 },
          rotation: 0,
          counters: [],
        };
        zone.cardIds.push(id);
        yUpsertCard(maps, card);
      }
    });

    // Force a single collision to exercise the overlap-shift logic.
    const bytes = measureTransactionUpdateBytes(doc, () => {
      moveCard(maps, 'c0', zone.id, { x: 0.1, y: 0.1 });
    });

    // Should only touch the moved card (and at most a couple collision-adjusted cards).
    // If this ever spikes, it likely means we're rewriting full card payloads again.
    expect(bytes).toBeLessThan(10_000);
  });

  it('patchCard(tapped) stays small even with large card payloads', () => {
    const { doc, maps } = createDocAndMaps();

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
      name: 'Big Card',
      oracleText: 'x'.repeat(10_000),
      tapped: false,
      faceDown: false,
      position: { x: 0.1, y: 0.1 },
      rotation: 0,
      counters: [],
    };

    doc.transact(() => {
      yUpsertZone(maps, zone);
      yUpsertCard(maps, card);
    });

    const bytes = measureTransactionUpdateBytes(doc, () => {
      patchCard(maps, card.id, { tapped: true });
    });

    expect(bytes).toBeLessThan(2_000);
  });

  it('upsertCard strips full ScryfallCard blobs before syncing', () => {
    const { doc, maps } = createDocAndMaps();

    const zone: Zone = {
      id: 'z1',
      type: ZONE.BATTLEFIELD,
      ownerId: 'p1',
      cardIds: [],
    };
    yUpsertZone(maps, zone);

    const hugeBlob = 'x'.repeat(50_000);
    const fullScryfall: any = {
      id: 's1',
      layout: 'token',
      type_line: 'Token Creature',
      color_identity: [],
      blob: hugeBlob,
      image_uris: { normal: 'https://example.com/card.png' },
      card_faces: [{ name: 'Face', image_uris: { normal: 'https://example.com/face.png' }, power: '1', toughness: '1' }],
    };

    const card: Card = {
      id: 'c1',
      ownerId: 'p1',
      controllerId: 'p1',
      zoneId: zone.id,
      name: 'Big Token',
      typeLine: 'Token Creature',
      scryfallId: 's1',
      scryfall: fullScryfall,
      tapped: false,
      faceDown: false,
      position: { x: 0.1, y: 0.1 },
      rotation: 0,
      counters: [],
    };

    const bytes = measureTransactionUpdateBytes(doc, () => {
      yUpsertCard(maps, card);
    });

    // If full Scryfall payloads ever leak into the shared doc, this will spike.
    expect(bytes).toBeLessThan(10_000);

    const snapshot = sharedSnapshot(maps);
    const stored: any = snapshot.cards.c1?.scryfall;
    expect(stored).toBeTruthy();
    expect('type_line' in stored).toBe(false);
    expect('color_identity' in stored).toBe(false);
    expect('blob' in stored).toBe(false);
  });
});

describe('sharedSnapshot legacy compatibility', () => {
  it('reads legacy plain objects stored in maps', () => {
    const maps = createSharedMaps();

    maps.players.set('p1', {
      id: 'p1',
      name: 'Alice',
      life: 20,
      commanderTax: 1,
      commanderDamage: { p2: 3 },
      counters: [{ type: 'poison', count: 1 }],
    } as any);

    maps.zones.set('z1', {
      id: 'z1',
      type: ZONE.HAND,
      ownerId: 'p1',
      cardIds: ['c1'],
    } as any);

    maps.cards.set('c1', {
      id: 'c1',
      ownerId: 'p1',
      controllerId: 'p1',
      zoneId: 'z1',
      position: { x: 0.25, y: 0.25 },
      counters: [{ type: '+1/+1', count: 2 }],
    } as any);

    const snapshot = sharedSnapshot(maps);

    expect(snapshot.players.p1?.name).toBe('Alice');
    expect(snapshot.players.p1?.commanderDamage?.p2).toBe(3);
    expect(snapshot.zones.z1?.cardIds).toEqual(['c1']);
    expect(snapshot.cards.c1?.zoneId).toBe('z1');
    expect(snapshot.cards.c1?.counters[0]).toEqual({ type: '+1/+1', count: 2 });
  });
});

describe('player order tracking', () => {
  it('adds and removes players from the shared order', () => {
    const maps = createSharedMaps();
    const p1: Player = { id: 'p1', name: 'P1', life: 40, counters: [], commanderDamage: {}, commanderTax: 0 };
    const p2: Player = { id: 'p2', name: 'P2', life: 40, counters: [], commanderDamage: {}, commanderTax: 0 };

    yUpsertPlayer(maps, p1);
    yUpsertPlayer(maps, p2);

    expect(sharedSnapshot(maps).playerOrder).toEqual(['p1', 'p2']);

    removePlayer(maps, 'p1');
    expect(sharedSnapshot(maps).playerOrder).toEqual(['p2']);
  });
});

describe('write-time clamping', () => {
  it('clamps customText and counter type lengths', () => {
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
      name: 'Card',
      tapped: false,
      faceDown: false,
      position: { x: 0.1, y: 0.1 },
      rotation: 0,
      counters: [{ type: 'x'.repeat(500), count: 1, color: '#'.repeat(200) }],
      customText: 'y'.repeat(1_000),
    };

    yUpsertZone(maps, zone);
    yUpsertCard(maps, card);

    const snapshot = sharedSnapshot(maps);
    expect(snapshot.cards.c1?.customText?.length).toBe(280);
    expect(snapshot.cards.c1?.counters?.[0]?.type.length).toBeLessThanOrEqual(64);
    expect(snapshot.cards.c1?.counters?.[0]?.color?.length).toBeLessThanOrEqual(32);
  });
});
