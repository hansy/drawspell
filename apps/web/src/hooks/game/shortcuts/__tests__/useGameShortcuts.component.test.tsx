import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameShortcuts, type UseGameShortcutsArgs } from "../useGameShortcuts";
import { useGameStore } from "@/store/gameStore";
import { ZONE } from "@/constants/zones";
import type { Player, Zone } from "@/types";

const createPlayer = (id: string, deckLoaded: boolean): Player =>
  ({
    id,
    name: id,
    life: 40,
    counters: [],
    commanderDamage: {},
    commanderTax: 0,
    deckLoaded,
  }) as any;

const createZone = (id: string, ownerId: string, type: string): Zone =>
  ({
    id,
    ownerId,
    type,
    name: id,
    cardIds: [],
    isPublic: true,
  }) as any;

const resetStore = (overrides?: Partial<ReturnType<typeof useGameStore.getState>>) => {
  useGameStore.setState((state: any) => ({
    ...state,
    players: {},
    zones: {},
    ...overrides,
  }));
};

const Probe: React.FC<{ args: UseGameShortcutsArgs }> = ({ args }) => {
  useGameShortcuts(args);
  return null;
};

const passTurnArgs = (
  onPassTurn: () => boolean,
  overrides: Partial<UseGameShortcutsArgs> = {},
): UseGameShortcutsArgs => ({
  myPlayerId: "me",
  zones: {},
  players: { me: createPlayer("me", true) },
  contextMenuOpen: false,
  closeContextMenu: vi.fn(),
  countPromptOpen: false,
  closeCountPrompt: vi.fn(),
  textPromptOpen: false,
  closeTextPrompt: vi.fn(),
  activeModalOpen: false,
  closeActiveModal: vi.fn(),
  tokenModalOpen: false,
  setTokenModalOpen: vi.fn(),
  coinFlipperOpen: false,
  setCoinFlipperOpen: vi.fn(),
  diceRollerOpen: false,
  setDiceRollerOpen: vi.fn(),
  loadDeckModalOpen: false,
  setLoadDeckModalOpen: vi.fn(),
  shareDialogOpen: false,
  setShareDialogOpen: vi.fn(),
  zoneViewerOpen: false,
  closeZoneViewer: vi.fn(),
  opponentRevealsOpen: false,
  closeOpponentReveals: vi.fn(),
  logOpen: false,
  setLogOpen: vi.fn(),
  shortcutsOpen: false,
  setShortcutsOpen: vi.fn(),
  openCountPrompt: vi.fn(),
  handleViewZone: vi.fn(),
  handleLeave: vi.fn(),
  onPassTurn,
  ...overrides,
});

