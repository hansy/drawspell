import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { useGameStore } from "@/store/gameStore";
import { MAX_PLAYER_LIFE, MIN_PLAYER_LIFE } from "@/lib/limits";

import { LifeBox } from "../LifeBox";

describe("LifeBox", () => {
  let originalUpdatePlayer: unknown;

  beforeEach(() => {
    originalUpdatePlayer = useGameStore.getState().updatePlayer;
  });

  afterEach(() => {
    act(() => {
      useGameStore.setState({ updatePlayer: originalUpdatePlayer as any } as any);
    });
  });

  it("updates player life when incrementing", () => {
    const updatePlayer = vi.fn();
    act(() => {
      useGameStore.setState({ updatePlayer } as any);
    });

    render(
      <LifeBox
        player={{
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
        } as any}
        isMe
        opponentColors={{ me: "rose" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase life" }));
    expect(updatePlayer).toHaveBeenCalledTimes(1);
    expect(updatePlayer).toHaveBeenCalledWith("me", { life: 41 });
  });

  it("invokes context menu handler when right clicking life total", () => {
    const onContextMenu = vi.fn();

    render(
      <LifeBox
        player={{
          id: "me",
          name: "Me",
          life: 25,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
        } as any}
        isMe
        opponentColors={{ me: "rose" }}
        onContextMenu={onContextMenu}
      />
    );

    fireEvent.contextMenu(screen.getByText("25"));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it("disables decrement at minimum life", () => {
    render(
      <LifeBox
        player={{
          id: "me",
          name: "Me",
          life: MIN_PLAYER_LIFE,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
        } as any}
        isMe
        opponentColors={{ me: "rose" }}
      />
    );

    const button = screen.getByRole("button", { name: "Decrease life" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("disables increment at maximum life", () => {
    render(
      <LifeBox
        player={{
          id: "me",
          name: "Me",
          life: MAX_PLAYER_LIFE,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
        } as any}
        isMe
        opponentColors={{ me: "rose" }}
      />
    );

    const button = screen.getByRole("button", { name: "Increase life" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("renders the compact hand-edge trigger and commander controls", () => {
    const { container } = render(
      <LifeBox
        player={{
          id: "me",
          name: "Jace",
          life: 38,
          counters: [],
          commanderDamage: { opponent: 3 },
          commanderTax: 0,
        } as any}
        isMe
        color="sky"
        variant="hand-edge"
        opponentColors={{ me: "sky", opponent: "rose" }}
      />
    );

    expect(container.querySelector('[data-life-box-variant="hand-edge"]')).not.toBeNull();
    const lifePill = container.querySelector(
      '[data-life-box-variant="hand-edge"]',
    );
    expect(lifePill?.classList.contains("ds-seat-life-pill")).toBe(true);
    expect(lifePill?.classList.contains("invisible")).toBe(false);
    expect(screen.getByText("Jace")).toBeTruthy();
    expect(screen.getByText("Jace").classList.contains("text-sky-400")).toBe(true);
    expect(screen.getAllByText("38").length).toBeGreaterThan(0);
    expect(
      screen
        .getByLabelText("Jace life total 38")
        .classList.contains("ds-seat-life-total"),
    ).toBe(true);
    expect(container.querySelector("[data-life-edge-disclosure]")).not.toBeNull();
    expect(container.querySelector("[data-commander-damage-controls]")).not.toBeNull();
    const decreaseLife = screen.getByRole("button", { name: "Decrease life" });
    expect(decreaseLife.classList.contains("w-0")).toBe(true);
    expect(decreaseLife.classList.contains("group-hover/life:w-7")).toBe(true);
    expect(screen.getByRole("button", { name: "Increase life" })).toBeTruthy();
  });
});
