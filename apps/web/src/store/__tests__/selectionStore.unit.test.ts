import { beforeEach, describe, expect, it } from "vitest";

import { useSelectionStore } from "../selectionStore";

describe("selectionStore", () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selectedCardIds: [],
      selectionZoneId: null,
    });
  });

  it("deduplicates selected ids and clears zone metadata for an empty selection", () => {
    const store = useSelectionStore.getState();

    store.setSelection(["c1", "c1", "c2"], "zone-a");
    expect(useSelectionStore.getState()).toMatchObject({
      selectedCardIds: ["c1", "c2"],
      selectionZoneId: "zone-a",
    });

    store.setSelection([], "zone-a");
    expect(useSelectionStore.getState()).toMatchObject({
      selectedCardIds: [],
      selectionZoneId: null,
    });
  });

  it("preserves the empty-selection invariant when toggling cards", () => {
    const store = useSelectionStore.getState();

    store.toggleCard("c1", "zone-a");
    expect(useSelectionStore.getState()).toMatchObject({
      selectedCardIds: ["c1"],
      selectionZoneId: "zone-a",
    });

    store.toggleCard("c1", "zone-a");
    expect(useSelectionStore.getState()).toMatchObject({
      selectedCardIds: [],
      selectionZoneId: null,
    });
  });
});
