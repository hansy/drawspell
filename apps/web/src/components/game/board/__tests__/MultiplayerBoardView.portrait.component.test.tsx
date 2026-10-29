import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

const buildBoardProps = (
  players: PlayerSlot[],
  options?: { livePlayerCount?: number },
) => {
  const slots = buildSlots(players);
  const playersById = Object.fromEntries(
    slots.map((slot) => [slot.player.id, slot.player]),
  );
  const livePlayerCount = options?.livePlayerCount ?? players.length;

  return {
        zones: {},
        cards: {},
        players: playersById,
        playerOrder: players.map((player) => player.id),
        activePlayerId: players[0]?.id ?? null,
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
        activeCardTransformOrigin: "50% 50%",
        isGroupDragging: false,
        showGroupDragOverlay: false,
        groupDragCardIds: [],
        sensors: [],
        handleDragStart: vi.fn(),
        handleDragMove: vi.fn(),
        handleDragEnd: vi.fn(),
        syncStatus: "connected",
        peerCounts: {
          total: livePlayerCount,
          players: livePlayerCount,
          spectators: 0,
        },
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
        handleSetTurn: vi.fn(),
        handleEndTurn: vi.fn(() => true),
        handleLeave: vi.fn(),
        shareLinks: { players: "", spectators: "", resume: "" },
        shareLinksReady: false,
        shareDialogError: "",
        canShareRoom: false,
        joinBlockedReason: null,
  } as any;
};

const renderBoard = (
  players: PlayerSlot[],
  options?: { livePlayerCount?: number },
) => render(<MultiplayerBoardView {...buildBoardProps(players, options)} />);

