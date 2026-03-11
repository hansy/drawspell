import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type IdleTimeoutOptions = {
  enabled: boolean;
  timeoutMs: number;
  warningMs?: number;
  onTimeout: () => void;
  onWarning?: () => void;
  onResume?: () => void;
  onActivity?: () => void;
  pollIntervalMs?: number;
  subscribe?: (markActivity: () => void) => () => void;
};

type DeferredShareLinksRequest = {
  promise: Promise<{
    playerInviteUrl: string;
    spectatorInviteUrl: string;
    resumeInviteUrl?: string | null;
  }>;
  resolve: (
    value: {
      playerInviteUrl: string;
      spectatorInviteUrl: string;
      resumeInviteUrl?: string | null;
    },
  ) => void;
  reject: (reason?: unknown) => void;
};

const createDeferredShareLinksRequest = (): DeferredShareLinksRequest => {
  let resolve!: DeferredShareLinksRequest["resolve"];
  let reject!: DeferredShareLinksRequest["reject"];
  const promise = new Promise<{
    playerInviteUrl: string;
    spectatorInviteUrl: string;
    resumeInviteUrl?: string | null;
  }>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const mockReadRoomTokensFromStorage = vi.hoisted(() => vi.fn());
const mockUseIdleTimeout = vi.hoisted(() =>
  vi.fn((_options: IdleTimeoutOptions) => ({
    markActivity: vi.fn(),
    getRemainingMs: vi.fn(),
  })),
);
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSendPartyMessage = vi.hoisted(() => vi.fn());
const mockRequestShareLinks = vi.hoisted(() => vi.fn());
const mockIntentConnectionMeta = vi.hoisted(() => ({
  isOpen: true,
  everConnected: true,
  lastOpenAt: 1,
  lastCloseAt: null as number | null,
}));
const mockSyncState = vi.hoisted(() => ({
  status: "connected",
  peerCounts: { total: 1, players: 1, spectators: 0 },
  joinBlocked: false,
  joinBlockedReason: null as string | null,
}));

const mockGameState = vi.hoisted(() => ({
  zones: {},
  cards: {},
  players: {},
  libraryRevealsToAll: {},
  playerOrder: [],
  battlefieldViewScale: {},
  battlefieldGridSizing: {},
  sessionId: "room-1",
  lastResumeTokenBySession: {} as Record<string, string>,
  viewerRole: "player" as "player" | "spectator",
  setViewerRole: vi.fn(),
  roomHostId: "player-1",
  roomLockedByHost: false,
  roomOverCapacity: false,
  roomTokens: null as any,
  setRoomLockedByHost: vi.fn(),
  activeModal: null as any,
  setActiveModal: vi.fn(),
  myPlayerId: "player-1",
  leaveGame: vi.fn(),
  updatePlayer: vi.fn(),
  drawCard: vi.fn(),
}));

const mockDragState = vi.hoisted(() => ({
  overCardScale: 1,
  activeCardId: null as string | null,
  activeCardScale: 1,
  isGroupDragging: false,
  ghostCards: null as any,
}));

const mockSelectionState = vi.hoisted(() => ({
  selectedCardIds: [] as string[],
  selectionZoneId: null as string | null,
}));

const mockPrefsState = vi.hoisted(() => ({
  username: "tester",
  setUsername: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouterState: ({ select }: any) =>
    select ? select({ location: { search: "" } }) : { location: { search: "" } },
}));

vi.mock("@/store/gameStore", () => {
  const useGameStore = (selector: any) => selector(mockGameState);
  useGameStore.getState = () => mockGameState;
  useGameStore.setState = (updater: any) => {
    const next = typeof updater === "function" ? updater(mockGameState) : updater;
    Object.assign(mockGameState, next);
  };
  return { useGameStore };
});

vi.mock("@/store/dragStore", () => {
  const useDragStore = (selector: any) => selector(mockDragState);
  useDragStore.getState = () => mockDragState;
  return { useDragStore };
});

vi.mock("@/store/selectionStore", () => {
  const useSelectionStore = (selector: any) => selector(mockSelectionState);
  useSelectionStore.getState = () => mockSelectionState;
  return { useSelectionStore };
});

vi.mock("@/store/clientPrefsStore", () => {
  const useClientPrefsStore = (selector: any) => selector(mockPrefsState);
  useClientPrefsStore.getState = () => mockPrefsState;
  return { useClientPrefsStore };
});

vi.mock("@/lib/playerColors", () => {
  const PLAYER_COLOR_PALETTE = [
    "red",
    "blue",
    "green",
    "yellow",
  ];
  return {
    PLAYER_COLOR_PALETTE,
    resolvePlayerColors: () => ({}),
    computePlayerColors: (ids: string[]) =>
      ids.reduce<Record<string, string>>((acc, id, index) => {
        acc[id] = PLAYER_COLOR_PALETTE[index % PLAYER_COLOR_PALETTE.length];
        return acc;
      }, {}),
    resolveOrderedPlayerIds: (
      players: Record<string, unknown>,
      playerOrder: string[],
    ) => (playerOrder.length ? playerOrder : Object.keys(players)),
    isPlayerColor: (value: unknown) => typeof value === "string",
  };
});

vi.mock("@/constants/zones", () => ({
  ZONE: { LIBRARY: "LIBRARY", BATTLEFIELD: "BATTLEFIELD" },
}));

vi.mock("@/hooks/scryfall/useScryfallCard", () => ({
  useScryfallCards: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: () => "uuid-1",
}));

vi.mock("@/partykit/intentTransport", () => ({
  sendIntent: vi.fn(),
  sendPartyMessage: mockSendPartyMessage,
  getIntentConnectionMeta: () => mockIntentConnectionMeta,
  subscribeIntentConnectionMeta: () => () => {},
}));

vi.mock("@/partykit/shareLinksClient", () => ({
  requestShareLinks: mockRequestShareLinks,
  isAbortedShareLinksRequest: (error: unknown) =>
    error instanceof Error && error.message === "share links request aborted",
}));

vi.mock("@/lib/partyKitToken", () => ({
  clearRoomHostPending: vi.fn(),
  clearRoomUnavailable: vi.fn(),
  isRoomHostPending: vi.fn(() => false),
  isRoomUnavailable: vi.fn(() => false),
  markRoomUnavailable: vi.fn(),
  markRoomAsHostPending: vi.fn(),
  readRoomTokensFromStorage: mockReadRoomTokensFromStorage,
  resolveInviteTokenFromUrl: vi.fn(() => ({})),
  writeRoomTokensToStorage: vi.fn(),
}));

vi.mock("../useBoardScale", () => ({
  useBoardScale: () => 1,
}));

vi.mock("../../context-menu/useGameContextMenu", () => ({
  useGameContextMenu: () => ({
    contextMenu: null,
    handleCardContextMenu: vi.fn(),
    handleZoneContextMenu: vi.fn(),
    handleBattlefieldContextMenu: vi.fn(),
    handleLifeContextMenu: vi.fn(),
    closeContextMenu: vi.fn(),
    countPrompt: null,
    openCountPrompt: vi.fn(),
    closeCountPrompt: vi.fn(),
    textPrompt: null,
    closeTextPrompt: vi.fn(),
  }),
}));

vi.mock("../../dnd/useGameDnD", () => ({
  useGameDnD: () => ({
    sensors: [],
    handleDragStart: vi.fn(),
    handleDragMove: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
}));

vi.mock("../../selection/useSelectionSync", () => ({
  useSelectionSync: vi.fn(),
}));

vi.mock("../../shortcuts/useGameShortcuts", () => ({
  useGameShortcuts: vi.fn(),
}));

vi.mock("../../shortcuts/model", () => ({
  areShortcutsBlockedByUi: () => false,
}));

vi.mock("../../multiplayer-sync/useMultiplayerSync", () => ({
  useMultiplayerSync: () => mockSyncState,
}));

vi.mock("../../player/usePlayerLayout", () => ({
  usePlayerLayout: () => ({
    slots: [],
    layoutMode: "single",
    myPlayerId: "player-1",
  }),
}));

vi.mock("@/models/game/selection/selectionModel", () => ({
  resolveSelectedCardIds: () => [],
}));

vi.mock("@/lib/room", () => ({
  MAX_PLAYERS: 4,
}));

vi.mock("@/hooks/shared/useIdleTimeout", () => ({
  useIdleTimeout: mockUseIdleTimeout,
}));

import { useMultiplayerBoardController } from "../useMultiplayerBoardController";

describe("useMultiplayerBoardController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    Object.assign(mockSyncState, {
      status: "connected",
      peerCounts: { total: 1, players: 1, spectators: 0 },
      joinBlocked: false,
      joinBlockedReason: null,
    });
    mockUseIdleTimeout.mockClear();
    mockReadRoomTokensFromStorage.mockReset();
    mockSendPartyMessage.mockReset();
    mockSendPartyMessage.mockReturnValue(true);
    mockRequestShareLinks.mockReset();
    Object.assign(mockIntentConnectionMeta, {
      isOpen: true,
      everConnected: true,
      lastOpenAt: 1,
      lastCloseAt: null,
    });
    Object.assign(mockGameState, {
      zones: {},
      cards: {},
      players: {},
      playerOrder: [],
      battlefieldViewScale: {},
      sessionId: "room-1",
      lastResumeTokenBySession: {},
      viewerRole: "player",
      roomTokens: null,
      roomLockedByHost: false,
      roomOverCapacity: false,
      activeModal: null,
    });
    window.history.replaceState({}, "", "/rooms/room-1");
  });

  it("requests share links from the server when the dialog opens", async () => {
    mockRequestShareLinks.mockResolvedValue({
      playerInviteUrl: "https://example.com/rooms/room-1?gt=token-123",
      spectatorInviteUrl: "https://example.com/rooms/room-1?st=spectator-123",
      resumeInviteUrl:
        "https://example.com/rooms/room-1?rt=resume-123&playerId=player-1",
    });

    const { result } = renderHook(() => useMultiplayerBoardController("room-1"));

    expect(result.current.canShareRoom).toBe(true);

    act(() => {
      result.current.setIsShareDialogOpen(true);
    });

    await waitFor(() => {
      expect(mockRequestShareLinks).toHaveBeenCalledTimes(1);
      expect(mockRequestShareLinks).toHaveBeenCalledWith({
        signal: expect.any(AbortSignal),
      });
    });

    await waitFor(() => expect(result.current.shareLinksReady).toBe(true));
    expect(result.current.shareLinks.players).toContain("gt=token-123");
    expect(result.current.shareLinks.spectators).toContain("st=spectator-123");
    expect(result.current.shareLinks.resume).toContain("rt=resume-123");
    expect(result.current.shareLinks.resume).toContain("playerId=player-1");
  });

  it("renders an error when the share links request fails", async () => {
    mockRequestShareLinks.mockRejectedValue(
      new Error("Unable to load invite links."),
    );

    const { result } = renderHook(() =>
      useMultiplayerBoardController("room-1")
    );

    act(() => {
      result.current.setIsShareDialogOpen(true);
    });

    await waitFor(() => {
      expect(mockRequestShareLinks).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.shareLinksReady).toBe(false);
      expect(result.current.shareDialogError).toBe(
        "Unable to load invite links.",
      );
    });
  });

  it("keeps share links disabled until the dialog request resolves", async () => {
    const deferredRequest = createDeferredShareLinksRequest();
    mockRequestShareLinks.mockReturnValue(deferredRequest.promise);

    const { result } = renderHook(() => useMultiplayerBoardController("room-1"));

    act(() => {
      result.current.setIsShareDialogOpen(true);
    });

    await waitFor(() => {
      expect(mockRequestShareLinks).toHaveBeenCalledTimes(1);
    });

    expect(result.current.shareLinksReady).toBe(false);

    act(() => {
      deferredRequest.resolve({
        playerInviteUrl: "https://example.com/rooms/room-1?gt=token-123",
        spectatorInviteUrl: "https://example.com/rooms/room-1?st=spectator-123",
        resumeInviteUrl:
          "https://example.com/rooms/room-1?rt=resume-live-456&playerId=player-1",
      });
    });

    await waitFor(() => {
      expect(result.current.shareLinksReady).toBe(true);
      expect(result.current.shareLinks.resume).toContain("rt=resume-live-456");
    });
  });

  it("does not request share links while room connection is pending", () => {
    mockSyncState.status = "connecting";

    const { result } = renderHook(() => useMultiplayerBoardController("room-1"));

    expect(result.current.canShareRoom).toBe(false);

    act(() => {
      result.current.setIsShareDialogOpen(true);
    });

    expect(mockRequestShareLinks).not.toHaveBeenCalled();
    expect(result.current.shareLinksReady).toBe(false);
    expect(result.current.shareDialogError).toBe("");
  });

  it("does not request share links while the intent transport is closed", () => {
    mockIntentConnectionMeta.isOpen = false;
    mockIntentConnectionMeta.lastCloseAt = 10;

    const { result } = renderHook(() => useMultiplayerBoardController("room-1"));

    expect(result.current.canShareRoom).toBe(false);

    act(() => {
      result.current.setIsShareDialogOpen(true);
    });

    expect(mockRequestShareLinks).not.toHaveBeenCalled();
    expect(result.current.shareLinksReady).toBe(false);
    expect(result.current.shareDialogError).toBe("");
  });

  it("disables idle timeout for spectators", () => {
    mockGameState.viewerRole = "spectator";

    renderHook(() => useMultiplayerBoardController("room-1"));

    expect(mockUseIdleTimeout).toHaveBeenCalledTimes(1);
    const options = mockUseIdleTimeout.mock.calls.at(0)?.[0];
    if (!options) {
      throw new Error("Expected useIdleTimeout to be called with options.");
    }
    expect(options.enabled).toBe(false);
  });

});
