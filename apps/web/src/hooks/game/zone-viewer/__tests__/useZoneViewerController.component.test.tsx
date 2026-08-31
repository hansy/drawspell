import React from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import type { Card, Zone } from "@/types";
import { ZONE } from "@/constants/zones";
import { useGameStore } from "@/store/gameStore";
import { useSelectionStore } from "@/store/selectionStore";
import { ensureLocalStorage } from '@test/utils/storage';
import type { ContextMenuAction } from "@/models/game/context-menu/menu/types";

import {
  useZoneViewerController,
  type ZoneViewerController,
} from "../useZoneViewerController";

let latestController: ZoneViewerController | null = null;

const buildZone = (overrides: Partial<Zone>): Zone =>
  ({
    id: overrides.id ?? "z1",
    type: overrides.type ?? ZONE.LIBRARY,
    ownerId: overrides.ownerId ?? "me",
    cardIds: overrides.cardIds ?? [],
  }) as Zone;

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
  }) as Card;

const Harness: React.FC<{
  zoneId: string;
  count?: number;
  isOpen?: boolean;
}> = ({ zoneId, count, isOpen = true }) => {
  const controller = useZoneViewerController({
    isOpen,
    onClose: () => {},
    zoneId,
    count,
  });

  React.useEffect(() => {
    latestController = controller;
  }, [controller]);

  if (!controller) return null;

  return (
    <div>
      <div ref={controller.containerRef} />
      <div ref={controller.listRef} />
    </div>
  );
};