describe("useGameShortcuts", () => {
  beforeEach(() => {
    resetStore();
  });

  it("passes the turn on Space and consumes the key only when it succeeds", () => {
    const onPassTurn = vi.fn(() => true);
    const { rerender } = render(<Probe args={passTurnArgs(onPassTurn)} />);
    const first = new KeyboardEvent("keydown", {
      key: " ", code: "Space", bubbles: true, cancelable: true,
    });
    window.dispatchEvent(first);
    expect(onPassTurn).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(true);

    const cannotPass = vi.fn(() => false);
    rerender(<Probe args={passTurnArgs(cannotPass)} />);
    const second = new KeyboardEvent("keydown", {
      key: " ", code: "Space", bubbles: true, cancelable: true,
    });
    window.dispatchEvent(second);
    expect(cannotPass).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });

  it("passes the turn with a game button focused or a nonblocking panel open", () => {
    const onPassTurn = vi.fn(() => true);
    const { rerender } = render(<Probe args={passTurnArgs(onPassTurn)} />);
    const button = document.createElement("button");
    document.body.appendChild(button);
    const focusedButtonSpace = new KeyboardEvent("keydown", {
      key: " ", code: "Space", bubbles: true, cancelable: true,
    });
    button.dispatchEvent(focusedButtonSpace);
    expect(onPassTurn).toHaveBeenCalledTimes(1);
    expect(focusedButtonSpace.defaultPrevented).toBe(true);
    button.remove();

    rerender(<Probe args={passTurnArgs(onPassTurn, { logOpen: true })} />);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: " ", code: "Space", bubbles: true, cancelable: true,
    }));
    expect(onPassTurn).toHaveBeenCalledTimes(2);

    rerender(<Probe args={passTurnArgs(onPassTurn, { shortcutsOpen: true })} />);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: " ", code: "Space", bubbles: true, cancelable: true,
    }));
    expect(onPassTurn).toHaveBeenCalledTimes(3);
  });

  it("blocks Space when play is unavailable", () => {
    const onPassTurn = vi.fn(() => true);
    const { rerender } = render(<Probe args={passTurnArgs(onPassTurn)} />);

    rerender(<Probe args={passTurnArgs(onPassTurn, { contextMenuOpen: true })} />);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: " ", code: "Space", bubbles: true, cancelable: true,
    }));
    expect(onPassTurn).not.toHaveBeenCalled();

    rerender(<Probe args={passTurnArgs(onPassTurn, {
      players: { me: createPlayer("me", false) },
    })} />);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: " ", code: "Space", bubbles: true, cancelable: true,
    }));
    expect(onPassTurn).not.toHaveBeenCalled();

    rerender(<Probe args={passTurnArgs(onPassTurn, { viewerRole: "spectator" })} />);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: " ", code: "Space", bubbles: true, cancelable: true,
    }));
    expect(onPassTurn).not.toHaveBeenCalled();
  });

  it("does not run non-Esc shortcuts while typing", () => {
    const drawCard = vi.fn();
    resetStore({ drawCard } as any);

    const input = document.createElement("input");
    document.body.appendChild(input);

    const args: UseGameShortcutsArgs = {
      myPlayerId: "me" as any,
      zones: {
        "lib-me": createZone("lib-me", "me", ZONE.LIBRARY),
        "hand-me": createZone("hand-me", "me", ZONE.HAND),
      } as any,
      players: { me: createPlayer("me", true) } as any,
      contextMenuOpen: false,
      closeContextMenu: vi.fn(),
      countPromptOpen: false,
      closeCountPrompt: vi.fn(),
      textPromptOpen: false,
      closeTextPrompt: vi.fn(),
      activeModalOpen: false,
      closeActiveModal: vi.fn(),
      tokenModalOpen: false,
      setTokenModalOpen: vi.fn(),
      coinFlipperOpen: false,
      setCoinFlipperOpen: vi.fn(),
      diceRollerOpen: false,
      setDiceRollerOpen: vi.fn(),
      loadDeckModalOpen: false,
      setLoadDeckModalOpen: vi.fn(),
      shareDialogOpen: false,
      setShareDialogOpen: vi.fn(),
      zoneViewerOpen: false,
      closeZoneViewer: vi.fn(),
      opponentRevealsOpen: false,
      closeOpponentReveals: vi.fn(),
      logOpen: false,
      setLogOpen: vi.fn(),
      shortcutsOpen: false,
      setShortcutsOpen: vi.fn(),
      openCountPrompt: vi.fn(),
      handleViewZone: vi.fn(),
      handleLeave: vi.fn(),
      onPassTurn: vi.fn(() => false),
    };

    render(<Probe args={args} />);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(drawCard).not.toHaveBeenCalled();
  });

  it("closes topmost UI on Escape even when typing", () => {
    const closeContextMenu = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);

    const args: UseGameShortcutsArgs = {
      myPlayerId: "me" as any,
      zones: {} as any,
      players: {} as any,
      contextMenuOpen: true,
      closeContextMenu,
      countPromptOpen: false,
      closeCountPrompt: vi.fn(),
      textPromptOpen: false,
      closeTextPrompt: vi.fn(),
      activeModalOpen: false,
      closeActiveModal: vi.fn(),
      tokenModalOpen: false,
      setTokenModalOpen: vi.fn(),
      coinFlipperOpen: false,
      setCoinFlipperOpen: vi.fn(),
      diceRollerOpen: false,
      setDiceRollerOpen: vi.fn(),
      loadDeckModalOpen: false,
      setLoadDeckModalOpen: vi.fn(),
      shareDialogOpen: false,
      setShareDialogOpen: vi.fn(),
      zoneViewerOpen: false,
      closeZoneViewer: vi.fn(),
      opponentRevealsOpen: false,
      closeOpponentReveals: vi.fn(),
      logOpen: false,
      setLogOpen: vi.fn(),
      shortcutsOpen: false,
      setShortcutsOpen: vi.fn(),
      openCountPrompt: vi.fn(),
      handleViewZone: vi.fn(),
      handleLeave: vi.fn(),
      onPassTurn: vi.fn(() => false),
    };

    render(<Probe args={args} />);

    const evt = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, shiftKey: true });
    input.dispatchEvent(evt);
    expect(closeContextMenu).toHaveBeenCalledTimes(1);
  });

  it("invokes openCountPrompt with initialValue=1 on V", () => {
    const openCountPrompt = vi.fn();
    const zones = {
      "lib-me": createZone("lib-me", "me", ZONE.LIBRARY),
    } as any;

    const args: UseGameShortcutsArgs = {
      myPlayerId: "me" as any,
      zones,
      players: { me: createPlayer("me", true) } as any,
      contextMenuOpen: false,
      closeContextMenu: vi.fn(),
      countPromptOpen: false,
      closeCountPrompt: vi.fn(),
      textPromptOpen: false,
      closeTextPrompt: vi.fn(),
      activeModalOpen: false,
      closeActiveModal: vi.fn(),
      tokenModalOpen: false,
      setTokenModalOpen: vi.fn(),
      coinFlipperOpen: false,
      setCoinFlipperOpen: vi.fn(),
      diceRollerOpen: false,
      setDiceRollerOpen: vi.fn(),
      loadDeckModalOpen: false,
      setLoadDeckModalOpen: vi.fn(),
      shareDialogOpen: false,
      setShareDialogOpen: vi.fn(),
      zoneViewerOpen: false,
      closeZoneViewer: vi.fn(),
      opponentRevealsOpen: false,
      closeOpponentReveals: vi.fn(),
      logOpen: false,
      setLogOpen: vi.fn(),
      shortcutsOpen: false,
      setShortcutsOpen: vi.fn(),
      openCountPrompt,
      handleViewZone: vi.fn(),
      handleLeave: vi.fn(),
      onPassTurn: vi.fn(() => false),
    };

    render(<Probe args={args} />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
    expect(openCountPrompt).toHaveBeenCalledTimes(1);
    expect(openCountPrompt.mock.calls[0][0].initialValue).toBe(1);
  });

  it("invokes openCountPrompt with initialValue=1 on Shift+D", () => {
    const openCountPrompt = vi.fn();
    const args: UseGameShortcutsArgs = {
      myPlayerId: "me" as any,
      zones: {
        "lib-me": createZone("lib-me", "me", ZONE.LIBRARY),
        "hand-me": createZone("hand-me", "me", ZONE.HAND),
      } as any,
      players: { me: createPlayer("me", true) } as any,
      contextMenuOpen: false,
      closeContextMenu: vi.fn(),
      countPromptOpen: false,
      closeCountPrompt: vi.fn(),
      textPromptOpen: false,
      closeTextPrompt: vi.fn(),
      activeModalOpen: false,
      closeActiveModal: vi.fn(),
      tokenModalOpen: false,
      setTokenModalOpen: vi.fn(),
      coinFlipperOpen: false,
      setCoinFlipperOpen: vi.fn(),
      diceRollerOpen: false,
      setDiceRollerOpen: vi.fn(),
      loadDeckModalOpen: false,
      setLoadDeckModalOpen: vi.fn(),
      shareDialogOpen: false,
      setShareDialogOpen: vi.fn(),
      zoneViewerOpen: false,
      closeZoneViewer: vi.fn(),
      opponentRevealsOpen: false,
      closeOpponentReveals: vi.fn(),
      logOpen: false,
      setLogOpen: vi.fn(),
      shortcutsOpen: false,
      setShortcutsOpen: vi.fn(),
      openCountPrompt,
      handleViewZone: vi.fn(),
      handleLeave: vi.fn(),
      onPassTurn: vi.fn(() => false),
    };

    render(<Probe args={args} />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", shiftKey: true, bubbles: true }));
    expect(openCountPrompt).toHaveBeenCalledTimes(1);
    expect(openCountPrompt.mock.calls[0][0].title).toBe("Draw X");
    expect(openCountPrompt.mock.calls[0][0].initialValue).toBe(1);
  });

  it("exiles face-up library cards on X and Shift+X", () => {
    const exileFromLibrary = vi.fn();
    const openCountPrompt = vi.fn();
    resetStore({ exileFromLibrary } as any);
    const args: UseGameShortcutsArgs = {
      myPlayerId: "me" as any,
      zones: {
        "lib-me": createZone("lib-me", "me", ZONE.LIBRARY),
        "exile-me": createZone("exile-me", "me", ZONE.EXILE),
      } as any,
      players: { me: createPlayer("me", true) } as any,
      contextMenuOpen: false,
      closeContextMenu: vi.fn(),
      countPromptOpen: false,
      closeCountPrompt: vi.fn(),
      textPromptOpen: false,
      closeTextPrompt: vi.fn(),
      activeModalOpen: false,
      closeActiveModal: vi.fn(),
      tokenModalOpen: false,
      setTokenModalOpen: vi.fn(),
      coinFlipperOpen: false,
      setCoinFlipperOpen: vi.fn(),
      diceRollerOpen: false,
      setDiceRollerOpen: vi.fn(),
      loadDeckModalOpen: false,
      setLoadDeckModalOpen: vi.fn(),
      shareDialogOpen: false,
      setShareDialogOpen: vi.fn(),
      zoneViewerOpen: false,
      closeZoneViewer: vi.fn(),
      opponentRevealsOpen: false,
      closeOpponentReveals: vi.fn(),
      logOpen: false,
      setLogOpen: vi.fn(),
      shortcutsOpen: false,
      setShortcutsOpen: vi.fn(),
      openCountPrompt,
      handleViewZone: vi.fn(),
      handleLeave: vi.fn(),
      onPassTurn: vi.fn(() => false),
    };

    render(<Probe args={args} />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    expect(exileFromLibrary).toHaveBeenCalledWith(
      "me",
      1,
      "me",
      undefined,
      { faceDown: false },
    );

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "x",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(openCountPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Exile Top X",
        initialValue: 1,
        minValue: 1,
        confirmLabel: "Exile",
      }),
    );
    openCountPrompt.mock.calls[0]?.[0]?.onSubmit(3);
    expect(exileFromLibrary).toHaveBeenLastCalledWith(
      "me",
      3,
      "me",
      undefined,
      { faceDown: false },
    );
  });

  it("does not prevent default for a matched shortcut that becomes a no-op", () => {
    const openCountPrompt = vi.fn();
    const args: UseGameShortcutsArgs = {
      myPlayerId: "me" as any,
      zones: {} as any,
      players: { me: createPlayer("me", true) } as any,
      contextMenuOpen: false,
      closeContextMenu: vi.fn(),
      countPromptOpen: false,
      closeCountPrompt: vi.fn(),
      textPromptOpen: false,
      closeTextPrompt: vi.fn(),
      activeModalOpen: false,
      closeActiveModal: vi.fn(),
      tokenModalOpen: false,
      setTokenModalOpen: vi.fn(),
      coinFlipperOpen: false,
      setCoinFlipperOpen: vi.fn(),
      diceRollerOpen: false,
      setDiceRollerOpen: vi.fn(),
      loadDeckModalOpen: false,
      setLoadDeckModalOpen: vi.fn(),
      shareDialogOpen: false,
      setShareDialogOpen: vi.fn(),
      zoneViewerOpen: false,
      closeZoneViewer: vi.fn(),
      opponentRevealsOpen: false,
      closeOpponentReveals: vi.fn(),
      logOpen: false,
      setLogOpen: vi.fn(),
      shortcutsOpen: false,
      setShortcutsOpen: vi.fn(),
      openCountPrompt,
      handleViewZone: vi.fn(),
      handleLeave: vi.fn(),
      onPassTurn: vi.fn(() => false),
    };

    render(<Probe args={args} />);

    const evt = new KeyboardEvent("keydown", { key: "v", bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    expect(openCountPrompt).not.toHaveBeenCalled();
    expect(evt.defaultPrevented).toBe(false);
  });

  it("allows L even when deck is not loaded", () => {
    const setLogOpen = vi.fn();

    const args: UseGameShortcutsArgs = {
      myPlayerId: "me" as any,
      zones: {} as any,
      players: { me: createPlayer("me", false) } as any,
      contextMenuOpen: false,
      closeContextMenu: vi.fn(),
      countPromptOpen: false,
      closeCountPrompt: vi.fn(),
      textPromptOpen: false,
      closeTextPrompt: vi.fn(),
      activeModalOpen: false,
      closeActiveModal: vi.fn(),
      tokenModalOpen: false,
      setTokenModalOpen: vi.fn(),
      coinFlipperOpen: false,
      setCoinFlipperOpen: vi.fn(),
      diceRollerOpen: false,
      setDiceRollerOpen: vi.fn(),
      loadDeckModalOpen: false,
      setLoadDeckModalOpen: vi.fn(),
      shareDialogOpen: false,
      setShareDialogOpen: vi.fn(),
      zoneViewerOpen: false,
      closeZoneViewer: vi.fn(),
      opponentRevealsOpen: false,
      closeOpponentReveals: vi.fn(),
      logOpen: false,
      setLogOpen,
      shortcutsOpen: false,
      setShortcutsOpen: vi.fn(),
      openCountPrompt: vi.fn(),
      handleViewZone: vi.fn(),
      handleLeave: vi.fn(),
      onPassTurn: vi.fn(() => false),
    };

    render(<Probe args={args} />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "l", bubbles: true }));
    expect(setLogOpen).toHaveBeenCalledWith(true);
  });
});
