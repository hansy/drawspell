import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardPowerToughnessControls } from "../CardPowerToughnessControls";

describe("CardPowerToughnessControls", () => {
  it("adjusts each displayed stat with left and right mouse clicks", () => {
    const onDelta = vi.fn();
    render(
      <CardPowerToughnessControls
        displayPower="2"
        displayToughness="3"
        canEdit
        onDelta={onDelta}
      />,
    );
    const power = screen.getByTestId("card-preview-stat-power");
    const toughness = screen.getByTestId("card-preview-stat-toughness");

    fireEvent.pointerDown(power, {
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(power, {
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.click(power, { detail: 1 });

    fireEvent.pointerDown(toughness, {
      pointerType: "mouse",
      pointerId: 2,
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.contextMenu(toughness, { button: 2 });

    expect(onDelta).toHaveBeenNthCalledWith(1, "power", 1);
    expect(onDelta).toHaveBeenNthCalledWith(2, "toughness", -1);
  });
});
