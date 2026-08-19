import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ZONE } from "@/constants/zones";
import type { Card, Zone } from "@/types";

import { ZoneViewerModalView } from "../ZoneViewerModalView";
import { buildLibraryManaSections } from "@/models/game/zone-viewer/zoneViewerModel";

const buildZone = (overrides: Partial<Zone>): Zone =>
  ({
    id: overrides.id ?? "z1",
    type: overrides.type ?? ZONE.GRAVEYARD,
    ownerId: overrides.ownerId ?? "me",
    cardIds: overrides.cardIds ?? [],
  }) as any;

const buildCard = (id: string, name: string, zoneId: string): Card =>
  ({
    id,
    name,
    ownerId: "me",
    controllerId: "me",
    zoneId,
    tapped: false,
    faceDown: false,
    position: { x: 0, y: 0 },
    rotation: 0,
    counters: [],
  }) as any;

describe("ZoneViewerModalView", () => {
  it("does not auto-focus the search input when opened", () => {
    const zone = buildZone({ type: ZONE.GRAVEYARD, id: "gy-me" });
    const cards = [buildCard("c1", "Card1", zone.id)];

    render(
      <ZoneViewerModalView
        isOpen
        onClose={vi.fn()}
        zone={zone}
        count={undefined}
        isLoading={false}
        expectedViewCount={null}
        filterText=""
        setFilterText={vi.fn()}
        containerRef={React.createRef<HTMLDivElement>()}
        listRef={React.createRef<HTMLDivElement>()}
        displayCards={cards}
        viewMode="linear"
        groupedCards={{}}
        sortedKeys={[]}
        librarySections={[]}
        uniqueCardCount={0}
        canReorder={false}
        orderedCards={cards}
        orderedCardIds={cards.map((c) => c.id)}
        setOrderedCardIds={vi.fn() as any}
        draggingId={null}
        setDraggingId={vi.fn() as any}
        reorderList={(ids) => ids}
        commitReorder={vi.fn()}
        handleContextMenu={vi.fn()}
        contextMenu={null}
        closeContextMenu={vi.fn()}
        interactionsDisabled={false}
        pinnedCardId={undefined}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search by name, type, or text...");
    expect(searchInput).not.toBe(document.activeElement);
  });

  it("renders a linear view with a top-card label", () => {
    const zone = buildZone({ type: ZONE.GRAVEYARD, id: "gy-me" });
    const cards = [
      buildCard("c1", "Card1", zone.id),
      buildCard("c2", "Card2", zone.id),
    ];

    render(
      <ZoneViewerModalView
        isOpen
        onClose={vi.fn()}
        zone={zone}
        count={undefined}
        isLoading={false}
        expectedViewCount={null}
        filterText=""
        setFilterText={vi.fn()}
        containerRef={React.createRef<HTMLDivElement>()}
        listRef={React.createRef<HTMLDivElement>()}
        displayCards={cards}
        viewMode="linear"
        groupedCards={{}}
        sortedKeys={[]}
        librarySections={[]}
        uniqueCardCount={0}
        canReorder={false}
        orderedCards={cards}
        orderedCardIds={cards.map((c) => c.id)}
        setOrderedCardIds={vi.fn() as any}
        draggingId={null}
        setDraggingId={vi.fn() as any}
        reorderList={(ids) => ids}
        commitReorder={vi.fn()}
        handleContextMenu={vi.fn()}
        contextMenu={null}
        closeContextMenu={vi.fn()}
        interactionsDisabled={false}
        pinnedCardId={undefined}
      />
    );

    expect(screen.getByText("graveyard Viewer")).toBeTruthy();
    expect(screen.getByText("Top card")).toBeTruthy();
    expect(screen.getByText("Card1")).toBeTruthy();
    expect(screen.getByText("Card2")).toBeTruthy();
    const cardSlot = document.querySelector<HTMLElement>('[data-zone-viewer-card-id="c1"]');
    const list = cardSlot?.parentElement;
    const cardWidth = Number.parseFloat(cardSlot?.firstElementChild?.getAttribute("style")?.match(/width: ([\d.]+)px/)?.[1] ?? "0");
    const slotWidth = Number.parseFloat(cardSlot?.style.width ?? "0");
    const sidePadding = Number.parseFloat(list?.style.paddingLeft ?? "0");
    expect(sidePadding).toBeGreaterThan((cardWidth - slotWidth) / 2);
  });

  it("renders grouped columns for the library", () => {
    const zone = buildZone({ type: ZONE.LIBRARY, id: "lib-me" });
    const land = buildCard("l1", "Land", zone.id);
    const spell = buildCard("s1", "Spell", zone.id);
    land.typeLine = "Basic Land";
    spell.scryfall = { cmc: 1 } as any;

    render(
      <ZoneViewerModalView
        isOpen
        onClose={vi.fn()}
        zone={zone}
        count={undefined}
        isLoading={false}
        expectedViewCount={null}
        filterText=""
        setFilterText={vi.fn()}
        containerRef={React.createRef<HTMLDivElement>()}
        listRef={React.createRef<HTMLDivElement>()}
        displayCards={[land, spell]}
        viewMode="grouped"
        groupedCards={{ Lands: [land], "Cost 1": [spell] }}
        sortedKeys={["Lands", "Cost 1"]}
        librarySections={buildLibraryManaSections([land, spell])}
        uniqueCardCount={2}
        canReorder={false}
        orderedCards={[]}
        orderedCardIds={[]}
        setOrderedCardIds={vi.fn() as any}
        draggingId={null}
        setDraggingId={vi.fn() as any}
        reorderList={(ids) => ids}
        commitReorder={vi.fn()}
        handleContextMenu={vi.fn()}
        contextMenu={null}
        closeContextMenu={vi.fn()}
        interactionsDisabled={false}
        pinnedCardId={undefined}
      />
    );

    expect(screen.getByText("Library")).toBeTruthy();
    expect(screen.getByText("2 cards · 2 unique")).toBeTruthy();
    expect(screen.getByText("Lands")).toBeTruthy();
    expect(screen.getByText("1-mana")).toBeTruthy();
    expect(screen.getByText("Land")).toBeTruthy();
    expect(screen.getByText("Spell")).toBeTruthy();

    const libraryView = document.querySelector(".library-view-container");
    expect(libraryView?.parentElement?.classList.contains("h-0")).toBe(true);
    expect(libraryView?.parentElement?.classList.contains("flex")).toBe(true);
    expect(libraryView?.classList.contains("flex-1")).toBe(true);
    expect(libraryView?.classList.contains("flex")).toBe(true);
    expect(libraryView?.classList.contains("h-full")).toBe(false);
    expect(libraryView?.firstElementChild?.classList.contains("flex-1")).toBe(true);
    expect(libraryView?.firstElementChild?.classList.contains("h-full")).toBe(false);
  });

  it("centers a top-X library fan when it fits", () => {
    const zone = buildZone({ type: ZONE.LIBRARY, id: "lib-top-me" });
    const cards = [
      buildCard("top-1", "Top 1", zone.id),
      buildCard("top-2", "Top 2", zone.id),
    ];

    render(
      <ZoneViewerModalView
        isOpen
        onClose={vi.fn()}
        zone={zone}
        count={2}
        isLoading={false}
        expectedViewCount={2}
        filterText=""
        setFilterText={vi.fn()}
        containerRef={React.createRef<HTMLDivElement>()}
        listRef={React.createRef<HTMLDivElement>()}
        displayCards={cards}
        viewMode="linear"
        groupedCards={{}}
        sortedKeys={[]}
        librarySections={[]}
        uniqueCardCount={0}
        canReorder
        orderedCards={cards}
        orderedCardIds={cards.map((card) => card.id)}
        setOrderedCardIds={vi.fn() as any}
        draggingId={null}
        setDraggingId={vi.fn() as any}
        reorderList={(ids) => ids}
        commitReorder={vi.fn()}
        handleContextMenu={vi.fn()}
        contextMenu={null}
        closeContextMenu={vi.fn()}
        interactionsDisabled={false}
        pinnedCardId={undefined}
      />
    );

    const slots = document.querySelectorAll<HTMLElement>("[data-zone-viewer-card-id]");
    expect(slots[0]?.classList.contains("ml-auto")).toBe(true);
    expect(slots[1]?.classList.contains("mr-auto")).toBe(true);
  });
});
