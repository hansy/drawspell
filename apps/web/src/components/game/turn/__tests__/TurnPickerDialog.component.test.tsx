import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Player } from "@/types";
import { TurnPickerDialog } from "../TurnPickerDialog";

const makePlayer = (id: string, name: string, color: string): Player => ({
  id,
  name,
  color,
  life: 40,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
});

describe("TurnPickerDialog", () => {
  it("marks the current player and immediately selects another player", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <TurnPickerDialog
        open
        players={[
          makePlayer("p1", "Alice", "sky"),
          makePlayer("p2", "Bob", "rose"),
        ]}
        activePlayerId="p1"
        viewerPlayerId="p1"
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    expect(
      (screen.getByRole("button", { name: /You\s*Current/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Bob" }));

    expect(onSelect).toHaveBeenCalledWith("p2");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
