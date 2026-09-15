import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "../ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("focuses Cancel and dispatches the destructive action once", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open
        title="Unload this deck?"
        message="All cards will be removed."
        confirmLabel="Unload"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
    const confirm = screen.getByRole("button", { name: "Unload" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels on Escape", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmationDialog
        open
        title="Shuffle this Library?"
        message="Its order will be lost."
        confirmLabel="Shuffle"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