describe("useZoneViewerController", () => {
  beforeAll(() => {
    ensureLocalStorage();
  });

  beforeEach(() => {
    latestController = null;
    localStorage.clear();
    useGameStore.setState({
      cards: {},
      zones: {},
      players: {},
      myPlayerId: "me",
      viewerRole: "player",
    });
    useSelectionStore.setState({ selectedCardIds: [], selectionZoneId: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to scrollLeft when scrollTo is unavailable", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const library = buildZone({
      id: "lib-me",
      type: ZONE.LIBRARY,
      ownerId: "me",
      cardIds: ["c1", "c2", "c3"],
    });

    useGameStore.setState((state) => ({
      ...state,
      zones: { [library.id]: library },
      players: {
        me: {
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
        },
      },
      cards: {
        c1: buildCard("c1", "Card1", library.id),
        c2: buildCard("c2", "Card2", library.id),
        c3: buildCard("c3", "Card3", library.id),
      },
    }));

    render(<Harness zoneId={library.id} count={3} />);

    await waitFor(() => expect(latestController).not.toBeNull());
    const controller = latestController!;
    const listEl = controller.listRef.current;
    expect(listEl).toBeTruthy();
    if (!listEl) throw new Error("Missing list element");

    Object.defineProperty(listEl, "scrollTo", {
      value: undefined,
      writable: true,
    });
    listEl.scrollLeft = 120;

    act(() => {
      const card = useGameStore.getState().cards.c3;
      controller.handleContextMenu(
        {
          preventDefault: () => {},
          clientX: 320,
          clientY: 240,
        } as React.MouseEvent,
        card
      );
    });

    await waitFor(() => expect(latestController?.contextMenu).not.toBeNull());
    const menu = latestController!.contextMenu!;
    expect(menu.x).toBe(320);
    expect(menu.y).toBe(240);
    const moveMenu = menu.items.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Move to..."
    );
    const libraryMenu = moveMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Library ..."
    );
    const moveItem = libraryMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Bottom"
    );
    expect(moveItem && moveItem.type === "action").toBe(true);

    act(() => {
      if (moveItem && moveItem.type === "action") moveItem.onSelect();
    });

    await waitFor(() => expect(listEl.scrollLeft).toBe(0));
  });

  it("applies a zone context-menu move to the current card selection", async () => {
    const graveyard = buildZone({
      id: "graveyard-me",
      type: ZONE.GRAVEYARD,
      ownerId: "me",
      cardIds: ["c1", "c2"],
    });
    const hand = buildZone({
      id: "hand-me",
      type: ZONE.HAND,
      ownerId: "me",
      cardIds: [],
    });
    const library = buildZone({
      id: "library-me",
      type: ZONE.LIBRARY,
      ownerId: "me",
      cardIds: [],
    });
    const moveCards = vi.fn();

    useGameStore.setState((state) => ({
      ...state,
      zones: {
        [graveyard.id]: graveyard,
        [hand.id]: hand,
        [library.id]: library,
      },
      cards: {
        c1: buildCard("c1", "Card1", graveyard.id),
        c2: buildCard("c2", "Card2", graveyard.id),
      },
      players: {
        me: {
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
        },
      },
      moveCards: moveCards as typeof state.moveCards,
    }));
    useSelectionStore.getState().setSelection(["c1", "c2"], graveyard.id);

    render(<Harness zoneId={graveyard.id} />);
    await waitFor(() => expect(latestController).not.toBeNull());

    act(() => {
      latestController!.handleContextMenu(
        {
          preventDefault: () => {},
          clientX: 100,
          clientY: 100,
        } as React.MouseEvent,
        useGameStore.getState().cards.c1
      );
    });

    await waitFor(() => expect(latestController?.contextMenu).not.toBeNull());
    expect(latestController?.contextMenu?.title).toBe("2 cards selected");
    const moveMenu = latestController!.contextMenu!.items.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Move to..."
    );
    const moveToHand = moveMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Hand"
    );
    expect(moveToHand).toBeTruthy();
    const libraryMenu = moveMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Library..."
    );
    expect(
      libraryMenu?.submenu?.map((item) =>
        item.type === "action" ? item.label : ""
      )
    ).toEqual(["Bottom in random order"]);

    act(() => moveToHand?.onSelect());

    expect(moveCards).toHaveBeenCalledTimes(1);
    expect(moveCards).toHaveBeenCalledWith(
      [
        { cardId: "c1", toZoneId: hand.id },
        { cardId: "c2", toZoneId: hand.id },
      ],
      "me",
    );
  });

  it("submits top-X library reorders as visible-only", async () => {
    const reorderZoneCards = vi.fn();
    const library = buildZone({
      id: "library-me",
      type: ZONE.LIBRARY,
      cardIds: ["c1", "c2", "c3"],
    });
    useGameStore.setState((state) => ({
      ...state,
      reorderZoneCards,
      zones: { ...state.zones, [library.id]: library },
      players: {
        me: { id: "me", name: "Me", libraryCount: 3 } as any,
      },
      cards: {
        c1: buildCard("c1", "Card1", library.id),
        c2: buildCard("c2", "Card2", library.id),
        c3: buildCard("c3", "Card3", library.id),
      },
    }));

    render(<Harness zoneId={library.id} count={2} />);
    await waitFor(() => expect(latestController?.displayCards).toHaveLength(2));

    act(() => latestController!.commitReorder(["c3", "c2"]));

    expect(reorderZoneCards).toHaveBeenCalledWith(
      library.id,
      ["c1", "c3", "c2"],
      "me",
      undefined,
      true
    );
  });

  it("removes a moved card from the top-X library view", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const library = buildZone({
      id: "lib-me",
      type: ZONE.LIBRARY,
      ownerId: "me",
      cardIds: ["c1", "c2", "c3"],
    });

    useGameStore.setState((state) => ({
      ...state,
      zones: { [library.id]: library },
      players: {
        me: {
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
        },
      },
      cards: {
        c1: buildCard("c1", "Card1", library.id),
        c2: buildCard("c2", "Card2", library.id),
        c3: buildCard("c3", "Card3", library.id),
      },
    }));

    render(<Harness zoneId={library.id} count={2} />);

    await waitFor(() => expect(latestController).not.toBeNull());
    await waitFor(() =>
      expect(latestController?.displayCards.map((card) => card.id)).toEqual([
        "c2",
        "c3",
      ])
    );

    const controller = latestController!;
    act(() => {
      const card = useGameStore.getState().cards.c3;
      controller.handleContextMenu(
        {
          preventDefault: () => {},
          clientX: 0,
          clientY: 0,
        } as React.MouseEvent,
        card
      );
    });

    await waitFor(() => expect(latestController?.contextMenu).not.toBeNull());
    const menu = latestController!.contextMenu!;
    const moveMenu = menu.items.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Move to..."
    );
    const libraryMenu = moveMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Library ..."
    );
    const moveItem = libraryMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Bottom"
    );
    expect(moveItem && moveItem.type === "action").toBe(true);

    act(() => {
      if (moveItem && moveItem.type === "action") moveItem.onSelect();
    });

    await waitFor(() => {
      const ids = latestController?.displayCards.map((card) => card.id) ?? [];
      expect(ids).toEqual(["c2"]);
    });
  });

  it("does not refill the top-X view after moving the last frozen card", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const library = buildZone({
      id: "lib-me",
      type: ZONE.LIBRARY,
      ownerId: "me",
      cardIds: ["c1", "c2", "c3"],
    });

    useGameStore.setState((state) => ({
      ...state,
      zones: { [library.id]: library },
      players: {
        me: {
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
        },
      },
      cards: {
        c1: buildCard("c1", "Card1", library.id),
        c2: buildCard("c2", "Card2", library.id),
        c3: buildCard("c3", "Card3", library.id),
      },
    }));

    render(<Harness zoneId={library.id} count={1} />);

    await waitFor(() => expect(latestController).not.toBeNull());
    await waitFor(() =>
      expect(latestController?.displayCards.map((card) => card.id)).toEqual([
        "c3",
      ])
    );

    const controller = latestController!;
    act(() => {
      const card = useGameStore.getState().cards.c3;
      controller.handleContextMenu(
        {
          preventDefault: () => {},
          clientX: 0,
          clientY: 0,
        } as React.MouseEvent,
        card
      );
    });

    await waitFor(() => expect(latestController?.contextMenu).not.toBeNull());
    const menu = latestController!.contextMenu!;
    const moveMenu = menu.items.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Move to..."
    );
    const libraryMenu = moveMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Library ..."
    );
    const moveItem = libraryMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Bottom"
    );
    expect(moveItem && moveItem.type === "action").toBe(true);

    act(() => {
      if (moveItem && moveItem.type === "action") moveItem.onSelect();
    });

    await waitFor(() => {
      const ids = latestController?.displayCards.map((card) => card.id) ?? [];
      expect(ids).toEqual([]);
    });
  });

  it("does not refill the top-X view when closing", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const library = buildZone({
      id: "lib-me",
      type: ZONE.LIBRARY,
      ownerId: "me",
      cardIds: ["c1", "c2", "c3"],
    });

    useGameStore.setState((state) => ({
      ...state,
      zones: { [library.id]: library },
      players: {
        me: {
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
        },
      },
      cards: {
        c1: buildCard("c1", "Card1", library.id),
        c2: buildCard("c2", "Card2", library.id),
        c3: buildCard("c3", "Card3", library.id),
      },
    }));

    const { rerender } = render(<Harness zoneId={library.id} count={1} />);

    await waitFor(() => expect(latestController).not.toBeNull());
    await waitFor(() =>
      expect(latestController?.displayCards.map((card) => card.id)).toEqual([
        "c3",
      ])
    );

    const controller = latestController!;
    act(() => {
      const card = useGameStore.getState().cards.c3;
      controller.handleContextMenu(
        {
          preventDefault: () => {},
          clientX: 0,
          clientY: 0,
        } as React.MouseEvent,
        card
      );
    });

    await waitFor(() => expect(latestController?.contextMenu).not.toBeNull());
    const menu = latestController!.contextMenu!;
    const moveMenu = menu.items.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Move to..."
    );
    const libraryMenu = moveMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Library ..."
    );
    const moveItem = libraryMenu?.submenu?.find(
      (item): item is ContextMenuAction =>
        item.type === "action" && item.label === "Bottom"
    );
    expect(moveItem && moveItem.type === "action").toBe(true);

    act(() => {
      if (moveItem && moveItem.type === "action") moveItem.onSelect();
    });

    await waitFor(() => {
      const ids = latestController?.displayCards.map((card) => card.id) ?? [];
      expect(ids).toEqual([]);
    });

    rerender(<Harness zoneId={library.id} count={1} isOpen={false} />);

    await waitFor(() => {
      const ids = latestController?.displayCards.map((card) => card.id) ?? [];
      expect(ids).toEqual([]);
    });
  });

  it("waits for the full top-X order before showing cards", async () => {
    const library = buildZone({
      id: "lib-me",
      type: ZONE.LIBRARY,
      ownerId: "me",
      cardIds: ["c3"],
    });

    useGameStore.setState((state) => ({
      ...state,
      zones: { [library.id]: library },
      players: {
        me: {
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
          libraryCount: 3,
        },
      },
      cards: {
        c1: buildCard("c1", "Card1", library.id),
        c2: buildCard("c2", "Card2", library.id),
        c3: buildCard("c3", "Card3", library.id),
      },
    }));

    render(<Harness zoneId={library.id} count={3} />);

    await waitFor(() => expect(latestController).not.toBeNull());
    expect(latestController?.displayCards).toHaveLength(0);

    act(() => {
      useGameStore.setState((state) => ({
        ...state,
        zones: {
          ...state.zones,
          [library.id]: {
            ...state.zones[library.id],
            cardIds: ["c1", "c2", "c3"],
          },
        },
      }));
    });

    await waitFor(() =>
      expect(latestController?.displayCards.map((card) => card.id)).toEqual([
        "c1",
        "c2",
        "c3",
      ])
    );
  });

  it("does not freeze empty when libraryCount is zero but cards are present", async () => {
    const library = buildZone({
      id: "lib-me",
      type: ZONE.LIBRARY,
      ownerId: "me",
      cardIds: ["c1", "c2", "c3"],
    });

    useGameStore.setState((state) => ({
      ...state,
      zones: { [library.id]: library },
      players: {
        me: {
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
          libraryCount: 0,
        },
      },
      cards: {
        c1: buildCard("c1", "Card1", library.id),
        c2: buildCard("c2", "Card2", library.id),
        c3: buildCard("c3", "Card3", library.id),
      },
    }));

    render(<Harness zoneId={library.id} count={2} />);

    await waitFor(() => expect(latestController).not.toBeNull());
    await waitFor(() =>
      expect(latestController?.displayCards.map((card) => card.id)).toEqual([
        "c2",
        "c3",
      ])
    );
  });
});
