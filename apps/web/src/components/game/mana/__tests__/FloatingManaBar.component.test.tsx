import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FloatingManaBar } from "../FloatingManaBar";

describe("FloatingManaBar", () => {
  it("shows all mana colors for the owner and reveals controls on hover", () => {
    const onAdjust = vi.fn();
    render(
      <FloatingManaBar
        manaPool={{ U: 2 }}
        editable
        onAdjust={onAdjust}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: /mana: \d/ })).toHaveLength(6);
    expect(screen.queryByText("Mana")).toBeNull();
    const blue = screen.getByRole("button", {
      name: "Blue mana: 2. Open controls",
    });
    expect(blue.querySelector('[data-mana-count="2"]')).not.toBeNull();
    expect(blue.querySelector(".ms")).toBeNull();
    expect(blue.querySelector("[data-mana-type-code]")).toBeNull();
    expect(blue.className).toContain("border");
    expect(blue.className).not.toContain("border-[3px]");
    expect(blue.className).toContain("border-[#56a8d8]");
    expect(blue.className).toContain("bg-[#287dab]");
    expect(
      screen.getByRole("button", { name: "Clear all floating mana" }).className,
    ).toContain("text-zinc-300");
    const controls = blue.closest("[data-floating-mana-bar]");
    expect(controls?.className).not.toContain("bg-");
    expect(controls?.className).not.toContain("border");
    fireEvent.mouseEnter(blue);

    fireEvent.click(screen.getByRole("button", { name: "Add one blue mana" }));
    expect(onAdjust).toHaveBeenCalledWith("U", 1);
    expect(
      (screen.getByRole("button", {
        name: "Remove one blue mana",
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("pins one stepper after a touch and dismisses it by tapping elsewhere", () => {
    render(
      <div>
        <FloatingManaBar manaPool={{ R: 1 }} editable />
        <button type="button">Elsewhere</button>
      </div>,
    );
    const red = screen.getByRole("button", {
      name: "Red mana: 1. Open controls",
    });
    fireEvent.pointerDown(red, { pointerType: "touch" });
    fireEvent.click(red);
    expect(screen.getByRole("group", { name: "Red mana controls" })).not.toBeNull();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("group", { name: "Red mana controls" })).toBeNull();
  });

  it("shows every opponent mana color read-only without controls", () => {
    render(<FloatingManaBar manaPool={{ W: 1, C: 3 }} editable={false} />);

    const manaOrbs = screen.getAllByRole("button", { name: /mana: \d/ });
    expect(manaOrbs).toHaveLength(6);
    expect(manaOrbs.every((orb) => (orb as HTMLButtonElement).disabled)).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Blue mana: 0" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "White mana: 1" }),
    );
    expect(screen.queryByRole("group")).toBeNull();
  });
});
