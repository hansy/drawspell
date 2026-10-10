import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePreloadDeckStore } from "@/store/preloadDeckStore";
import { curatedDecks } from "@/data/curatedDecks";

import { useLoadDeckController } from "../useLoadDeckController";

const mocks = vi.hoisted(() => ({
  playerDeckLoaded: false,
  waitForIntentAcknowledgement: vi.fn(),
  planDeckImport: vi.fn(),
  getYDocHandles: vi.fn(() => ({})),
  getYProvider: vi.fn(() => ({ wsconnected: true })),
  addCards: vi.fn(),
  addZone: vi.fn(),
  setDeckLoaded: vi.fn(),
  updatePlayer: vi.fn(),
  shuffleLibrary: vi.fn(),
  setLastImportedDeckText: vi.fn(),
}));

vi.mock("@/partykit/intentTransport", () => ({ getIntentConnectionMeta: () => ({ isOpen: true }) }));

vi.mock("@/store/gameStore/dispatchIntent", () => ({ waitForIntentAcknowledgement: mocks.waitForIntentAcknowledgement }));

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
      sessionId: "room1",
      addCards: mocks.addCards,
      addZone: mocks.addZone,
      setDeckLoaded: mocks.setDeckLoaded,
      updatePlayer: mocks.updatePlayer,
      shuffleLibrary: mocks.shuffleLibrary,
      zones: {},
      cards: {},
      players: { p1: { deckLoaded: mocks.playerDeckLoaded } },
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
    usePreloadDeckStore.setState({ pending: null });
    mocks.playerDeckLoaded = false;
    mocks.waitForIntentAcknowledgement.mockResolvedValue(undefined);
    mocks.planDeckImport.mockResolvedValue({
      chunks: [],
      warnings: [],
      startingLife: 20,
    });
  });

  it("imports a private preload once, including after remount and duplicate delivery", async () => {
    usePreloadDeckStore.getState().receive("room1", "p1", { assignmentId: "assignment1", decklist: "1 Sol Ring", bracket: 3 });
    const onClose = vi.fn();
    const first = renderHook(() => useLoadDeckController({ isOpen: true, onClose, playerId: "p1" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.planDeckImport).toHaveBeenCalledWith(expect.objectContaining({ importText: "1 Sol Ring" }));
    expect(usePreloadDeckStore.getState().pending?.bracket).toBe(3);
    first.unmount();
    usePreloadDeckStore.getState().receive("room1", "p1", { assignmentId: "assignment1", decklist: "1 Sol Ring" });
    renderHook(() => useLoadDeckController({ isOpen: true, onClose, playerId: "p1" }));
    expect(mocks.planDeckImport).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite a current or replacement deck with a delayed preload", () => {
    mocks.playerDeckLoaded = true;
    usePreloadDeckStore.getState().receive("room1", "p1", { assignmentId: "assignment-existing", decklist: "1 Sol Ring" });
    renderHook(() => useLoadDeckController({ isOpen: true, onClose: vi.fn(), playerId: "p1" }));
    expect(mocks.planDeckImport).not.toHaveBeenCalled();
    expect(mocks.addCards).not.toHaveBeenCalled();
  });

  it("preserves ordinary manual imports after an earlier preload", async () => {
    usePreloadDeckStore.getState().receive("room1", "p1", { assignmentId: "assignment-manual", decklist: "1 Sol Ring" });
    usePreloadDeckStore.getState().start("assignment-manual");
    const onClose = vi.fn();
    const { result } = renderHook(() => useLoadDeckController({ isOpen: true, onClose, playerId: "p1" }));
    act(() => result.current.handleImportTextChange("1 Lightning Bolt"));
    await act(async () => { await result.current.handleImport(); });
    expect(mocks.planDeckImport).toHaveBeenCalledTimes(1);
    expect(mocks.planDeckImport).toHaveBeenCalledWith(expect.objectContaining({ importText: "1 Lightning Bolt" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed preload in the ordinary editor with the import error", async () => {
    mocks.planDeckImport.mockRejectedValueOnce(new Error("Unknown card: Missing Card"));
    usePreloadDeckStore.getState().receive("room1", "p1", { assignmentId: "assignment2", decklist: "1 Missing Card" });
    const onClose = vi.fn();
    const { result } = renderHook(() => useLoadDeckController({ isOpen: true, onClose, playerId: "p1" }));
    await waitFor(() => expect(result.current.error).toBe("Unknown card: Missing Card"));
    expect(result.current.importText).toBe("1 Missing Card");
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.setDeckLoaded).not.toHaveBeenCalled();
    act(() => result.current.handleImportTextChange("1 Sol Ring"));
    await act(async () => { await result.current.handleImport(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("waits for the final server acceptance before announcing success or closing", async () => {
    let accept!: () => void;
    mocks.waitForIntentAcknowledgement.mockImplementationOnce(() => new Promise<void>((resolve) => { accept = resolve; }));
    const onClose = vi.fn();
    const { result } = renderHook(() => useLoadDeckController({ isOpen: true, onClose, playerId: "p1" }));
    act(() => result.current.handleImportTextChange("1 Sol Ring"));
    let importing!: Promise<void>;
    act(() => { importing = result.current.handleImport(); });
    await waitFor(() => expect(mocks.waitForIntentAcknowledgement).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.setLastImportedDeckText).not.toHaveBeenCalled();
    await act(async () => { accept(); await importing; });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not set the loaded marker if a card batch is rejected", async () => {
    mocks.planDeckImport.mockResolvedValueOnce({ chunks: [[{ cardData: { name: "Sol Ring" }, zoneId: "lib", zoneType: "library" }]], warnings: [], startingLife: 20 });
    mocks.waitForIntentAcknowledgement.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Card batch rejected"));
    const onClose = vi.fn();
    const { result } = renderHook(() => useLoadDeckController({ isOpen: true, onClose, playerId: "p1" }));
    act(() => result.current.handleImportTextChange("1 Sol Ring"));
    await act(async () => { await result.current.handleImport(); });
    expect(result.current.error).toBe("Card batch rejected");
    expect(mocks.setDeckLoaded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
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
    expect(mocks.updatePlayer).toHaveBeenCalledWith("p1", { life: 20 }, "p1");
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
