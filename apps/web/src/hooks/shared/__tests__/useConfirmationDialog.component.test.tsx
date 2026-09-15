import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useConfirmationDialog } from "../useConfirmationDialog";

describe("useConfirmationDialog", () => {
  it("keeps only one pending intent and closes before dispatch", () => {
    const { result } = renderHook(() => useConfirmationDialog());
    const replacementAction = vi.fn();
    const firstAction = vi.fn(() => {
      expect(
        result.current.requestConfirmation({
          title: "Replacement?",
          message: "Replacement message",
          confirmLabel: "Replace",
          onConfirm: replacementAction,
        }),
      ).toBe(true);
    });

    act(() => {
      expect(
        result.current.requestConfirmation({
          title: "First?",
          message: "First message",
          confirmLabel: "First",
          onConfirm: firstAction,
        }),
      ).toBe(true);
      expect(
        result.current.requestConfirmation({
          title: "Second?",
          message: "Second message",
          confirmLabel: "Second",
          onConfirm: vi.fn(),
        }),
      ).toBe(false);
    });

    act(() => result.current.confirm());
    expect(firstAction).toHaveBeenCalledTimes(1);
    expect(result.current.request?.title).toBe("Replacement?");
  });
});
