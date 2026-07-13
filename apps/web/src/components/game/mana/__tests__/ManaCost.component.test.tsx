import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ManaCost } from "../ManaCost";

describe("ManaCost", () => {
  it("renders generic, colored, hybrid, phyrexian, and variable symbols", () => {
    const { container } = render(<ManaCost manaCost="{2}{U}{W/U}{B/P}{X}" />);

    expect(screen.getByLabelText("Mana cost {2}{U}{W/U}{B/P}{X}")).toBeTruthy();
    expect(container.querySelector(".ms-2")).toBeTruthy();
    expect(container.querySelector(".ms-u")).toBeTruthy();
    expect(container.querySelector(".ms-wu")).toBeTruthy();
    expect(container.querySelector(".ms-bp")).toBeTruthy();
    expect(container.querySelector(".ms-x")).toBeTruthy();
  });

  it("renders both halves of a split cost", () => {
    const { container } = render(<ManaCost manaCost="{1}{R} // {1}{U}" />);

    expect(container.querySelectorAll(".ms-1")).toHaveLength(2);
    expect(screen.getByTitle("{1}{R} // {1}{U}")).toBeTruthy();
  });

  it("uses a quiet placeholder when a card has no mana cost", () => {
    render(<ManaCost />);
    expect(screen.getByLabelText("No mana cost").textContent).toBe("—");
  });
});
