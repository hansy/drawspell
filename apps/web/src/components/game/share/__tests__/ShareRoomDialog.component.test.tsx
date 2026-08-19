import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ShareRoomDialog } from "../ShareRoomDialog";
import { toast } from "sonner";
import type { Player } from "@/types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const buildPlayer = (id: string, name = id): Player => ({
  id,
  name,
  life: 40,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
});

type ShareRoomDialogProps = React.ComponentProps<typeof ShareRoomDialog>;

const renderDialog = (overrides: Partial<ShareRoomDialogProps> = {}) => {
  const props: ShareRoomDialogProps = {
    open: true,
    onClose: vi.fn(),
    playerLink: "https://example.com/room",
    spectatorLink: "https://example.com/room?role=spectator",
    resumeLink: "",
    players: {
      p1: buildPlayer("p1", "Alice"),
      p2: buildPlayer("p2", "Bob"),
    },
    ...overrides,
  };

  return render(<ShareRoomDialog {...props} />);
};

describe("ShareRoomDialog", () => {
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      writable: true,
    });
  });

  it("copies the active player link", async () => {
    renderDialog();

    const playerLabel = screen.getByText("Invite player");
    const playerInput = screen.getByDisplayValue("https://example.com/room");
    expect(playerLabel).toBeTruthy();
    expect(playerInput).toBeTruthy();
    expect((playerInput as HTMLInputElement).className).toContain(
      "focus-visible:ring-inset"
    );

    const playerField = playerLabel.closest("div")?.parentElement;
    const copyButton = playerField
      ? within(playerField).getByRole("button", {
          name: "Copy Player invite link",
        })
      : screen.getByRole("button", { name: "Copy Player invite link" });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "https://example.com/room"
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Player invite link copied to clipboard"
    );
  });

  it("shows the spectator link", () => {
    renderDialog();

    expect(screen.getByText("Invite spectator")).toBeTruthy();
    expect(
      screen.getByDisplayValue("https://example.com/room?role=spectator")
    ).toBeTruthy();
  });

  it("shows a resume link when provided", () => {
    const resumeLink = "https://example.com/room?playerId=p1&rt=resume";
    renderDialog({ resumeLink });

    const resumeInput = screen.getByDisplayValue(resumeLink) as HTMLInputElement;
    expect(resumeInput).toBeTruthy();
    expect(resumeInput.readOnly).toBe(true);
    expect(screen.getByText("Switch device")).toBeTruthy();
    expect(
      screen.getByText(
        "Open this link on another device to continue as this player."
      )
    ).toBeTruthy();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
  });

  it("shows a non-blocking refresh warning while keeping loaded links visible", () => {
    const resumeLink = "https://example.com/room?playerId=p1&rt=resume";
    renderDialog({
      resumeLink,
      errorMessage: "Unable to refresh invite links.",
    });

    expect(
      screen.getByText(
        "Links may be outdated. Unable to refresh invite links."
      )
    ).toBeTruthy();
    expect(screen.getByText("Invite player")).toBeTruthy();
    expect(
      screen.getByDisplayValue("https://example.com/room")
    ).toBeTruthy();
    expect(screen.getByDisplayValue(resumeLink)).toBeTruthy();
  });

  it("shows a loading state before links are ready", () => {
    renderDialog({ linksReady: false });

    expect(screen.getByText("Creating links…")).toBeTruthy();
    expect(screen.queryByText("Invite player")).toBeNull();
    expect(screen.queryByText("Invite spectator")).toBeNull();
    expect(screen.queryByDisplayValue("https://example.com/room")).toBeNull();
  });

  it("shows an error state when invite links fail to load", () => {
    renderDialog({
      linksReady: false,
      errorMessage: "Network unavailable.",
    });

    expect(screen.getByText("Unable to load invite links.")).toBeTruthy();
    expect(screen.getByText("Network unavailable.")).toBeTruthy();
    expect(screen.queryByText("Creating links…")).toBeNull();
  });

  it("ignores transient undefined players when sorting", () => {
    renderDialog({
      players: {
        p1: buildPlayer("p1", "Alice"),
        p2: undefined as any,
      } as any,
    });

    expect(screen.getByText("Players")).toBeTruthy();
    expect(screen.getByText("1/4")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });
});
