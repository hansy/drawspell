import { create } from "zustand";

type SelectionState = {
  selectedCardIds: string[];
  selectionZoneId: string | null;
  setSelection: (ids: string[], zoneId: string | null) => void;
  clearSelection: () => void;
  selectOnly: (cardId: string, zoneId: string) => void;
  toggleCard: (cardId: string, zoneId: string) => void;
};

type SelectionSnapshot = Pick<SelectionState, "selectedCardIds" | "selectionZoneId">;

const selectedCardIdSets = new WeakMap<readonly string[], ReadonlySet<string>>();

export const getSelectedCardIdSet = (
  selectedCardIds: readonly string[]
): ReadonlySet<string> => {
  const cached = selectedCardIdSets.get(selectedCardIds);
  if (cached) return cached;

  const selectedCardIdSet = new Set(selectedCardIds);
  selectedCardIdSets.set(selectedCardIds, selectedCardIdSet);
  return selectedCardIdSet;
};

export const selectIsCardSelected = (
  state: SelectionSnapshot,
  cardId: string,
  zoneId: string
) =>
  state.selectionZoneId === zoneId &&
  getSelectedCardIdSet(state.selectedCardIds).has(cardId);

const uniqueIds = (ids: string[]) => Array.from(new Set(ids));
const normalizeSelectionSnapshot = (
  ids: string[],
  zoneId: string | null
): SelectionSnapshot => {
  const selectedCardIds = uniqueIds(ids);
  return {
    selectedCardIds,
    selectionZoneId: selectedCardIds.length ? zoneId : null,
  };
};

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedCardIds: [],
  selectionZoneId: null,
  setSelection: (ids, zoneId) => set(normalizeSelectionSnapshot(ids, zoneId)),
  clearSelection: () => set(normalizeSelectionSnapshot([], null)),
  selectOnly: (cardId, zoneId) => set(normalizeSelectionSnapshot([cardId], zoneId)),
  toggleCard: (cardId, zoneId) =>
    set((state) => {
      if (state.selectionZoneId && state.selectionZoneId !== zoneId) {
        return normalizeSelectionSnapshot([cardId], zoneId);
      }
      const selected = new Set(state.selectedCardIds);
      if (selected.has(cardId)) {
        selected.delete(cardId);
      } else {
        selected.add(cardId);
      }
      return normalizeSelectionSnapshot(Array.from(selected), zoneId);
    }),
}));
