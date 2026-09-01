import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShortcutsDrawer } from "../ShortcutsDrawer";

describe("ShortcutsDrawer", () => {
  it("documents mouse controls alongside keyboard shortcuts", () => {
    render(<ShortcutsDrawer isOpen onClose={vi.fn()} />);

    const mouseControls = screen.getByRole("region", {
      name: "Mouse Controls",
    });
    const keyboardShortcuts = screen.getByRole("region", {
      name: "Keyboard Shortcuts",
    });

    expect(within(mouseControls).getByText("Double click")).not.toBeNull();
    expect(within(mouseControls).getByText("Adjust Floating Mana")).not.toBeNull();
    expect(within(keyboardShortcuts).getByText("Draw 1")).not.toBeNull();
  });

  it("documents current touch activation, selection, preview, and mana gestures", () => {
    render(<ShortcutsDrawer isOpen onClose={vi.fn()} />);

    expect(screen.getByText("Tap / Untap Battlefield Card")).not.toBeNull();
    expect(screen.getByText("Select Cards")).not.toBeNull();
    expect(screen.getAllByText("Preview Card")).toHaveLength(2);
    expect(screen.getByText("Tap orb")).not.toBeNull();
  });
});
