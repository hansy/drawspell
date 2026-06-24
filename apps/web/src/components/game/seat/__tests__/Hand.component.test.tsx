import { DndContext } from "@dnd-kit/core";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ZONE } from "@/constants/zones";
import { useDragStore } from "@/store/dragStore";
import type { Card, Zone } from "@/types";
import { CardPreviewProvider } from "../../card/CardPreviewProvider";
import { Hand } from "../Hand";
import { HAND_CARD_SCROLL_EDGE_PADDING_PX } from "../handSizing";

const buildHandZone = (id: string, ownerId: string, cardIds: string[]): Zone => ({
  id,
  type: ZONE.HAND,
  ownerId,
  cardIds,
});

const buildCard = (id: string, zoneId: string): Card => ({
  id,
  name: "Test Card",
  ownerId: "p1",
  controllerId: "p1",
  zoneId,
  tapped: false,
  faceDown: false,
  position: { x: 0, y: 0 },
  rotation: 0,
  counters: [],
});

describe("Hand visual ownership", () => {
  beforeEach(() => {
    useDragStore.setState({
      ghostCards: null,
      activeCardId: null,
      handDragPreview: null,
      isGroupDragging: false,
      overCardScale: 1,
      pendingDropVisualClaims: [],
    } as Partial<ReturnType<typeof useDragStore.getState>>);
  });

  it("keeps a source-zone card visually suppressed while drop ownership is pending", () => {
    const card = buildCard("c1", "p1-battlefield");
    const zone = buildHandZone("p1-hand", "p1", [card.id]);

    useDragStore.setState({
      pendingDropVisualClaims: [
        {
          cardId: card.id,
          sourceZoneId: "p1-hand",
          targetZoneId: "p1-battlefield",
        },
      ],
    } as Partial<ReturnType<typeof useDragStore.getState>>);

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Hand
            zone={zone}
            cards={[card]}
            isTop={false}
            isRight={false}
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            showLabel={false}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const sourceCard = container.querySelector(
      '[data-dnd-hand-sortable-card-id="c1"]'
    );

    expect(sourceCard).not.toBeNull();
    expect(sourceCard?.classList.contains("opacity-0")).toBe(true);
  });

  it("shows a translucent card preview for the active hand drag source", () => {
    const card = buildCard("c1", "p1-hand");
    const zone = buildHandZone("p1-hand", "p1", [card.id]);

    useDragStore.setState({
      activeCardId: card.id,
    } as Partial<ReturnType<typeof useDragStore.getState>>);

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Hand
            zone={zone}
            cards={[card]}
            isTop={false}
            isRight={false}
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            showLabel={false}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const sourceCard = container.querySelector(
      '[data-dnd-hand-sortable-card-id="c1"]'
    );

    expect(sourceCard).not.toBeNull();
    expect(sourceCard?.classList.contains("opacity-0")).toBe(false);
    expect(sourceCard?.classList.contains("opacity-40")).toBe(false);
    expect(
      container.querySelector('[data-dnd-hand-drop-preview-card-id="c1"]')
    ).not.toBeNull();
    expect(
      container
        .querySelector('[data-dnd-hand-card-frame-id="c1"]')
        ?.classList.contains("opacity-0")
    ).toBe(false);
    expect(
      (
        container.querySelector(
          '[data-dnd-hand-card-frame-id="c1"]'
        ) as HTMLElement
      ).style.opacity
    ).toBe(
      "0.45"
    );
    expect(
      container
        .querySelector('[data-card-id="c1"]')
        ?.classList.contains("ring-2")
    ).toBe(true);
  });

  it("renders an active hand drag preview at the edge target index", () => {
    const cards = [
      buildCard("c1", "p1-hand"),
      buildCard("c2", "p1-hand"),
      buildCard("c3", "p1-hand"),
    ];
    const zone = buildHandZone("p1-hand", "p1", cards.map((card) => card.id));

    useDragStore.setState({
      activeCardId: "c3",
      handDragPreview: {
        cardId: "c3",
        zoneId: "p1-hand",
        targetIndex: 0,
      },
    } as Partial<ReturnType<typeof useDragStore.getState>>);

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Hand
            zone={zone}
            cards={cards}
            isTop={false}
            isRight={false}
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            showLabel={false}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const renderedCardIds = Array.from(
      container.querySelectorAll("[data-dnd-hand-sortable-card-id]")
    ).map((node) => node.getAttribute("data-dnd-hand-sortable-card-id"));

    expect(renderedCardIds).toEqual(["c3", "c1", "c2"]);
    expect(
      container.querySelector('[data-dnd-hand-drop-preview-card-id="c3"]')
    ).not.toBeNull();
    expect(
      container
        .querySelector('[data-dnd-hand-card-frame-id="c3"]')
        ?.classList.contains("opacity-0")
    ).toBe(false);
    expect(
      (
        container.querySelector(
          '[data-dnd-hand-card-frame-id="c3"]'
        ) as HTMLElement
      ).style.opacity
    ).toBe(
      "0.45"
    );
  });

  it("allows native horizontal touch panning in the hand scroll area", () => {
    const card = buildCard("c1", "p1-hand");
    const zone = buildHandZone("p1-hand", "p1", [card.id]);

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Hand
            zone={zone}
            cards={[card]}
            isTop={false}
            isRight={false}
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            showLabel={false}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const handZone = container.querySelector('[data-zone-id="p1-hand"]');

    expect(handZone).not.toBeNull();
    expect(handZone?.classList.contains("touch-pan-x")).toBe(true);
    expect(handZone?.classList.contains("touch-none")).toBe(false);
  });

  it("adds scroll-edge gutter around the card strip", () => {
    const cards = [buildCard("c1", "p1-hand"), buildCard("c2", "p1-hand")];
    const zone = buildHandZone("p1-hand", "p1", cards.map((card) => card.id));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Hand
            zone={zone}
            cards={cards}
            isTop={false}
            isRight={false}
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            showLabel={false}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const strip = container.querySelector("[data-dnd-hand-card-strip]");

    expect(strip).not.toBeNull();
    expect(strip?.classList.contains("justify-start")).toBe(true);
    expect(strip?.classList.contains("w-max")).toBe(true);
    expect(strip?.classList.contains("shrink-0")).toBe(true);
    expect((strip as HTMLElement).style.paddingLeft).toBe(
      `${HAND_CARD_SCROLL_EDGE_PADDING_PX}px`
    );
    expect((strip as HTMLElement).style.paddingRight).toBe(
      `${HAND_CARD_SCROLL_EDGE_PADDING_PX}px`
    );
  });

  it("does not expand or scale hand card slots on hover", () => {
    const cards = [buildCard("c1", "p1-hand"), buildCard("c2", "p1-hand")];
    const zone = buildHandZone("p1-hand", "p1", cards.map((card) => card.id));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Hand
            zone={zone}
            cards={cards}
            isTop={false}
            isRight={false}
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            showLabel={false}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const sourceCard = container.querySelector(
      '[data-dnd-hand-sortable-card-id="c1"]'
    );

    expect(sourceCard).not.toBeNull();
    expect(sourceCard?.classList.contains("hover:-translate-y-3")).toBe(true);
    expect(sourceCard?.classList.contains("duration-300")).toBe(true);
    expect(sourceCard?.classList.contains("ease-[cubic-bezier(0.22,1,0.36,1)]")).toBe(
      true
    );
    expect(sourceCard?.classList.contains("hover:max-w-[20rem]")).toBe(false);
    expect(sourceCard?.classList.contains("hover:scale-110")).toBe(false);

    const card = container.querySelector('[data-card-id="c1"]');
    expect(card).not.toBeNull();
    expect(card?.classList.contains("group-hover:ring-2")).toBe(true);
    expect(card?.classList.contains("group-hover:ring-cyan-200/90")).toBe(true);
    expect(card?.classList.contains("hover:ring-2")).toBe(true);
    expect(card?.getAttribute("style")).toContain("transform 300ms");
  });
});
