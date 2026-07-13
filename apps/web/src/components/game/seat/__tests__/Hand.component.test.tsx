import { DndContext } from "@dnd-kit/core";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { useDragStore } from "@/store/dragStore";
import type { Card, Zone } from "@/types";
import { CardPreviewProvider } from "../../card/CardPreviewProvider";
import { Hand } from "../Hand";
import {
  HAND_CARD_SCROLL_EDGE_PADDING_PX,
  HAND_CARD_TOP_GAP_PX,
} from "../handSizing";

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

  it("allows native horizontal touch panning when the custom scrollbar is disabled", () => {
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

  it("keeps cards centered with scroll-edge gutters around the card strip", () => {
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
    const sourceCard = container.querySelector(
      '[data-dnd-hand-sortable-card-id="c1"]'
    );

    expect(strip).not.toBeNull();
    expect(strip?.classList.contains("items-center")).toBe(true);
    expect(strip?.classList.contains("lg:items-start")).toBe(true);
    expect(strip?.classList.contains("pt-0")).toBe(true);
    expect(strip?.classList.contains("lg:pt-[var(--hand-card-top-gap)]")).toBe(true);
    expect(strip?.classList.contains("justify-center")).toBe(true);
    expect(strip?.classList.contains("w-max")).toBe(true);
    expect(strip?.classList.contains("shrink-0")).toBe(true);
    expect(strip?.classList.contains("box-content")).toBe(false);
    expect(sourceCard).not.toBeNull();
    expect(sourceCard?.classList.contains("items-center")).toBe(true);
    expect(sourceCard?.classList.contains("lg:items-start")).toBe(true);
    expect(
      container
        .querySelector('[data-card-id="c1"]')
        ?.classList.contains("origin-center")
    ).toBe(true);
    expect(
      container
        .querySelector('[data-card-id="c1"]')
        ?.classList.contains("lg:origin-top")
    ).toBe(true);
    expect((strip as HTMLElement).style.getPropertyValue("--hand-card-top-gap")).toBe(
      `${HAND_CARD_TOP_GAP_PX}px`
    );
    expect((strip as HTMLElement).style.paddingLeft).toBe(
      `${HAND_CARD_SCROLL_EDGE_PADDING_PX}px`
    );
    expect((strip as HTMLElement).style.paddingRight).toBe(
      `${HAND_CARD_SCROLL_EDGE_PADDING_PX}px`
    );
  });

  it("aligns fitted card geometry to the hand bounds and places its label at the bottom", () => {
    const cards = [buildCard("c1", "p1-hand"), buildCard("c2", "p1-hand")];
    const zone = buildHandZone("p1-hand", "p1", cards.map((card) => card.id));

    const { container, getByText } = render(
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
            baseCardHeight={120}
            cardScale={1.25}
            fitCards
            labelPlacement="bottom-center"
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const frame = container.querySelector(
      '[data-dnd-hand-card-frame-id="c1"]',
    ) as HTMLElement | null;
    const card = container.querySelector('[data-card-id="c1"]') as HTMLElement | null;
    const label = getByText("Hand - 2");

    expect(frame?.style.width).toBe("100px");
    expect(frame?.style.height).toBe("150px");
    expect(card?.style.transformOrigin).toBe("top left");
    expect(label.classList.contains("bottom-1")).toBe(true);
  });

  it("supports a low-overlap mobile hand layout", () => {
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
            baseCardHeight={120}
            cardScale={2}
            cardOverlapRatio={0.9}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const sourceCard = container.querySelector(
      '[data-dnd-hand-sortable-card-id="c1"]'
    ) as HTMLElement | null;

    expect(sourceCard).not.toBeNull();
    expect(sourceCard?.style.getPropertyValue("--hand-card-slot-width")).toBe(
      "144px"
    );
  });

  it("uses the hand zone as the native horizontal scroll container", () => {
    const cards = [
      buildCard("c1", "p1-hand"),
      buildCard("c2", "p1-hand"),
      buildCard("c3", "p1-hand"),
    ];
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

    const handZone = container.querySelector('[data-zone-id="p1-hand"]');

    expect(handZone).not.toBeNull();
    expect(handZone?.classList.contains("overflow-x-auto")).toBe(true);
    expect(handZone?.classList.contains("overflow-y-hidden")).toBe(true);
  });

  it("keeps cards touch-locked for drag", () => {
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

    const sourceCard = container.querySelector(
      '[data-dnd-hand-sortable-card-id="c1"]'
    );

    expect(sourceCard).not.toBeNull();
    expect(sourceCard?.classList.contains("touch-none")).toBe(true);
  });

  it("does not show the custom scrollbar by default even when the hand overflows", () => {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(200);
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(500);
    const cards = [
      buildCard("c1", "p1-hand"),
      buildCard("c2", "p1-hand"),
      buildCard("c3", "p1-hand"),
    ];
    const zone = buildHandZone("p1-hand", "p1", cards.map((card) => card.id));

    try {
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

      const strip = container.querySelector(
        "[data-dnd-hand-card-strip]"
      ) as HTMLElement | null;

      expect(container.querySelector("[data-dnd-hand-scrollbar]")).toBeNull();
      expect(strip?.style.paddingBottom).toBe("0px");
    } finally {
      clientWidth.mockRestore();
      scrollWidth.mockRestore();
    }
  });

  it("shows a persistent custom scrollbar when enabled and uses it to scroll", () => {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(200);
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(500);
    const cards = [
      buildCard("c1", "p1-hand"),
      buildCard("c2", "p1-hand"),
      buildCard("c3", "p1-hand"),
    ];
    const zone = buildHandZone("p1-hand", "p1", cards.map((card) => card.id));

    try {
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
              showCustomScrollbar
            />
          </CardPreviewProvider>
        </DndContext>
      );

      const handZone = container.querySelector(
        '[data-zone-id="p1-hand"]'
      ) as HTMLDivElement | null;
      const strip = container.querySelector(
        "[data-dnd-hand-card-strip]"
      ) as HTMLElement | null;
      const scrollbar = container.querySelector(
        "[data-dnd-hand-scrollbar]"
      ) as HTMLInputElement | null;

      expect(handZone).not.toBeNull();
      expect(handZone?.classList.contains("touch-none")).toBe(true);
      expect(handZone?.classList.contains("touch-pan-x")).toBe(false);
      expect(strip).not.toBeNull();
      expect(scrollbar).not.toBeNull();
      expect(scrollbar?.getAttribute("max")).toBe("300");
      expect(strip?.style.paddingBottom).toBe("12px");

      fireEvent.change(scrollbar as HTMLInputElement, {
        target: { value: "120" },
      });

      expect(handZone?.scrollLeft).toBe(120);
    } finally {
      clientWidth.mockRestore();
      scrollWidth.mockRestore();
    }
  });

  it("reserves custom scrollbar space before the scrollbar becomes visible", () => {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(500);
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(500);
    const cards = [buildCard("c1", "p1-hand"), buildCard("c2", "p1-hand")];
    const zone = buildHandZone("p1-hand", "p1", cards.map((card) => card.id));

    try {
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
              showCustomScrollbar
            />
          </CardPreviewProvider>
        </DndContext>
      );

      const strip = container.querySelector(
        "[data-dnd-hand-card-strip]"
      ) as HTMLElement | null;

      expect(container.querySelector("[data-dnd-hand-scrollbar]")).toBeNull();
      expect(strip?.style.paddingBottom).toBe("12px");
    } finally {
      clientWidth.mockRestore();
      scrollWidth.mockRestore();
    }
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
