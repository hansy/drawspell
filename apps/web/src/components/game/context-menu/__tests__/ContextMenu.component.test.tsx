import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { ContextMenuItem } from "../ContextMenu";
import { ContextMenu } from "../ContextMenu";

const createItems = (overrides: Partial<ContextMenuItem> = {}): ContextMenuItem[] => [
  {
    type: "action",
    label: "Action 1",
    onSelect: vi.fn(),
    ...overrides,
  } as ContextMenuItem,
];

describe("ContextMenu", () => {
  it("renders items and triggers selection", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <ContextMenu
        x={10}
        y={10}
        items={[{ type: "action", label: "Do thing", onSelect }]}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Do thing" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the menu open for actions that opt out of close-on-select", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <ContextMenu
        x={10}
        y={10}
        items={[
          {
            type: "action",
            label: "Keep open",
            onSelect,
            closeOnSelect: false,
          },
        ]}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Keep open" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(0);
  });

  it("renders counter controls and triggers quick adjust buttons", () => {
    const onClose = vi.fn();
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();

    render(
      <ContextMenu
        x={10}
        y={10}
        items={[
          {
            type: "counter-control",
            label: "+1/+1",
            count: 2,
            onIncrement,
            onDecrement,
          },
        ]}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add +1/+1 counter" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove +1/+1 counter" }));

    expect(onIncrement).toHaveBeenCalledTimes(1);
    expect(onDecrement).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(0);
  });

  it("closes on click outside (root menu only)", () => {
    const onClose = vi.fn();

    render(<ContextMenu x={10} y={10} items={createItems()} onClose={onClose} />);

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when mousedown happens inside the menu", () => {
    const onClose = vi.fn();

    render(<ContextMenu x={10} y={10} items={createItems()} onClose={onClose} />);

    const root = document.querySelector("[data-context-menu-root]");
    expect(root).toBeTruthy();

    fireEvent.mouseDown(root!);
    expect(onClose).toHaveBeenCalledTimes(0);
  });

  it("keeps its portal interactive when an open modal disables body pointer events", () => {
    document.body.style.pointerEvents = "none";

    try {
      render(
        <ContextMenu
          x={10}
          y={10}
          items={createItems()}
          onClose={vi.fn()}
        />
      );

      const root = document.querySelector("[data-context-menu-root]");
      expect(root).toBeTruthy();
      expect(root?.classList.contains("pointer-events-auto")).toBe(true);
    } finally {
      document.body.style.pointerEvents = "";
    }
  });

  it("protects the pointer path between a submenu trigger and its submenu", () => {
    const { unmount } = render(
      <ContextMenu
        x={10}
        y={10}
        items={[
          { type: "action", label: "Neighbor", onSelect: vi.fn() },
          {
            type: "action",
            label: "Move to...",
            onSelect: vi.fn(),
            submenu: [{ type: "action", label: "Library...", onSelect: vi.fn() }],
          },
        ]}
        onClose={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button", { name: "Move to..." });
    fireEvent.mouseEnter(trigger);

    expect(screen.getByRole("button", { name: "Library..." })).toBeTruthy();
    expect(document.body.style.pointerEvents).toBe("none");
    expect(trigger.style.pointerEvents).toBe("auto");

    unmount();
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("opens a submenu and selects its action when tapped", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <ContextMenu
        x={10}
        y={10}
        items={[
          {
            type: "action",
            label: "Move to...",
            onSelect: vi.fn(),
            submenu: [{ type: "action", label: "Hand", onSelect }],
          },
        ]}
        onClose={onClose}
      />
    );

    const trigger = screen.getByRole("button", { name: "Move to..." });
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.pointerUp(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);

    const action = screen.getByRole("button", { name: "Hand" });
    fireEvent.pointerDown(action, { pointerType: "touch" });
    fireEvent.pointerUp(action, { pointerType: "touch" });
    fireEvent.click(action);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("supports selecting actions through multiple submenu levels", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <ContextMenu
        x={10}
        y={10}
        items={[
          {
            type: "action",
            label: "Move to...",
            onSelect: vi.fn(),
            submenu: [
              {
                type: "action",
                label: "Library...",
                onSelect: vi.fn(),
                submenu: [{ type: "action", label: "Bottom", onSelect }],
              },
            ],
          },
        ]}
        onClose={onClose}
      />
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Move to..." }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Library..." }));
    fireEvent.click(screen.getByRole("button", { name: "Bottom" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

});
