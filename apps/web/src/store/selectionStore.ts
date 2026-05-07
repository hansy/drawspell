import { create } from "zustand";

type SelectionState = {
  selectedCardIds: string[];
  selectionZoneId: string | null;
  setSelection: (ids: string[], zoneId: string | null) => void;
  clearSelection: () => void;
  selectOnly: (cardId: string, zoneId: string) => void;
  toggleCard: (cardId: string, zoneId: string) => void;
};

const uniqueIds = (ids: string[]) => Array.from(new Set(ids));
const createSelectionState = (ids: string[], zoneId: string | null) => {
  const selectedCardIds = uniqueIds(ids);
  return {
    selectedCardIds,
    selectionZoneId: selectedCardIds.length ? zoneId : null,
  };
};

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedCardIds: [],
  selectionZoneId: null,
  setSelection: (ids, zoneId) => set(createSelectionState(ids, zoneId)),
  clearSelection: () => set(createSelectionState([], null)),
  selectOnly: (cardId, zoneId) => set(createSelectionState([cardId], zoneId)),
  toggleCard: (cardId, zoneId) =>
    set((state) => {
      if (state.selectionZoneId && state.selectionZoneId !== zoneId) {
        return createSelectionState([cardId], zoneId);
      }
      const selected = new Set(state.selectedCardIds);
      if (selected.has(cardId)) {
        selected.delete(cardId);
      } else {
        selected.add(cardId);
      }
      return createSelectionState(Array.from(selected), zoneId);
    }),
}));
