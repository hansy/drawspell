import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeRoomTokensToStorage } from "@/lib/partyKitToken";
import { useClientPrefsStore } from "@/store/clientPrefsStore";

const mocks = vi.hoisted(() => ({
  getRoomStatus: vi.fn(),
  navigate: vi.fn(),
  forgetSessionIdentity: vi.fn(),
  leaveRoom: vi.fn(),
  resetSession: vi.fn(),
  setRoomTokens: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: vi.fn(() => (options: unknown) => options),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/server/roomStatus", () => ({
  getRoomStatus: mocks.getRoomStatus,
}));
vi.mock("@/server/leaveRoom", () => ({
  leaveRoom: mocks.leaveRoom,
}));

vi.mock("@/store/gameStore", () => ({
  useGameStore: {
    getState: () => ({
      forgetSessionIdentity: mocks.forgetSessionIdentity,
      resetSession: mocks.resetSession,
      setRoomTokens: mocks.setRoomTokens,
      playerIdsBySession: { "room-1": "player-1" },
    }),
  },
}));

vi.mock("@/yjs/docManager", () => ({ destroyAllSessions: vi.fn() }));
vi.mock("@/partykit/intentTransport", () => ({ clearIntentTransport: vi.fn() }));
vi.mock("@/components/landing/LandingBackground", () => ({
  LandingBackground: () => null,
}));
vi.mock("@/components/landing/OrbitAnimation", () => ({
  OrbitAnimation: () => null,
}));
vi.mock("@/components/landing/FooterLinks", () => ({ FooterLinks: () => null }));

import { LandingPage } from "../index";

describe("landing page reconnect card", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getRoomStatus.mockReset();
    mocks.navigate.mockReset();
    mocks.forgetSessionIdentity.mockReset();
    mocks.leaveRoom.mockReset();
    mocks.resetSession.mockReset();
    mocks.setRoomTokens.mockReset();
    useClientPrefsStore.setState({
      hasHydrated: true,
      lastSessionId: "room-1",
    });
    writeRoomTokensToStorage("room-1", {
      playerToken: "player-token",
      spectatorToken: "spectator-token",
      leaveToken: "leave-token",
    });
  });

  it("shows reconnect only after the saved room is confirmed", async () => {
    mocks.getRoomStatus.mockResolvedValue({ exists: true });

    render(<LandingPage />);

    expect(await screen.findByRole("button", { name: "Reconnect" })).toBeTruthy();
    expect(mocks.getRoomStatus).toHaveBeenCalledWith({
      data: { roomId: "room-1", accessToken: "player-token" },
    });
  });

  it("clears a destroyed saved room instead of showing reconnect", async () => {
    mocks.getRoomStatus.mockResolvedValue({ exists: false });

    render(<LandingPage />);

    await waitFor(() => {
      expect(useClientPrefsStore.getState().lastSessionId).toBeNull();
    });
    expect(screen.queryByRole("button", { name: "Reconnect" })).toBeNull();
    await waitFor(() => {
      expect(mocks.forgetSessionIdentity).toHaveBeenCalledWith("room-1");
    });
  });

  it("keeps reconnect available when the existence check is temporarily unavailable", async () => {
    mocks.getRoomStatus.mockRejectedValue(new Error("network unavailable"));

    render(<LandingPage />);

    expect(await screen.findByRole("button", { name: "Reconnect" })).toBeTruthy();
    expect(useClientPrefsStore.getState().lastSessionId).toBe("room-1");
  });

  it("confirms and completes a server-side Leave Room before forgetting it", async () => {
    mocks.getRoomStatus.mockResolvedValue({ exists: true });
    mocks.leaveRoom.mockResolvedValue(undefined);
    render(<LandingPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Leave Room" }));
    expect(screen.getByRole("heading", { name: "Leave this Room?" })).toBeTruthy();
    expect(mocks.leaveRoom).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave Room" }));

    await waitFor(() => {
      expect(mocks.leaveRoom).toHaveBeenCalledWith({
        data: {
          roomId: "room-1",
          playerId: "player-1",
          leaveToken: "leave-token",
        },
      });
      expect(useClientPrefsStore.getState().lastSessionId).toBeNull();
    });
  });

  it("preserves resume access when Leave Room fails", async () => {
    mocks.getRoomStatus.mockResolvedValue({ exists: true });
    mocks.leaveRoom.mockRejectedValue(new Error("network unavailable"));
    render(<LandingPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Leave Room" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave Room" }));

    await waitFor(() => expect(mocks.leaveRoom).toHaveBeenCalledTimes(1));
    expect(useClientPrefsStore.getState().lastSessionId).toBe("room-1");
    expect(await screen.findByRole("button", { name: "Leave Room" })).toBeTruthy();
  });
});
