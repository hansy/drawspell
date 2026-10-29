import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCardEditHudStore } from "@/store/cardEditHudStore";
import { useGameStore } from "@/store/gameStore";
import { CardEditHud } from "../CardEditHud";

const baseCard = {
  id: "c1",
  name: "Speed, Young Avenger",
  ownerId: "me",
  controllerId: "me",
  zoneId: "bf-me",
  tapped: false,
  faceDown: false,
  position: { x: 0.2, y: 0.2 },
  rotation: 0,
  power: "2",
  toughness: "2",
  basePower: "2",
  baseToughness: "2",
  counters: [{ type: "+1/+1", count: 1, color: "#16a34a" }],
};

const setup = (overrides: Partial<typeof baseCard> = {}) => {
  const addCounterToCard = vi.fn();
  const removeCounterFromCard = vi.fn();
  const addGlobalCounter = vi.fn();
  const updateCard = vi.fn();
  useGameStore.setState({
    myPlayerId: "me",
    viewerRole: "player",
    cards: { c1: { ...baseCard, ...overrides } } as any,
    zones: { "bf-me": { id: "bf-me", type: "battlefield", ownerId: "me", cardIds: ["c1"] } } as any,
    globalCounters: { "+1/+1": "#16a34a", shield: "#c026d3" },
    addCounterToCard,
    removeCounterFromCard,
    addGlobalCounter,
    updateCard,
  } as any);
  const anchor = document.createElement("div");
  document.body.appendChild(anchor);
  render(<CardEditHud />);
  act(() => useCardEditHudStore.getState().open("c1", anchor));
  return { addCounterToCard, removeCounterFromCard, addGlobalCounter, updateCard, anchor };
};

describe("CardEditHud", () => {
  beforeEach(() => useCardEditHudStore.getState().close());
  afterEach(() => {
    act(() => useCardEditHudStore.getState().close());
    document.body.innerHTML = "";
  });

  it("adjusts an existing counter in place", () => {
    const { addCounterToCard, removeCounterFromCard } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Add one +1/+1 counter" }));
    expect(addCounterToCard).toHaveBeenCalledWith("c1", { type: "+1/+1", count: 1, color: "#16a34a" });

    fireEvent.click(screen.getByRole("button", { name: "Remove one +1/+1 counter" }));
    expect(removeCounterFromCard).toHaveBeenCalledWith("c1", "+1/+1");
  });

  it("steps power and toughness", () => {
    const { updateCard } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Add one power" }));
    expect(updateCard).toHaveBeenCalledWith("c1", { power: "3" });
    fireEvent.click(screen.getByRole("button", { name: "Remove one toughness" }));
    expect(updateCard).toHaveBeenCalledWith("c1", { toughness: "1" });
  });

  it("adds a recent counter or a new one with an automatic colour", () => {
    const { addCounterToCard, addGlobalCounter } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Add a counter" }));
    fireEvent.click(screen.getByRole("button", { name: /shield/ }));
    expect(addCounterToCard).toHaveBeenCalledWith("c1", { type: "shield", count: 1, color: "#c026d3" });
    expect(addGlobalCounter).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add a counter" }));
    const input = screen.getByRole("textbox", { name: "Counter name" });
    fireEvent.change(input, { target: { value: "Stun" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(addCounterToCard).toHaveBeenLastCalledWith(
      "c1",
      expect.objectContaining({ type: "Stun", count: 1, color: expect.any(String) }),
    );
    expect(addGlobalCounter).toHaveBeenCalledWith("Stun", expect.any(String));
  });

  it("shows nothing for a card you don't control", () => {
    setup({ controllerId: "someone-else" });
    expect(document.querySelector("[data-card-edit-hud]")).toBeNull();
  });
});
