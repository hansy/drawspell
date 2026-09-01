import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortraitSeatSwitcher } from "../PortraitSeatSwitcher";

const seats = [
  { playerId: "me", label: "You", color: "rose" },
  { playerId: "opponent", label: "Very Long Opponent Name", color: "sky" },
];

describe("PortraitSeatSwitcher", () => {
  it("shows only the active seat color and dropdown indicator in the trigger", () => {
    const { container } = render(
      <PortraitSeatSwitcher
        seats={seats}
        activePlayerId="me"
        open={false}
        onOpenChange={vi.fn()}
        onSelectSeat={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Viewing You. Change seat",
    });
    expect(trigger.textContent).toBe("");
    expect(trigger.className).toContain("w-11");
    expect(trigger.querySelector(".bg-rose-400")).not.toBeNull();
    expect(
      container.querySelector("[data-seat-switcher-indicator]"),
    ).not.toBeNull();
  });

  it("keeps full player names and seat selection in the dropdown", () => {
    const onOpenChange = vi.fn();
    const onSelectSeat = vi.fn();
    render(
      <PortraitSeatSwitcher
        seats={seats}
        activePlayerId="me"
        open
        onOpenChange={onOpenChange}
        onSelectSeat={onSelectSeat}
      />,
    );

    expect(screen.getByText("You")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("menuitemradio", {
        name: "Switch to Very Long Opponent Name",
      }),
    );

    expect(onSelectSeat).toHaveBeenCalledWith("opponent");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
