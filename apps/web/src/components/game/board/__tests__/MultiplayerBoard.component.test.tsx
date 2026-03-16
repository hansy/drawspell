import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseMultiplayerBoardController = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/game/board/useMultiplayerBoardController", () => ({
  useMultiplayerBoardController: mockUseMultiplayerBoardController,
}));

vi.mock("../MultiplayerBoardView", () => ({
  MultiplayerBoardView: () => <div data-testid="multiplayer-board-view" />,
}));

vi.mock("@/lib/partyKitToken", () => ({
  clearInviteTokenFromUrl: vi.fn(),
}));

import { MultiplayerBoard } from "../MultiplayerBoard";

describe("MultiplayerBoard blocked states", () => {
  beforeEach(() => {
    mockUseMultiplayerBoardController.mockReturnValue({
      joinBlocked: true,
      joinBlockedReason: "device-link-invalid",
      viewerRole: "player",
      setViewerRole: vi.fn(),
      roomOverCapacity: false,
      handleCreateNewGame: vi.fn(),
      handleLeave: vi.fn(),
    });
  });

  it("shows a specific message for invalid or already-used device links", () => {
    render(<MultiplayerBoard sessionId="room-1" />);

    expect(
      screen.getByRole("heading", {
        name: "Invalid or already-used device link",
      }),
    ).not.toBeNull();
    expect(
      screen.getByText("Copy a new device link from the active game and try again."),
    ).not.toBeNull();
    expect(screen.queryByTestId("multiplayer-board-view")).toBeNull();
  });
});
