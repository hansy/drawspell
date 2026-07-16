import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientPrefsStore } from "@/store/clientPrefsStore";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: vi.fn(() => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ sessionId: "room-1" }),
  })),
}));

vi.mock("@/components/game/board/MultiplayerBoard", () => ({
  MultiplayerBoard: () => {
    throw new Promise(() => undefined);
  },
}));

vi.mock("@/components/username/UsernamePromptScreen", () => ({
  UsernamePromptScreen: () => {
    throw new Promise(() => undefined);
  },
}));

import { GameRoute } from "../rooms.$sessionId";

describe("room route loading boundaries", () => {
  beforeEach(() => {
    useClientPrefsStore.setState({
      hasHydrated: true,
      username: "Test player",
    });
  });

  it("keeps a dark loading screen visible while the board chunk loads", async () => {
    const { container } = render(<GameRoute />);

    expect(await screen.findByText("Loading game")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("bg-zinc-950");
  });

  it("keeps a dark loading screen visible while the username screen loads", async () => {
    useClientPrefsStore.setState({ username: null });

    const { container } = render(<GameRoute />);

    expect(await screen.findByText("Loading game")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("bg-zinc-950");
  });
});
