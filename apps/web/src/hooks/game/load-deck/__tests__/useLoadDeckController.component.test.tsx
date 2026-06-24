import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { curatedDecks } from "@/data/curatedDecks";

import { useLoadDeckController } from "../useLoadDeckController";

const mocks = vi.hoisted(() => ({
  planDeckImport: vi.fn(),
  getYDocHandles: vi.fn(() => ({})),
  getYProvider: vi.fn(() => ({ wsconnected: true })),
  addCards: vi.fn(),
  addZone: vi.fn(),
  setDeckLoaded: vi.fn(),
  shuffleLibrary: vi.fn(),
  setLastImportedDeckText: vi.fn(),
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
      addCards: mocks.addCards,
      addZone: mocks.addZone,
      setDeckLoaded: mocks.setDeckLoaded,
      shuffleLibrary: mocks.shuffleLibrary,
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
      setLastImportedDeckText: mocks.setLastImportedDeckText,
    }),
}));

describe("useLoadDeckController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.planDeckImport.mockResolvedValue({
      chunks: [],
      warnings: [],
    });
  });

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

  it("does not save an unchanged curated deck as the last imported text", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useLoadDeckController({ isOpen: true, onClose, playerId: "p1" })
    );

    act(() => {
      result.current.handleCuratedDeckImport(curatedDecks[0]);
    });

    await act(async () => {
      await result.current.handleImport();
    });

    expect(mocks.planDeckImport).toHaveBeenCalledWith(
      expect.objectContaining({ importText: curatedDecks[0].decklist })
    );
    expect(mocks.setLastImportedDeckText).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("saves curated text when the user edits it before importing", async () => {
    const onClose = vi.fn();
    const editedDeckText = `${curatedDecks[0].decklist}\n1 Lightning Bolt`;
    const { result } = renderHook(() =>
      useLoadDeckController({ isOpen: true, onClose, playerId: "p1" })
    );

    act(() => {
      result.current.handleCuratedDeckImport(curatedDecks[0]);
    });
    act(() => {
      result.current.handleImportTextChange(editedDeckText);
    });

    await act(async () => {
      await result.current.handleImport();
    });

    expect(mocks.setLastImportedDeckText).toHaveBeenCalledWith(editedDeckText);
  });
});
