import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Card } from "@/types";
import { buildLibraryManaSections } from "@/models/game/zone-viewer/zoneViewerModel";
import { ZoneViewerGroupedView } from "../ZoneViewerGroupedView";

const preview = vi.hoisted(() => ({
  showPreview: vi.fn(),
  hidePreview: vi.fn(),
  toggleLock: vi.fn(),
  unlockPreview: vi.fn(),
}));

vi.mock("../../card/CardPreviewProvider", () => ({
  useOptionalCardPreview: () => preview,
}));

const card = (id: string, name: string): Card =>
  ({
    id,
    name,
    canonicalName: name,
    manaCost: "{1}{U}",
    manaValue: 2,
    typeLine: "Creature",
    ownerId: "me",
    controllerId: "me",
    zoneId: "library",
    tapped: false,
    faceDown: false,
    position: { x: 0, y: 0 },
    rotation: 0,
    counters: [],
  }) as Card;

describe("ZoneViewerGroupedView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
  });

  it("does not preview on hover, locks on click, and uses one representative for context actions", () => {
    const first = card("a", "Aether Adept");
    const second = card("b", "Aether Adept");
    const onContextMenu = vi.fn();
    const { container } = render(
      <ZoneViewerGroupedView
        sections={buildLibraryManaSections([first, second])}
        interactionsDisabled={false}
        onCardContextMenu={onContextMenu}
      />
    );
    const row = container.querySelector(".library-card-row") as HTMLDivElement;

    fireEvent.mouseEnter(row);
    expect(preview.showPreview).not.toHaveBeenCalled();
    fireEvent.click(row, { detail: 1 });
    expect(preview.toggleLock).toHaveBeenCalledWith(first, row);
    fireEvent.contextMenu(row, { clientX: 30, clientY: 40 });
    expect(preview.unlockPreview).toHaveBeenCalled();
    expect(onContextMenu).toHaveBeenCalledWith(expect.anything(), first);
  });

  it("suppresses long press and tap activation for a multi-touch gesture", () => {
    vi.useFakeTimers();
    const first = card("a", "Aether Adept");
    const onContextMenu = vi.fn();
    const { container } = render(
      <ZoneViewerGroupedView
        sections={buildLibraryManaSections([first])}
        interactionsDisabled={false}
        onCardContextMenu={onContextMenu}
      />
    );
    const row = container.querySelector(".library-card-row") as HTMLDivElement;

    fireEvent.pointerDown(row, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerDown(row, {
      pointerId: 2,
      pointerType: "touch",
      button: 0,
      clientX: 30,
      clientY: 20,
    });
    vi.advanceTimersByTime(500);

    expect(onContextMenu).not.toHaveBeenCalled();
    fireEvent.pointerUp(row, { pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(row, { pointerId: 2, pointerType: "touch" });
    expect(preview.toggleLock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears transient and locked previews when the grouped view unmounts", () => {
    const first = card("a", "Aether Adept");
    const { unmount } = render(
      <ZoneViewerGroupedView
        sections={buildLibraryManaSections([first])}
        interactionsDisabled={false}
        onCardContextMenu={vi.fn()}
      />
    );

    unmount();

    expect(preview.hidePreview).toHaveBeenCalledWith();
    expect(preview.unlockPreview).toHaveBeenCalled();
  });
});
