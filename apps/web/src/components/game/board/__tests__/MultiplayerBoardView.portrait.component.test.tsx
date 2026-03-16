import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MultiplayerBoardView } from "../MultiplayerBoardView";

vi.mock("../seat/Seat", () => ({
  Seat: ({ player }: { player: { id: string; name: string } }) => (
    <div data-testid={`seat-${player.id}`}>{player.name}</div>
  ),
}));

vi.mock("../card/CardView", () => ({
  CardView: () => null,
}));

vi.mock("../card/CardPreviewProvider", () => ({
  CardPreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../context-menu/ContextMenu", () => ({
  ContextMenu: () => null,
}));

vi.mock("../add-counter/AddCounterModal", () => ({
  AddCounterModal: () => null,
}));

vi.mock("../coin/CoinFlipDialog", () => ({
  CoinFlipDialog: () => null,
}));

vi.mock("../dice/DiceRollDialog", () => ({
  DiceRollDialog: () => null,
}));

vi.mock("../load-deck/LoadDeckModal", () => ({
  LoadDeckModal: () => null,
}));

vi.mock("../log-drawer/LogDrawer", () => ({
  LogDrawer: () => null,
}));

vi.mock("../prompts/NumberPromptDialog", () => ({
  NumberPromptDialog: () => null,
}));

vi.mock("../opponent-library-reveals/OpponentLibraryRevealsModal", () => ({
  OpponentLibraryRevealsModal: () => null,
}));

vi.mock("../shortcuts/ShortcutsDrawer", () => ({
  ShortcutsDrawer: () => null,
}));

vi.mock("../sidenav/Sidenav", () => ({
  Sidenav: () => <div data-testid="sidenav" />,
}));

vi.mock("../prompts/TextPromptDialog", () => ({
  TextPromptDialog: () => null,
}));

vi.mock("../token-creation/TokenCreationModal", () => ({
  TokenCreationModal: () => null,
}));

vi.mock("../zone-viewer/ZoneViewerModal", () => ({
  ZoneViewerModal: () => null,
}));

vi.mock("@/components/username/EditUsernameDialog", () => ({
  EditUsernameDialog: () => null,
}));

vi.mock("@/components/game/share/ShareRoomDialog", () => ({
  ShareRoomDialog: () => null,
}));

