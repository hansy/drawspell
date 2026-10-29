import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

  afterEach(() => {
    vi.useRealTimers();
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

  it("leaves End turn to the turn pill instead of the sidebar", () => {
    render(<Sidenav onOpenCoinFlipper={vi.fn()} onOpenDiceRoller={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "End turn" })).toBeNull();
    expect(screen.getAllByRole("button")[0].getAttribute("aria-label")).toBe("Untap All");
  });

  it("opens the coin flipper and dice roller from one button", () => {
    const onOpenCoinFlipper = vi.fn();
    const onOpenDiceRoller = vi.fn();
    render(
      <Sidenav onOpenCoinFlipper={onOpenCoinFlipper} onOpenDiceRoller={onOpenDiceRoller} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Coin or dice" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Flip a coin/ }));
    expect(onOpenCoinFlipper).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Coin or dice" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Roll dice/ }));
    expect(onOpenDiceRoller).toHaveBeenCalledTimes(1);
  });

  it("does not show the menu label or Pass Turn option", () => {
    render(<Sidenav />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.queryByText("Drawspell Menu")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pass Turn" })).toBeNull();
  });

  it("uses active tap feedback classes on nav icon buttons", () => {
    render(<Sidenav onOpenCoinFlipper={vi.fn()} onOpenDiceRoller={vi.fn()} />);

    const untapButton = screen.getByRole("button", { name: "Untap All" });
    expect(untapButton.className).toContain("active:bg-zinc-800/50");
    expect(untapButton.className).toContain("active:scale-95");
    expect(untapButton.className).toContain("active:text-blue-400");

    const randomButton = screen.getByRole("button", { name: "Coin or dice" });
    expect(randomButton.className).toContain("active:text-yellow-400");
  });

  it("shows a temporary label on touch press", () => {
    vi.useFakeTimers();
    render(<Sidenav onOpenCoinFlipper={vi.fn()} onOpenDiceRoller={vi.fn()} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Untap All" }), {
      pointerType: "touch",
    });

    expect(screen.getByText("Untap All")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText("Untap All")).toBeNull();
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
