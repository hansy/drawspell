import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { curatedDecks } from "@/data/curatedDecks";

import { useLoadDeckController } from "../useLoadDeckController";

const mocks = vi.hoisted(() => ({
  planDeckImport: vi.fn(),
  getYDocHandles: vi.fn(() => ({})),
  getYProvider: vi.fn(() => ({ wsconnected: true })),
}));

vi.mock("@/models/game/load-deck/loadDeckModel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/game/load-deck/loadDeckModel")>();
  return {
    ...actual,
    planDeckImport: mocks.planDeckImport,
  };
});

vi.mock("@/yjs/docManager", () => ({
  getYDocHandles: mocks.getYDocHandles,
  getYProvider: mocks.getYProvider,
}));

vi.mock("@/store/gameStore", () => ({
  useGameStore: (selector: (state: any) => unknown) =>
    selector({
      addCards: vi.fn(),
      addZone: vi.fn(),
      setDeckLoaded: vi.fn(),
      shuffleLibrary: vi.fn(),
      zones: {},
      cards: {},
      players: { p1: { deckLoaded: false } },
      viewerRole: "player",
    }),
}));

vi.mock("@/store/clientPrefsStore", () => ({
  useClientPrefsStore: (selector: (state: any) => unknown) =>
    selector({
      lastImportedDeckText: null,
      setLastImportedDeckText: vi.fn(),
    }),
}));

describe("useLoadDeckController", () => {
  it("selecting a curated deck populates import text without submitting", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useLoadDeckController({ isOpen: true, onClose, playerId: "p1" })
    );

    act(() => {
      result.current.handleCuratedDeckImport(curatedDecks[0]);
    });

    expect(result.current.importText).toBe(curatedDecks[0].decklist);
    expect(result.current.activeCuratedDeckId).toBe(curatedDecks[0].id);
    expect(mocks.planDeckImport).not.toHaveBeenCalled();
    expect(mocks.getYDocHandles).not.toHaveBeenCalled();
    expect(mocks.getYProvider).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
