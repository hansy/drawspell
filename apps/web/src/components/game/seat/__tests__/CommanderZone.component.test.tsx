import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";

import { useGameStore } from "@/store/gameStore";
import { useDragStore } from "@/store/dragStore";
import { useSelectionStore } from "@/store/selectionStore";
import { ZONE } from "@/constants/zones";
import { CardPreviewProvider } from "@/components/game/card/CardPreviewProvider";
import type { Card } from "@/types";

import { CommanderZone } from "../CommanderZone";

describe("CommanderZone", () => {
  let originalUpdateCard: unknown;

  beforeEach(() => {
    originalUpdateCard = useGameStore.getState().updateCard;
    useDragStore.setState({
      ghostCards: null,
      activeCardId: null,
      isGroupDragging: false,
      overCardScale: 1,
    });
    useSelectionStore.setState({ selectedCardIds: [], selectionZoneId: null });
  });

  afterEach(() => {
    act(() => {
      useGameStore.setState({ updateCard: originalUpdateCard as any } as any);
    });
  });

  it("updates commander tax for the zone owner", () => {
    const updateCard = vi.fn();
    const card: Card = {
      id: "c1",
      name: "Test Commander",
      ownerId: "me",
      controllerId: "me",
      zoneId: "cmd-me",
      tapped: false,
      faceDown: false,
      position: { x: 0.5, y: 0.5 },
      rotation: 0,
      counters: [],
      commanderTax: 0,
      isCommander: true,
    };
    const secondCard: Card = {
      ...card,
      id: "c2",
      name: "Partner Commander",
    };
    const zone = {
      id: "cmd-me",
      type: ZONE.COMMANDER,
      ownerId: "me",
      cardIds: [card.id, secondCard.id],
    } as any;
    act(() => {
      useGameStore.setState({
        myPlayerId: "me",
        viewerRole: "player",
        players: { me: { id: "me", commanderTax: 0 } as any },
        zones: { [zone.id]: zone },
        cards: { [card.id]: card, [secondCard.id]: secondCard },
        updateCard: updateCard as any,
      } as any);
    });

    render(
      <DndContext>
        <CardPreviewProvider>
          <CommanderZone
            zone={zone}
            cards={[card, secondCard]}
            isTop
            isRight={false}
            scale={1}
            color="sky"
            onZoneContextMenu={vi.fn()}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Increase commander tax for ${card.name}` })
    );
    const label = document.querySelector("[data-commander-zone-label]");
    const panel = document.querySelector("[data-commander-zone-panel]");
    expect(label?.textContent).toBe("Commander");
    expect(label?.getAttribute("data-commander-drop-target")).toBe("true");
    expect(label?.getAttribute("data-drag-overlay-scale")).toBe("0.2");
    expect(label?.classList.contains("h-28")).toBe(false);
    expect(label?.classList.contains("h-[var(--commander-zone-label-height)]")).toBe(true);
    expect((label as HTMLElement | null)?.style.paddingBlock).toBe(
      "var(--commander-zone-label-padding)",
    );
    expect(panel?.classList.contains("h-[var(--commander-drawer-height)]")).toBe(true);
    expect(label?.classList.contains("py-3")).toBe(false);
    expect(
      label?.querySelector("span")?.classList.contains("ds-seat-vertical-label"),
    ).toBe(true);
    expect(label?.classList.contains("invisible")).toBe(false);
    expect(label?.classList.contains("rotate-180")).toBe(false);
    expect(panel?.classList.contains("invisible")).toBe(true);
    expect(
      panel?.classList.contains("group-hover/commander-zone:visible"),
    ).toBe(true);
    expect(panel?.classList.contains("top-0")).toBe(true);
    expect(panel?.classList.contains("left-full")).toBe(true);
    const drawer = panel?.querySelector('[data-zone-id="cmd-me"]');
    expect(drawer?.classList.contains("rounded-r-lg")).toBe(true);
    expect(drawer?.classList.contains("rounded-lg")).toBe(false);
    expect((drawer as HTMLElement | null)?.style.padding).toBe("8px");
    expect(document.querySelectorAll("[data-commander-drawer-card]")).toHaveLength(2);
    const drawerCard = document.querySelector('[data-card-id="c1"]');
    expect(drawerCard?.classList.contains("hover:scale-105")).toBe(false);
    expect(drawerCard?.classList.contains("cursor-grab")).toBe(true);
    const presenceLight = document.querySelector(
      "[data-commander-presence-light]",
    ) as HTMLElement | null;
    expect(presenceLight?.getAttribute("data-commander-presence-segments")).toBe("2");
    expect(presenceLight?.style.backgroundImage).toContain("rgba(56, 189, 248, 0.95)");
    expect(presenceLight?.classList.contains("inset-y-0")).toBe(true);
    expect(presenceLight?.classList.contains("inset-y-1")).toBe(false);
    fireEvent.click(label as HTMLElement);
    expect(label?.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.classList.contains("visible")).toBe(true);
    expect(panel?.classList.contains("invisible")).toBe(false);
    expect(updateCard).toHaveBeenCalledWith(card.id, { commanderTax: 2 }, "me");
  });

  it("disables the expanded drawer as a drop target during a card drag", async () => {
    const card: Card = {
      id: "c1",
      name: "Test Commander",
      ownerId: "me",
      controllerId: "me",
      zoneId: "cmd-me",
      tapped: false,
      faceDown: false,
      position: { x: 0.5, y: 0.5 },
      rotation: 0,
      counters: [],
      commanderTax: 0,
      isCommander: true,
    };
    const zone = {
      id: "cmd-me",
      type: ZONE.COMMANDER,
      ownerId: "me",
      cardIds: [card.id],
    } as any;
    act(() => {
      useGameStore.setState({
        myPlayerId: "me",
        viewerRole: "player",
        players: { me: { id: "me", commanderTax: 0 } as any },
        zones: { [zone.id]: zone },
        cards: { [card.id]: card },
      } as any);
    });

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <CommanderZone
            zone={zone}
            cards={[card]}
            isTop={false}
            isRight={false}
            scale={1}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const drawerZone = container.querySelector('[data-zone-id="cmd-me"]');
    expect(drawerZone?.getAttribute("data-zone-drop-disabled")).toBe("false");
    expect(
      container
        .querySelector("[data-commander-presence-light]")
        ?.getAttribute("data-commander-presence-segments"),
    ).toBe("1");

    const commanderCard = container.querySelector(
      '[data-card-id="c1"]',
    ) as HTMLElement;
    commanderCard.focus();
    fireEvent.keyDown(commanderCard, { key: " ", code: "Space" });

    await waitFor(() =>
      expect(drawerZone?.getAttribute("data-zone-drop-disabled")).toBe("true"),
    );
    fireEvent.keyDown(commanderCard, { key: "Escape", code: "Escape" });
  });
});
