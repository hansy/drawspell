import { create } from "zustand";

import { ZONE } from "@/constants/zones";
import type { GameState } from "@/types";

// Undo covers your own reversible table actions only. Draws, shuffles, token
// removal and moves out of hidden zones are left out: the server cannot hide
// information again once it has been shown.
export type UndoEntry = {
  label: string;
  // Returns false when the table changed since, so the action can't be reversed.
  undo: () => boolean;
};

const MAX_UNDO_ENTRIES = 50;

export const useUndoStore = create<{
  entries: UndoEntry[];
  push: (entry: UndoEntry) => void;
  clear: () => void;
}>((set) => ({
  entries: [],
  push: (entry) =>
    set((state) => ({
      entries: [...state.entries, entry].slice(-MAX_UNDO_ENTRIES),
    })),
  clear: () => set({ entries: [] }),
}));

let isUndoing = false;

export const undoLastAction = (): { undone: boolean; label?: string } => {
  const { entries } = useUndoStore.getState();
  const entry = entries[entries.length - 1];
  if (!entry) return { undone: false };
  useUndoStore.setState({ entries: entries.slice(0, -1) });
  isUndoing = true;
  try {
    return { undone: entry.undo(), label: entry.label };
  } finally {
    isUndoing = false;
  }
};

type UndoableActions = Pick<
  GameState,
  | "tapCard"
  | "untapAll"
  | "moveCard"
  | "updatePlayer"
  | "adjustMana"
  | "addCounterToCard"
  | "removeCounterFromCard"
>;

const UNDOABLE_DESTINATIONS = new Set<string>([ZONE.BATTLEFIELD, ZONE.GRAVEYARD, ZONE.EXILE]);

export const withUndo = (
  get: () => GameState,
  actions: UndoableActions,
): UndoableActions => {
  const isLocalActor = (actorId: string | undefined, isRemote: boolean | undefined) =>
    !isRemote && !isUndoing && (!actorId || actorId === get().myPlayerId);
  const record = (entry: UndoEntry) => useUndoStore.getState().push(entry);

  return {
    tapCard: (cardId, actorId, isRemote) => {
      const before = get().cards[cardId];
      actions.tapCard(cardId, actorId, isRemote);
      const after = get().cards[cardId];
      if (!isLocalActor(actorId, isRemote) || !before || !after) return;
      if (after.tapped === before.tapped) return;
      record({
        label: `${after.tapped ? "tap" : "untap"} ${after.name}`,
        undo: () => {
          const current = get().cards[cardId];
          if (!current || current.tapped === before.tapped) return false;
          actions.tapCard(cardId);
          return true;
        },
      });
    },

    untapAll: (playerId, isRemote) => {
      const state = get();
      const tappedIds = Object.values(state.cards)
        .filter((card) => card.tapped && card.controllerId === playerId)
        .filter((card) => state.zones[card.zoneId]?.type === ZONE.BATTLEFIELD)
        .map((card) => card.id);
      actions.untapAll(playerId, isRemote);
      if (!isLocalActor(playerId, isRemote) || tappedIds.length === 0) return;
      record({
        label: "untap all",
        undo: () => {
          const untapped = tappedIds.filter((id) => get().cards[id]?.tapped === false);
          untapped.forEach((id) => actions.tapCard(id));
          return untapped.length > 0;
        },
      });
    },

    moveCard: (cardId, toZoneId, position, actorId, isRemote, opts) => {
      const state = get();
      const before = state.cards[cardId];
      const fromZone = before ? state.zones[before.zoneId] : undefined;
      const toZone = state.zones[toZoneId];
      actions.moveCard(cardId, toZoneId, position, actorId, isRemote, opts);
      if (!isLocalActor(actorId, isRemote) || !before || !fromZone || !toZone) return;
      if (fromZone.type !== ZONE.BATTLEFIELD || !UNDOABLE_DESTINATIONS.has(toZone.type)) return;
      if (before.isToken || before.faceDown) return;
      const after = get().cards[cardId];
      if (
        !after ||
        (after.zoneId === before.zoneId &&
          after.position.x === before.position.x &&
          after.position.y === before.position.y)
      ) {
        return;
      }
      const movedZoneId = after.zoneId;
      record({
        label: toZone.type === ZONE.BATTLEFIELD ? `move ${before.name}` : `${before.name} to ${toZone.type}`,
        undo: () => {
          const current = get().cards[cardId];
          if (!current || current.zoneId !== movedZoneId) return false;
          actions.moveCard(cardId, before.zoneId, before.position);
          return true;
        },
      });
    },

    updatePlayer: (id, updates, actorId, isRemote) => {
      const before = get().players[id];
      actions.updatePlayer(id, updates, actorId, isRemote);
      const after = get().players[id];
      if (!isLocalActor(actorId, isRemote) || !before || !after) return;
      if (typeof updates.life !== "number" || after.life === before.life) return;
      record({
        label: `life ${before.life} → ${after.life}`,
        undo: () => {
          if (get().players[id]?.life !== after.life) return false;
          actions.updatePlayer(id, { life: before.life });
          return true;
        },
      });
    },

    adjustMana: (playerId, manaType, delta, actorId, isRemote) => {
      const amount = (id: string) => get().players[id]?.manaPool?.[manaType] ?? 0;
      const before = amount(playerId);
      actions.adjustMana(playerId, manaType, delta, actorId, isRemote);
      const after = amount(playerId);
      if (!isLocalActor(actorId, isRemote) || after === before) return;
      record({
        label: `${manaType} mana`,
        undo: () => {
          if (amount(playerId) !== after) return false;
          const step = before > after ? 1 : -1;
          for (let i = 0; i < Math.abs(before - after); i += 1) {
            actions.adjustMana(playerId, manaType, step);
          }
          return true;
        },
      });
    },

    addCounterToCard: (cardId, counter, actorId, isRemote) => {
      const count = (id: string) =>
        get().cards[id]?.counters.find((c) => c.type === counter.type)?.count ?? 0;
      const before = count(cardId);
      actions.addCounterToCard(cardId, counter, actorId, isRemote);
      const after = count(cardId);
      if (!isLocalActor(actorId, isRemote) || after <= before) return;
      record({
        label: `${counter.type} counter`,
        undo: () => {
          if (count(cardId) !== after) return false;
          actions.removeCounterFromCard(cardId, counter.type, undefined, undefined, after - before);
          return true;
        },
      });
    },

    removeCounterFromCard: (cardId, counterType, actorId, isRemote, removeCount) => {
      const existing = () => get().cards[cardId]?.counters.find((c) => c.type === counterType);
      const beforeCounter = existing();
      const before = beforeCounter?.count ?? 0;
      actions.removeCounterFromCard(cardId, counterType, actorId, isRemote, removeCount);
      const after = existing()?.count ?? 0;
      if (!isLocalActor(actorId, isRemote) || !beforeCounter || after >= before) return;
      record({
        label: `${counterType} counter`,
        undo: () => {
          if ((existing()?.count ?? 0) !== after) return false;
          actions.addCounterToCard(cardId, { ...beforeCounter, count: before - after });
          return true;
        },
      });
    },
  };
};
