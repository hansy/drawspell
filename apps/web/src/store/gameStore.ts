import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { GameState } from '@/types';
import { createGameStoreStorage } from '@/lib/safeStorage';
import { createIntentDispatcher } from './gameStore/dispatchIntent';

import { createCardActions } from './gameStore/actions/cards';
import { createCounterActions } from './gameStore/actions/counters';
import { createDeckActions } from './gameStore/actions/deck';
import { createMovementActions } from './gameStore/actions/movement';
import { createPrivateOverlayActions } from './gameStore/actions/privateOverlay';
import { createPlayerActions } from './gameStore/actions/players';
import { createSessionActions } from './gameStore/actions/session';
import { createUiActions } from './gameStore/actions/ui';
import { createZoneActions } from './gameStore/actions/zones';
import { withUndo } from './gameStore/undo';

interface GameStore extends GameState {
    // Additional actions or computed properties can go here
}

type PersistedGameStoreState = Pick<
    GameStore,
    'playerIdsBySession' | 'sessionVersions'
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const readTypedRecord = <Value>(
    value: unknown,
    isValidValue: (value: unknown) => value is Value
): Record<string, Value> => {
    if (!isRecord(value)) return {};
    const result: Record<string, Value> = {};
    Object.entries(value).forEach(([key, val]) => {
        if (isValidValue(val)) result[key] = val;
    });
    return result;
};

const readStringRecord = (value: unknown) =>
    readTypedRecord(value, (entry): entry is string => typeof entry === 'string');

const readNumberRecord = (value: unknown) =>
    readTypedRecord(
        value,
        (entry): entry is number => typeof entry === 'number' && Number.isFinite(entry)
    );

export const useGameStore = create<GameStore>()(
    persist<GameStore, [], [], PersistedGameStoreState>(
        (set, get) => {
            const dispatchIntent = createIntentDispatcher(set, get);

            const actions = {
                ...createSessionActions(set, get, { dispatchIntent }),
                ...createPrivateOverlayActions(set, get),
                ...createPlayerActions(set, get, { dispatchIntent }),
                ...createZoneActions(set, get, { dispatchIntent }),
                ...createCardActions(set, get, { dispatchIntent }),
                ...createMovementActions(set, get, { dispatchIntent }),
                ...createDeckActions(set, get, { dispatchIntent }),
                ...createCounterActions(set, get, { dispatchIntent }),
                ...createUiActions(set, get, { dispatchIntent }),
            };

            return ({
                players: {},
                playerOrder: [],
                cards: {},
                zones: {},
                handRevealsToAll: {},
                libraryRevealsToAll: {},
                faceDownRevealsToAll: {},
                battlefieldViewScale: {},
                battlefieldGridSizing: {},
                roomHostId: null,
                activePlayerId: null,
                roomOverCapacity: false,
                positionFormat: 'normalized',
                globalCounters: {},
                activeModal: null,

                ...actions,
                ...withUndo(get, actions),
            });
        },
        {
            name: 'drawspell-storage',
            version: 2,
            migrate: (persistedState: unknown, _version) => {
                // v2: only persist identity/session bookkeeping; game state comes from Yjs.
                const persisted = isRecord(persistedState) ? persistedState : {};
                return {
                    playerIdsBySession: readStringRecord(persisted.playerIdsBySession),
                    sessionVersions: readNumberRecord(persisted.sessionVersions),
                };
            },
            partialize: (state) => ({
                playerIdsBySession: state.playerIdsBySession,
                sessionVersions: state.sessionVersions,
            }),
            storage: createJSONStorage(createGameStoreStorage),
            onRehydrateStorage: () => (state) => {
                if (!state) return;

                if (!state.playerIdsBySession) {
                    state.playerIdsBySession = {};
                }
                if (!state.sessionVersions) {
                    state.sessionVersions = {};
                }
                state.setHasHydrated(true);
            },
        }
    )
);
