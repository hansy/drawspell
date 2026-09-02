import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDesktopValueAdjustment } from "../useDesktopValueAdjustment";

const Harness: React.FC<{
  onIncrement: () => void;
  onDecrement: () => void;
  onParentClick?: () => void;
  onParentContextMenu?: () => void;
}> = ({ onIncrement, onDecrement, onParentClick, onParentContextMenu }) => {
  const handlers = useDesktopValueAdjustment({
    enabled: true,
    onIncrement,
    onDecrement,
  });

  return (
    <div onClick={onParentClick} onContextMenu={onParentContextMenu}>
      <span data-testid="value" {...handlers}>
        3
      </span>
    </div>
  );
};

describe("useDesktopValueAdjustment", () => {
  it("increments once for a stationary left mouse click", () => {
    const onIncrement = vi.fn();
    const onParentClick = vi.fn();
    render(
      <Harness
        onIncrement={onIncrement}
        onDecrement={vi.fn()}
        onParentClick={onParentClick}
      />,
    );
    const value = screen.getByTestId("value");

    fireEvent.pointerDown(value, {
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(value, {
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.click(value, { detail: 1 });

    expect(onIncrement).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("decrements for a right mouse click without opening a parent menu", () => {
    const onDecrement = vi.fn();
    const onParentContextMenu = vi.fn();
    const onParentClick = vi.fn();
    render(
      <Harness
        onIncrement={vi.fn()}
        onDecrement={onDecrement}
        onParentClick={onParentClick}
        onParentContextMenu={onParentContextMenu}
      />,
    );
    const value = screen.getByTestId("value");

    fireEvent.pointerDown(value, {
      pointerType: "mouse",
      pointerId: 2,
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(value, {
      pointerType: "mouse",
      pointerId: 2,
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.contextMenu(value, { button: 2, clientX: 10, clientY: 10 });
    fireEvent.click(value, { detail: 0 });

    expect(onDecrement).toHaveBeenCalledTimes(1);
    expect(onParentContextMenu).not.toHaveBeenCalled();
    expect(onParentClick).toHaveBeenCalledTimes(1);
  });

  it("leaves touch clicks and moved mouse presses alone", () => {
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();
    const onParentClick = vi.fn();
    render(
      <Harness
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        onParentClick={onParentClick}
      />,
    );
    const value = screen.getByTestId("value");

    fireEvent.pointerDown(value, {
      pointerType: "touch",
      pointerId: 3,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(value, {
      pointerType: "touch",
      pointerId: 3,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.click(value, { detail: 1 });

    fireEvent.pointerDown(value, {
      pointerType: "mouse",
      pointerId: 4,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(value, {
      pointerType: "mouse",
      pointerId: 4,
      button: 0,
      clientX: 30,
      clientY: 10,
    });
    fireEvent.pointerUp(value, {
      pointerType: "mouse",
      pointerId: 4,
      button: 0,
      clientX: 30,
      clientY: 10,
    });

    expect(onIncrement).not.toHaveBeenCalled();
    expect(onDecrement).not.toHaveBeenCalled();
    expect(onParentClick).toHaveBeenCalledTimes(1);
  });
});
