import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ZONE } from "@/constants/zones";
import { useGameStore } from "@/store/gameStore";
import { useSelectionStore } from "@/store/selectionStore";
import type { Card, Zone } from "@/types";

import { useSelectionSync } from "../useSelectionSync";

const Harness = () => {
  useSelectionSync();
  return null;
};

const buildCard = (id: string, zoneId: string): Card =>
  ({
    id,
    name: id,
    ownerId: "me",
    controllerId: "me",
    zoneId,
    tapped: false,
    faceDown: false,
    position: { x: 0, y: 0 },
    rotation: 0,
    counters: [],
  }) as Card;

describe("useSelectionSync", () => {
  beforeEach(() => {
    useGameStore.setState({ cards: {}, zones: {} });
    useSelectionStore.setState({ selectedCardIds: [], selectionZoneId: null });
  });

  it("retains cards selected in a non-battlefield zone", async () => {
    const zone: Zone = {
      id: "graveyard-me",
      ownerId: "me",
      type: ZONE.GRAVEYARD,
      cardIds: ["c1", "c2"],
    };
    useGameStore.setState({
      zones: { [zone.id]: zone },
      cards: {
        c1: buildCard("c1", zone.id),
        c2: buildCard("c2", zone.id),
      },
    });
    useSelectionStore.getState().setSelection(["c1", "c2"], zone.id);

    render(<Harness />);

    await waitFor(() =>
      expect(useSelectionStore.getState().selectedCardIds).toEqual(["c1", "c2"])
    );
  });

  it("removes selected cards that leave the selected zone", async () => {
    const zone: Zone = {
      id: "exile-me",
      ownerId: "me",
      type: ZONE.EXILE,
      cardIds: ["c1", "c2"],
    };
    useGameStore.setState({
      zones: { [zone.id]: zone },
      cards: {
        c1: buildCard("c1", zone.id),
        c2: buildCard("c2", zone.id),
      },
    });
    useSelectionStore.getState().setSelection(["c1", "c2"], zone.id);
    render(<Harness />);

    act(() => {
      useGameStore.setState((state) => ({
        cards: {
          ...state.cards,
          c2: { ...state.cards.c2, zoneId: "hand-me" },
        },
      }));
    });

    await waitFor(() =>
      expect(useSelectionStore.getState().selectedCardIds).toEqual(["c1"])
    );
  });
});