describe("MultiplayerBoardView portrait seat switcher", () => {
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

  it("opens the turn picker from the active player's pill", async () => {
    const props = buildBoardProps([
      {
        id: "p1",
        name: "Alice",
        color: "sky",
        position: "bottom-left",
      },
      {
        id: "p2",
        name: "Bob",
        color: "rose",
        position: "top-left",
      },
    ]);

    render(<MultiplayerBoardView {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Your turn. Choose next player" }),
    );

    expect(await screen.findByRole("heading", { name: "Set turn" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bob" }));
    expect(props.handleSetTurn).toHaveBeenCalledWith("p2");
  });

  it("omits eliminated players from the turn picker", async () => {
    const props = buildBoardProps([
      { id: "p1", name: "Alice", color: "sky", position: "bottom-left" },
      { id: "p2", name: "Bob", color: "rose", position: "top-left" },
      { id: "p3", name: "Carol", color: "amber", position: "top-right" },
    ]);
    props.players.p2.life = 0;

    render(<MultiplayerBoardView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Your turn. Choose next player" }));

    expect(await screen.findByRole("heading", { name: "Set turn" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Bob" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Carol" }));
    expect(props.handleSetTurn).toHaveBeenCalledWith("p3");
  });

  it("ends your turn from the turn pill", () => {
    const props = buildBoardProps([
      { id: "p1", name: "Alice", color: "sky", position: "bottom-left" },
      { id: "p2", name: "Bob", color: "rose", position: "top-left" },
    ]);

    render(<MultiplayerBoardView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "End your turn" }));

    expect(props.handleEndTurn).toHaveBeenCalledTimes(1);
  });

  it("offers no End turn when only one player remains eligible", () => {
    const props = buildBoardProps([
      { id: "p1", name: "Alice", color: "sky", position: "bottom-left" },
      { id: "p2", name: "Bob", color: "rose", position: "top-left" },
    ]);
    props.players.p2.life = 0;

    render(<MultiplayerBoardView {...props} />);

    expect(screen.queryByRole("button", { name: "End your turn" })).toBeNull();
  });

  it("hides turn UI in a one-player room", () => {
    renderBoard([
      {
        id: "p1",
        name: "Alice",
        color: "sky",
        position: "bottom-left",
      },
    ]);

    expect(
      screen.queryByRole("button", {
        name: "Your turn. Choose next player",
      }),
    ).toBeNull();
    expect(screen.queryByText("Your turn")).toBeNull();
  });

  const seatChips = () =>
    Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-portrait-seat-chip]"),
    );
  const seatChip = (label: string) =>
    seatChips().find((chip) =>
      new RegExp(`^(Viewing|View) ${label}:`).test(
        chip.getAttribute("aria-label") ?? "",
      ),
    );
  const viewedSeatLabel = () =>
    seatChips()
      .find((chip) => chip.getAttribute("aria-pressed") === "true")
      ?.getAttribute("aria-label")
      ?.match(/^Viewing (.+?):/)?.[1];

  it("uses portrait layout for narrow desktop browser viewports", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches:
          query === "(orientation: portrait)" || query === "(max-width: 768px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    renderBoard([
      { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
      { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
    ]);

    expect(document.querySelector("[data-portrait-seat-strip]")).toBeTruthy();
  });

  it("focuses the joining player's seat when it appears after the inviter", () => {
    const inviter = {
      id: "p2",
      name: "Inviter",
      color: "violet",
      position: "top-left",
    } as const;
    const me = {
      id: "p1",
      name: "Joining Player",
      color: "sky",
      position: "bottom-left",
    } as const;
    const { rerender } = renderBoard([inviter]);

    rerender(<MultiplayerBoardView {...buildBoardProps([inviter, me])} />);

    expect(viewedSeatLabel()).toBe("You");
  });

  it("shows every player in the strip and marks the seat being viewed", () => {
    renderBoard([
      { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
      { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
    ]);

    expect(seatChips()).toHaveLength(2);
    expect(seatChip("You")?.getAttribute("aria-pressed")).toBe("true");
    expect(seatChip("Player Two")?.getAttribute("aria-pressed")).toBe("false");
    expect(seatChip("Player Two")?.getAttribute("aria-label")).toMatch(
      /life, \d+ cards in hand/,
    );
  });

  it("preserves an explicitly selected opponent when seats update", () => {
    const playerTwo = {
      id: "p2",
      name: "Player Two",
      color: "violet",
      position: "top-left",
    } as const;
    const me = {
      id: "p1",
      name: "Player One",
      color: "sky",
      position: "bottom-left",
    } as const;
    const playerThree = {
      id: "p3",
      name: "Player Three",
      color: "amber",
      position: "top-right",
    } as const;
    const { rerender } = renderBoard([playerTwo, me]);

    fireEvent.click(seatChip("Player Two")!);
    rerender(
      <MultiplayerBoardView
        {...buildBoardProps([playerTwo, playerThree, me])}
      />,
    );

    expect(viewedSeatLabel()).toBe("Player Two");
  });

  it("hides the seat strip when only one player is connected", () => {
    renderBoard(
      [
        { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
        { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
      ],
      { livePlayerCount: 1 },
    );

    expect(document.querySelector("[data-portrait-seat-strip]")).toBeNull();
  });

  it("lists seats in shared layout order", () => {
    renderBoard([
      { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
      { id: "p3", name: "Player Three", color: "amber", position: "top-right" },
      { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
      { id: "p4", name: "Player Four", color: "rose", position: "bottom-right" },
    ]);

    expect(
      seatChips().map(
        (chip) => chip.getAttribute("aria-label")?.match(/^(?:Viewing|View) (.+?):/)?.[1],
      ),
    ).toEqual(["Player Two", "Player Three", "You", "Player Four"]);
  });

  it("keeps the seat strip visible while the mobile menu is open", () => {
    renderBoard([
      { id: "p2", name: "Player Two", color: "violet", position: "top-left" },
      { id: "p1", name: "Player One", color: "sky", position: "bottom-left" },
    ]);

    fireEvent.click(screen.getByLabelText("Open menu"));

    expect(document.querySelector("[data-portrait-seat-strip]")).toBeTruthy();
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

      fireEvent.click(seatChip("Player Three")!);
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

      fireEvent.click(seatChip("Player Three")!);
      fireEvent.click(seatChip("You")!);

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
