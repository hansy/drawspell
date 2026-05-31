import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { useGameStore } from "@/store/gameStore";
import { ensureLocalStorage } from "@test/utils/storage";

import { Sidenav } from "../Sidenav";

describe("Sidenav", () => {
  beforeAll(() => {
    ensureLocalStorage();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("calls untapAll with myPlayerId", () => {
    const untapAll = vi.fn();

    useGameStore.setState({
      myPlayerId: "me",
      untapAll: untapAll as unknown as (playerId: string) => void,
    });

    render(<Sidenav onOpenCoinFlipper={vi.fn()} onOpenDiceRoller={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Untap All" }));
    expect(untapAll).toHaveBeenCalledTimes(1);
    expect(untapAll).toHaveBeenCalledWith("me");
  });

  it("shows end turn as the first player action and calls its handler", () => {
    const onEndTurn = vi.fn();

    render(
      <Sidenav
        onEndTurn={onEndTurn}
        onOpenCoinFlipper={vi.fn()}
        onOpenDiceRoller={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0].getAttribute("aria-label")).toBe("End turn");

    fireEvent.click(screen.getByRole("button", { name: "End turn" }));
    expect(onEndTurn).toHaveBeenCalledTimes(1);
  });

  it("uses active tap feedback classes on nav icon buttons", () => {
    render(<Sidenav onOpenCoinFlipper={vi.fn()} onOpenDiceRoller={vi.fn()} />);

    const endTurnButton = screen.getByRole("button", { name: "End turn" });
    expect(endTurnButton.className).toContain("active:bg-zinc-800/50");
    expect(endTurnButton.className).toContain("active:scale-95");
    expect(endTurnButton.className).toContain("active:text-red-400");

    const rollDiceButton = screen.getByRole("button", { name: "Roll Dice" });
    expect(rollDiceButton.className).toContain("active:text-indigo-400");
  });

  it("opens the share dialog from the share button", () => {
    const onOpenShareDialog = vi.fn();

    render(
      <Sidenav
        onOpenCoinFlipper={vi.fn()}
        onOpenDiceRoller={vi.fn()}
        onOpenShareDialog={onOpenShareDialog}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share room" }));
    expect(onOpenShareDialog).toHaveBeenCalledTimes(1);
  });

  it("disables the share button when sharing is unavailable", () => {
    const onOpenShareDialog = vi.fn();

    render(
      <Sidenav
        onOpenCoinFlipper={vi.fn()}
        onOpenDiceRoller={vi.fn()}
        onOpenShareDialog={onOpenShareDialog}
        canShareRoom={false}
      />,
    );

    const shareButton = screen.getByRole("button", { name: "Share room" });
    expect((shareButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(shareButton);
    expect(onOpenShareDialog).not.toHaveBeenCalled();
  });

  it("shows feedback mailto link in the main menu", () => {
    render(<Sidenav onOpenCoinFlipper={vi.fn()} onOpenDiceRoller={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const feedbackLink = screen.getByRole("link", {
      name: "Send Feedback!",
    });
    expect(feedbackLink.getAttribute("href")).toBe(
      "mailto:feedback@drawspell.space",
    );
  });
});
