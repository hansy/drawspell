import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const state = {
    attemptJoin: vi.fn(),
    resolveFullSync: null as null | (() => void),
    syncHandler: null as null | ((synced: boolean) => void),
    fullSync: vi.fn(),
    applyNewCommands: vi.fn(),
  };
  state.fullSync.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        state.resolveFullSync = resolve;
      }),
  );
  return state;
});

const mockGameState = vi.hoisted(() => ({
  hasHydrated: true,
  viewerRole: "player" as const,
  myPlayerId: "player-1",
}));

vi.mock("@/lib/featureFlags", () => ({ useCommandLog: true }));

vi.mock("@/store/gameStore", () => {
  const useGameStore = (selector: any) => selector(mockGameState);
  useGameStore.getState = () => mockGameState;
  useGameStore.setState = (updater: any) => {
    const next = typeof updater === "function" ? updater(mockGameState) : updater;
    Object.assign(mockGameState, next);
  };
  return { useGameStore };
});

vi.mock("@/yjs/sync", () => ({
  isApplyingRemoteUpdate: () => false,
}));

vi.mock("../debouncedTimeout", () => ({
  scheduleDebouncedTimeout: (_ref: any, _ms: number, cb: () => void) => cb(),
  cancelDebouncedTimeout: vi.fn(),
}));

vi.mock("../awarenessLifecycle", () => ({
  createAwarenessLifecycle: () => ({
    pushLocalAwareness: vi.fn(),
    handleAwarenessChange: vi.fn(),
    disposeAwareness: vi.fn(),
  }),
}));

vi.mock("../attemptJoin", () => ({
  createAttemptJoin: () => harness.attemptJoin,
}));

vi.mock("@/commandLog/sync", () => ({
  createCommandLogSync: () => ({
    fullSync: harness.fullSync,
    applyNewCommands: harness.applyNewCommands,
  }),
}));

vi.mock("../sessionResources", () => ({
  setupSessionResources: () => ({
    awareness: {
      on: vi.fn(),
      off: vi.fn(),
      setLocalStateField: vi.fn(),
    },
    provider: {
      on: vi.fn((event: string, handler: (payload: any) => void) => {
        if (event === "sync") {
          harness.syncHandler = handler;
        }
      }),
      connect: vi.fn(),
    },
    doc: {
      on: vi.fn(),
      off: vi.fn(),
      transact: vi.fn((fn: () => void) => fn()),
    },
    sharedMaps: {},
    ensuredPlayerId: "player-1",
    fullSyncToStore: vi.fn(),
    commands: { length: 0, get: vi.fn() },
    snapshots: undefined,
  }),
  teardownSessionResources: vi.fn(),
}));

import { useMultiplayerSync } from "../useMultiplayerSync";

describe("useMultiplayerSync (command log)", () => {
  beforeEach(() => {
    harness.attemptJoin.mockClear();
    harness.fullSync.mockClear();
    harness.applyNewCommands.mockClear();
    harness.resolveFullSync = null;
    harness.syncHandler = null;
    mockGameState.hasHydrated = true;
    mockGameState.viewerRole = "player";
    mockGameState.myPlayerId = "player-1";
  });

  it("waits for fullSync before attempting to join", async () => {
    renderHook(() => useMultiplayerSync("session-1"));

    await waitFor(() => {
      expect(harness.syncHandler).not.toBeNull();
    });

    act(() => {
      harness.syncHandler?.(true);
    });

    expect(harness.fullSync).toHaveBeenCalledTimes(1);
    expect(harness.attemptJoin).not.toHaveBeenCalled();

    await act(async () => {
      harness.resolveFullSync?.();
    });

    await waitFor(() => {
      expect(harness.attemptJoin).toHaveBeenCalledTimes(1);
    });
  });
});
