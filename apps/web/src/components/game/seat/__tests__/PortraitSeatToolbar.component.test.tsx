import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";

import { useGameStore } from "@/store/gameStore";
import type { Player } from "@/types";

import { PortraitSeatToolbar } from "../PortraitSeatToolbar";

const makePlayer = (overrides: Partial<Player> = {}): Player =>
  ({
    id: "p1",
    name: "Player One",
    life: 40,
    deckLoaded: false,
    counters: [],
    commanderDamage: {},
    commanderTax: 0,
    ...overrides,
  }) as Player;

describe("PortraitSeatToolbar", () => {
  let originalUpdatePlayer: unknown;
  let originalPlayers: unknown;

  beforeEach(() => {
    originalUpdatePlayer = useGameStore.getState().updatePlayer;
    originalPlayers = useGameStore.getState().players;
    useGameStore.setState({
      myPlayerId: "me",
      updatePlayer: vi.fn() as any,
      players: {
        me: makePlayer({ id: "me", name: "Me" }),
        p1: makePlayer({ id: "p1", name: "Opponent" }),
      },
    } as any);
  });

  afterEach(() => {
    useGameStore.setState({
      updatePlayer: originalUpdatePlayer as any,
      players: originalPlayers as any,
    } as any);
  });

  const baseProps = {
    player: makePlayer({ id: "p1", name: "Opponent" }),
    isMe: false,
    opponentColors: { me: "rose", p1: "sky" },
    zoneStrip: <div data-testid="zone-strip">Zone strip</div>,
    onLoadDeck: vi.fn(),
  } as const;

  it("hides load-library CTA on opponent seats when deck is not loaded", () => {
    render(
      <DndContext>
        <PortraitSeatToolbar {...baseProps} showLoadLibraryAction={false} />
      </DndContext>,
    );

    expect(screen.queryByRole("button", { name: "Load Library" })).toBeNull();
    expect(screen.getByTestId("zone-strip")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Library" })).toBeNull();
  });

  it("shows the load-library CTA only when explicitly enabled", () => {
    const onLoadDeck = vi.fn();
    render(
      <DndContext>
        <PortraitSeatToolbar
          {...baseProps}
          isMe
          player={makePlayer({ id: "me", name: "Me", deckLoaded: false })}
          onLoadDeck={onLoadDeck}
          showLoadLibraryAction
        />
      </DndContext>,
    );

    const button = screen.getByRole("button", { name: "Load Library" });
    fireEvent.click(button);
    expect(onLoadDeck).toHaveBeenCalled();
    expect(screen.queryByTestId("zone-strip")).toBeNull();
  });

  it("hides life and commander-damage +/- controls for opponent life dialog", () => {
    render(
      <DndContext>
        <PortraitSeatToolbar
          {...baseProps}
          player={makePlayer({
            id: "p1",
            name: "Opponent",
            commanderDamage: { me: 3 },
          })}
          showLoadLibraryAction={false}
        />
      </DndContext>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open life details" }));

    expect(screen.queryByRole("button", { name: "Decrease life" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Increase life" })).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Decrease commander damage from Me",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Increase commander damage from Me",
      }),
    ).toBeNull();
  });
});
