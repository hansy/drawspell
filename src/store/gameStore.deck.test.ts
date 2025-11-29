import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { ZONE } from '../constants/zones';

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
};

describe('gameStore deck management', () => {
  beforeAll(() => {
    if (typeof globalThis.localStorage === 'undefined') {
      Object.defineProperty(globalThis, 'localStorage', {
        value: createMemoryStorage(),
        configurable: true,
      });
    }
  });

  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      cards: {},
      zones: {},
      players: {},
      myPlayerId: 'me',
    });
  });

  const buildZone = (id: string, type: keyof typeof ZONE, ownerId: string, cardIds: string[] = []) => ({
    id,
    type: ZONE[type],
    ownerId,
    cardIds,
  });

  it('resets deck by returning owned non-token cards to library and removing tokens', () => {
    const library = buildZone('lib-me', 'LIBRARY', 'me', ['c1']);
    const graveyard = buildZone('gy-me', 'GRAVEYARD', 'me', ['c2']);
    const exile = buildZone('ex-me', 'EXILE', 'me', ['c3']);
    const battlefield = buildZone('bf-me', 'BATTLEFIELD', 'me', ['t1']);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [library.id]: library, [graveyard.id]: graveyard, [exile.id]: exile, [battlefield.id]: battlefield },
      players: { me: { id: 'me', name: 'Me', life: 40, counters: [], commanderDamage: {}, deckLoaded: true } },
      cards: {
        c1: { id: 'c1', name: 'Card1', ownerId: 'me', controllerId: 'me', zoneId: library.id, tapped: false, faceDown: false, position: { x: 0, y: 0 }, rotation: 0, counters: [] },
        c2: { id: 'c2', name: 'Card2', ownerId: 'me', controllerId: 'me', zoneId: graveyard.id, tapped: false, faceDown: false, position: { x: 0, y: 0 }, rotation: 0, counters: [] },
        c3: { id: 'c3', name: 'Card3', ownerId: 'me', controllerId: 'me', zoneId: exile.id, tapped: false, faceDown: false, position: { x: 0, y: 0 }, rotation: 0, counters: [] },
        t1: { id: 't1', name: 'Token', ownerId: 'me', controllerId: 'me', zoneId: battlefield.id, tapped: false, faceDown: false, position: { x: 0, y: 0 }, rotation: 0, counters: [], isToken: true },
      },
    }));

    useGameStore.getState().resetDeck('me', 'me');

    const state = useGameStore.getState();
    expect(state.cards.t1).toBeUndefined();
    const libraryZone = state.zones[library.id];
    expect(libraryZone.cardIds).toHaveLength(3);
    expect(new Set(libraryZone.cardIds)).toEqual(new Set(['c1', 'c2', 'c3']));
    expect(state.zones[graveyard.id].cardIds).toEqual([]);
    expect(state.zones[exile.id].cardIds).toEqual([]);
    expect(state.zones[battlefield.id].cardIds).toEqual([]);
  });

  it('unloads deck by removing owned cards and marking deck as not loaded', () => {
    const library = buildZone('lib-me', 'LIBRARY', 'me', ['c1', 'c2']);
    const graveyard = buildZone('gy-me', 'GRAVEYARD', 'me', ['c3']);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [library.id]: library, [graveyard.id]: graveyard },
      players: { me: { id: 'me', name: 'Me', life: 40, counters: [], commanderDamage: {}, deckLoaded: true } },
      cards: {
        c1: { id: 'c1', name: 'Card1', ownerId: 'me', controllerId: 'me', zoneId: library.id, tapped: false, faceDown: false, position: { x: 0, y: 0 }, rotation: 0, counters: [] },
        c2: { id: 'c2', name: 'Card2', ownerId: 'me', controllerId: 'me', zoneId: library.id, tapped: false, faceDown: false, position: { x: 0, y: 0 }, rotation: 0, counters: [] },
        c3: { id: 'c3', name: 'Card3', ownerId: 'me', controllerId: 'me', zoneId: graveyard.id, tapped: false, faceDown: false, position: { x: 0, y: 0 }, rotation: 0, counters: [] },
      },
    }));

    useGameStore.getState().unloadDeck('me', 'me');

    const state = useGameStore.getState();
    expect(state.cards).toEqual({});
    expect(state.zones[library.id].cardIds).toEqual([]);
    expect(state.zones[graveyard.id].cardIds).toEqual([]);
    expect(state.players.me.deckLoaded).toBe(false);
  });
});