type PlayerSlot = {
  id: string;
  name: string;
  color: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

const buildSlots = (players: PlayerSlot[]) =>
  players.map((player) => ({
    player: {
      id: player.id,
      name: player.name,
      life: 40,
      counters: [],
      commanderDamage: {},
      commanderTax: 0,
      deckLoaded: true,
      color: player.color,
    },
    color: player.color,
    position: player.position,
  }));

const renderBoard = (players: PlayerSlot[]) => {
  const slots = buildSlots(players);
  const playersById = Object.fromEntries(
    slots.map((slot) => [slot.player.id, slot.player]),
  );

  return render(
    <MultiplayerBoardView
      {...({
        zones: {},
        cards: {},
        players: playersById,
        libraryRevealsToAll: {},
        battlefieldViewScale: {},
        battlefieldGridSizing: {},
        playerColors: {},
        gridClass: "grid-cols-1",
        scale: 1,
        myPlayerId: "p1",
        viewerRole: "player",
        slots,
        activeModal: null,
        setActiveModal: vi.fn(),
        overCardScale: 1,
        activeCardId: null,
        activeCardScale: 1,
        isGroupDragging: false,
        showGroupDragOverlay: false,
        groupDragCardIds: [],
        sensors: [],
        handleDragStart: vi.fn(),
        handleDragMove: vi.fn(),
        handleDragEnd: vi.fn(),
        syncStatus: "connected",
        peerCounts: {
          total: players.length,
          players: players.length,
          spectators: 0,
        },
        isHost: true,
        roomLockedByHost: false,
        roomIsFull: false,
        onToggleRoomLock: vi.fn(),
        handleViewZone: vi.fn(),
        contextMenu: null,
        handleCardContextMenu: vi.fn(),
        handleZoneContextMenu: vi.fn(),
        handleBattlefieldContextMenu: vi.fn(),
        handleLifeContextMenu: vi.fn(),
        handleOpenCoinFlipper: vi.fn(),
        handleOpenDiceRoller: vi.fn(),
        closeContextMenu: vi.fn(),
        countPrompt: null,
        closeCountPrompt: vi.fn(),
        textPrompt: null,
        closeTextPrompt: vi.fn(),
        isLoadDeckModalOpen: false,
        setIsLoadDeckModalOpen: vi.fn(),
        isTokenModalOpen: false,
        setIsTokenModalOpen: vi.fn(),
        isCoinFlipperOpen: false,
        setIsCoinFlipperOpen: vi.fn(),
        isDiceRollerOpen: false,
        setIsDiceRollerOpen: vi.fn(),
        isLogOpen: false,
        setIsLogOpen: vi.fn(),
        isShortcutsOpen: false,
        setIsShortcutsOpen: vi.fn(),
        isShareDialogOpen: false,
        setIsShareDialogOpen: vi.fn(),
        zoomControlsBlocked: false,
        isEditUsernameOpen: false,
        setIsEditUsernameOpen: vi.fn(),
        zoneViewerState: { isOpen: false, zoneId: null },
        setZoneViewerState: vi.fn(),
        revealedLibraryZoneId: null,
        setRevealedLibraryZoneId: vi.fn(),
        preferredUsername: null,
        handleUsernameSubmit: vi.fn(),
        handleDrawCard: vi.fn(),
        handleFlipCoin: vi.fn(),
        handleRollDice: vi.fn(),
        handleLeave: vi.fn(),
        shareLinks: { players: "", spectators: "", resume: "" },
        shareLinksReady: false,
        shareDialogError: "",
        canShareRoom: false,
        joinBlockedReason: null,
      } as any)}
    />,
  );
};

describe("MultiplayerBoardView portrait seat indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches:
          query === "(orientation: portrait)" || query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("uses a vertical mini-map for two-player portrait games", () => {
    renderBoard([
      { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
      { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
    ]);

    const indicator = screen.getByTestId("portrait-seat-indicator");
    expect(indicator.getAttribute("data-layout")).toBe("vertical");
    expect(indicator.getAttribute("data-state")).toBe("collapsed");

    fireEvent.click(screen.getByLabelText("Expand seat picker"));

    expect(screen.getByTestId("portrait-seat-indicator").getAttribute("data-state")).toBe(
      "expanded",
    );
    const options = screen.getAllByTestId("portrait-seat-option");
    expect(options).toHaveLength(1);
    expect(
      screen.getByLabelText("Switch to Player Two's seat").getAttribute(
        "data-seat-position",
      ),
    ).toBe("top-left");
    expect(within(options[0]).getByTestId("portrait-seat-option-color")).toBeTruthy();
    expect(screen.queryByLabelText("Switch to your seat")).toBeNull();
    expect(screen.queryByText("You")).toBeNull();
  });

  it("shows the other seats in shared layout order when expanded", () => {
    renderBoard([
      { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
      { id: "p3", name: "Player Three", color: "amber", position: "top-right" },
      { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
      { id: "p4", name: "Player Four", color: "rose", position: "bottom-right" },
    ]);

    const indicator = screen.getByTestId("portrait-seat-indicator");
    expect(indicator.getAttribute("data-layout")).toBe("square");
    expect(indicator.getAttribute("data-state")).toBe("collapsed");

    fireEvent.click(screen.getByLabelText("Expand seat picker"));

    const options = screen.getAllByTestId("portrait-seat-option");
    expect(options.map((option) => option.getAttribute("data-seat-position"))).toEqual([
      "top-left",
      "top-right",
      "bottom-right",
    ]);
    expect(options.map((option) => option.textContent)).toEqual([
      "Player Two",
      "Player Three",
      "Player Four",
    ]);
    expect(
      options.every((option) =>
        Boolean(within(option).getByTestId("portrait-seat-option-color")),
      ),
    ).toBe(true);
    expect(screen.queryByLabelText("Switch to your seat")).toBeNull();
  });

  it("collapses the expanded picker when you tap outside it", () => {
    renderBoard([
      { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
      { id: "p3", name: "Player Three", color: "amber", position: "top-right" },
      { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
      { id: "p4", name: "Player Four", color: "rose", position: "bottom-right" },
    ]);

    fireEvent.click(screen.getByLabelText("Expand seat picker"));
    expect(screen.getByTestId("portrait-seat-indicator").getAttribute("data-state")).toBe(
      "expanded",
    );

    fireEvent.click(screen.getByTestId("portrait-seat-indicator-backdrop"));

    expect(screen.getByTestId("portrait-seat-indicator").getAttribute("data-state")).toBe(
      "collapsed",
    );
    expect(screen.queryByLabelText("Switch to Player Two's seat")).toBeNull();
  });

  it("shows the switched seat name briefly at the top of the screen", () => {
    vi.useFakeTimers();
    try {
      renderBoard([
        { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
        { id: "p3", name: "Player Three", color: "amber", position: "top-right" },
        { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
        { id: "p4", name: "Player Four", color: "rose", position: "bottom-right" },
      ]);

      fireEvent.click(screen.getByLabelText("Expand seat picker"));
      fireEvent.click(screen.getByLabelText("Switch to Player Three's seat"));
      expect(
        screen
          .getAllByRole("status")
          .find((element) => element.textContent === "Player Three"),
      ).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1_400);
      });
      expect(
        screen
          .queryAllByRole("status")
          .some((element) => element.textContent === "Player Three"),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows You when switching back to your own seat", () => {
    vi.useFakeTimers();
    try {
      renderBoard([
        { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
        { id: "p3", name: "Player Three", color: "amber", position: "top-right" },
        { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
        { id: "p4", name: "Player Four", color: "rose", position: "bottom-right" },
      ]);

      fireEvent.click(screen.getByLabelText("Expand seat picker"));
      fireEvent.click(screen.getByLabelText("Switch to Player Three's seat"));
      fireEvent.click(screen.getByLabelText("Expand seat picker"));
      fireEvent.click(screen.getByLabelText("Switch to your seat"));

      expect(
        screen
          .getAllByRole("status")
          .find((element) => element.textContent === "You"),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
