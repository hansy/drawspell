import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";

import type { Card as CardType, Player, Zone } from "@/types";
import { useGameStore } from "@/store/gameStore";
import { useDragStore } from "@/store/dragStore";
import { useSelectionStore } from "@/store/selectionStore";
import { ZONE } from "@/constants/zones";
import {
  getPreviewDimensions,
  getPreviewMinWidthPx,
  PREVIEW_MAX_WIDTH_PX,
  PREVIEW_SIDE_CHROME_WIDTH_PX,
  PREVIEW_TOP_CHROME_HEIGHT_PX,
  PREVIEW_VIEWPORT_PADDING_PX,
} from "@/hooks/game/seat/useSeatSizing";
import { Card } from "../Card";
import { CardPreview } from "../CardPreview";
import { CardPreviewProvider } from "../CardPreviewProvider";

const buildZone = (id: string, type: keyof typeof ZONE, ownerId: string, cardIds: string[] = []) =>
  ({
    id,
    type: ZONE[type],
    ownerId,
    cardIds,
  }) satisfies Zone;

const buildCard = (id: string, name: string, zoneId: string): CardType => ({
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
});

const buildPlayer = (id: string, name: string): Player => ({
  id,
  name,
  life: 20,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
});

const createPointerEvent = (
  type: string,
  options: PointerEventInit & { pointerType?: string; pointerId?: number }
) => {
  if (typeof PointerEvent !== "undefined") {
    return new PointerEvent(type, options);
  }
  const fallback = new MouseEvent(type, options);
  Object.defineProperty(fallback, "pointerType", {
    value: options.pointerType ?? "mouse",
  });
  Object.defineProperty(fallback, "pointerId", {
    value: options.pointerId ?? 1,
  });
  return fallback as unknown as PointerEvent;
};

describe("CardPreview", () => {
  beforeEach(() => {
    vi.useRealTimers();
    useGameStore.setState({
      zones: {},
      cards: {},
      players: {},
      myPlayerId: "me",
    });
    useSelectionStore.setState({ selectedCardIds: [], selectionZoneId: null });
    useDragStore.setState({
      ghostCards: null,
      activeCardId: null,
      isGroupDragging: false,
      overCardScale: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not violate hook ordering during initial positioning", async () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const anchorRect = {
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;

    const anchorEl = document.createElement("div");
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
    document.body.appendChild(anchorEl);

    render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

    expect(await screen.findByText("Test Card")).toBeTruthy();
    anchorEl.remove();
  });

  it("treats hand zones based on zone type, not zone id naming", async () => {
    const zoneId = "z123";
    const cardId = "c1";
    const zone = buildZone(zoneId, "HAND", "me", [cardId]);
    const card: CardType = { ...buildCard(cardId, "Test Card", zoneId), customText: "Hello" };

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const anchorRect = {
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;

    const anchorEl = document.createElement("div");
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
    document.body.appendChild(anchorEl);

    render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

    expect(await screen.findByText("Test Card")).toBeTruthy();
    expect(screen.queryByText("Hello")).toBeNull();
    anchorEl.remove();
  });

  it("uses seat preview width when available and clamps to viewport min/max", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    });

    try {
      const zoneId = "me-battlefield";
      const cardId = "c1";
      const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
      const card = buildCard(cardId, "Test Card", zoneId);

      useGameStore.setState((state) => ({
        ...state,
        zones: { [zoneId]: zone },
        cards: { [cardId]: card },
        players: { me: buildPlayer("me", "Me") },
        myPlayerId: "me",
      }));

      const anchorRect = {
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;

      const anchorEl = document.createElement("div");
      anchorEl.style.setProperty("--preview-w", "900px");
      vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
      document.body.appendChild(anchorEl);

      render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

      expect(await screen.findByText("Test Card")).toBeTruthy();
      const previewEl = document.querySelector(
        "[data-card-preview]",
      ) as HTMLElement | null;
      expect(previewEl).not.toBeNull();
      expect(previewEl?.style.width).toBe(`${PREVIEW_MAX_WIDTH_PX}px`);

      anchorEl.style.setProperty("--preview-w", "10px");
      act(() => {
        fireEvent(window, new Event("resize"));
      });
      expect(previewEl?.style.width).toBe(
        `${getPreviewMinWidthPx(window.innerWidth)}px`,
      );

      anchorEl.remove();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("uses shared fallback width when seat preview width is unavailable", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 370,
    });

    try {
      const zoneId = "me-battlefield";
      const cardId = "c1";
      const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
      const card = buildCard(cardId, "Test Card", zoneId);

      useGameStore.setState((state) => ({
        ...state,
        zones: { [zoneId]: zone },
        cards: { [cardId]: card },
        players: { me: buildPlayer("me", "Me") },
        myPlayerId: "me",
      }));

      const anchorRect = {
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;

      const anchorEl = document.createElement("div");
      vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
      document.body.appendChild(anchorEl);

      render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

      expect(await screen.findByText("Test Card")).toBeTruthy();
      const previewEl = document.querySelector(
        "[data-card-preview]",
      ) as HTMLElement | null;
      expect(previewEl).not.toBeNull();
      const expectedWidth = getPreviewDimensions(undefined, {
        viewportWidthPx: window.innerWidth,
      }).previewWidthPx;
      expect(previewEl?.style.width).toBe(`${expectedWidth}px`);

      anchorEl.remove();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("uses viewport-fit fallback width for portrait phone previews", async () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 369,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 619,
    });

    try {
      const zoneId = "me-battlefield";
      const cardId = "c1";
      const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
      const card = buildCard(cardId, "Test Card", zoneId);

      useGameStore.setState((state) => ({
        ...state,
        zones: { [zoneId]: zone },
        cards: { [cardId]: card },
        players: { me: buildPlayer("me", "Me") },
        myPlayerId: "me",
      }));

      const anchorRect = {
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;

      const anchorEl = document.createElement("div");
      vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
      document.body.appendChild(anchorEl);

      render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

      expect(await screen.findByText("Test Card")).toBeTruthy();
      const previewEl = document.querySelector(
        "[data-card-preview]",
      ) as HTMLElement | null;
      expect(previewEl).not.toBeNull();
      const expectedWidth = getPreviewDimensions(undefined, {
        viewportWidthPx: 369,
        viewportHeightPx: 619,
      }).previewWidthPx;
      expect(expectedWidth).toBeGreaterThanOrEqual(210);
      expect(previewEl?.style.width).toBe(`${expectedWidth}px`);

      anchorEl.remove();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("updates shared fallback width on resize when seat preview width is unavailable", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 370,
    });

    try {
      const zoneId = "me-battlefield";
      const cardId = "c1";
      const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
      const card = buildCard(cardId, "Test Card", zoneId);

      useGameStore.setState((state) => ({
        ...state,
        zones: { [zoneId]: zone },
        cards: { [cardId]: card },
        players: { me: buildPlayer("me", "Me") },
        myPlayerId: "me",
      }));

      const anchorRect = {
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;

      const anchorEl = document.createElement("div");
      vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
      document.body.appendChild(anchorEl);

      render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

      expect(await screen.findByText("Test Card")).toBeTruthy();
      const previewEl = document.querySelector(
        "[data-card-preview]",
      ) as HTMLElement | null;
      expect(previewEl).not.toBeNull();
      const initialWidth = getPreviewDimensions(undefined, {
        viewportWidthPx: 370,
      }).previewWidthPx;
      expect(previewEl?.style.width).toBe(`${initialWidth}px`);

      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: 2000,
      });
      act(() => {
        fireEvent(window, new Event("resize"));
      });
      const resizedWidth = getPreviewDimensions(undefined, {
        viewportWidthPx: 2000,
      }).previewWidthPx;
      expect(previewEl?.style.width).toBe(`${resizedWidth}px`);

      anchorEl.remove();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("shows actual PT for face-down battlefield cards when viewer can peek", async () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card: CardType = {
      ...buildCard(cardId, "Test Card", zoneId),
      faceDown: true,
      faceDownMode: "morph",
      power: "6",
      toughness: "7",
      basePower: "6",
      baseToughness: "7",
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
      viewerRole: "player",
    }));

    const anchorRect = {
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;

    const anchorEl = document.createElement("div");
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
    document.body.appendChild(anchorEl);

    render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

    expect(await screen.findByText("Test Card")).toBeTruthy();
    expect(screen.getAllByText("6").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    anchorEl.remove();
  });

  it("shows actual PT for face-down battlefield cards revealed to the viewer", async () => {
    const zoneId = "opp-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "opp", [cardId]);
    const card: CardType = {
      ...buildCard(cardId, "Test Card", zoneId),
      ownerId: "opp",
      controllerId: "opp",
      faceDown: true,
      faceDownMode: "morph",
      power: "6",
      toughness: "7",
      basePower: "6",
      baseToughness: "7",
      revealedTo: ["me"],
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me"), opp: buildPlayer("opp", "Opp") },
      myPlayerId: "me",
      viewerRole: "player",
    }));

    const anchorRect = {
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;

    const anchorEl = document.createElement("div");
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
    document.body.appendChild(anchorEl);

    render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

    expect(await screen.findByText("Test Card")).toBeTruthy();
    expect(screen.getAllByText("6").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    anchorEl.remove();
  });

  it("locks preview after a desktop click", () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Card card={card} />
        </CardPreviewProvider>
      </DndContext>
    );

    const cardElement = container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) {
      throw new Error("Expected card element to be present.");
    }

    act(() => {
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 10,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 10,
        })
      );
    });
    expect(document.querySelector("[data-card-preview]")).not.toBeNull();
  });

  it("does not lock preview when a desktop click turns into a drag", () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Card card={card} />
        </CardPreviewProvider>
      </DndContext>
    );

    const cardElement = container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) {
      throw new Error("Expected card element to be present.");
    }

    act(() => {
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 10,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointermove", {
          bubbles: true,
          button: 0,
          clientX: 30,
          clientY: 10,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: 30,
          clientY: 10,
        })
      );
    });

    expect(document.querySelector("[data-card-preview]")).toBeNull();
  });

  it("closes locked preview when clicking outside", () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Card card={card} />
        </CardPreviewProvider>
      </DndContext>
    );

    const cardElement = container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) {
      throw new Error("Expected card element to be present.");
    }

    act(() => {
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 10,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 10,
        })
      );
    });
    expect(document.querySelector("[data-card-preview]")).not.toBeNull();

    act(() => {
      fireEvent(
        document.body,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 0,
          clientY: 0,
        })
      );
    });

    expect(document.querySelector("[data-card-preview]")).toBeNull();
  });

  it("keeps locked preview chrome outside a stable card-sized floating box", async () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 369,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 619,
    });

    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = {
      ...buildCard(cardId, "Test Card", zoneId),
      power: "2",
      toughness: "2",
      basePower: "2",
      baseToughness: "2",
      typeLine: "Creature",
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const anchorRect = {
      left: 390,
      top: 500,
      right: 426,
      bottom: 560,
      width: 36,
      height: 60,
      x: 390,
      y: 500,
      toJSON: () => ({}),
    } as DOMRect;

    try {
      const anchorEl = document.createElement("div");
      vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
      document.body.appendChild(anchorEl);

      render(
        <CardPreview
          card={card}
          anchorEl={anchorEl}
          locked
          onClose={vi.fn()}
        />,
      );

      expect(await screen.findByText("Test Card")).toBeTruthy();
      const previewEl = document.querySelector(
        "[data-card-preview]",
      ) as HTMLElement | null;
      expect(previewEl).not.toBeNull();
      const expectedDimensions = getPreviewDimensions(undefined, {
        viewportWidthPx: 369,
        viewportHeightPx: 619,
      });
      expect(previewEl?.style.width).toBe(
        `${expectedDimensions.previewWidthPx}px`,
      );
      expect(previewEl?.style.height).toBe(
        `${expectedDimensions.previewHeightPx}px`,
      );
      expect(
        expectedDimensions.previewWidthPx + PREVIEW_SIDE_CHROME_WIDTH_PX,
      ).toBeLessThanOrEqual(369 - PREVIEW_VIEWPORT_PADDING_PX * 2);
      expect(
        expectedDimensions.previewHeightPx + PREVIEW_TOP_CHROME_HEIGHT_PX,
      ).toBeLessThanOrEqual(619 - PREVIEW_VIEWPORT_PADDING_PX * 2);
      expect(previewEl?.className).toContain("aspect-[2/3]");
      expect(previewEl?.className).not.toContain("flex");

      const controls = previewEl?.querySelector("[data-card-preview-controls]");
      expect(controls).not.toBeNull();
      expect(controls?.className).toContain("absolute");
      expect(controls?.className).toContain("-top-8");
      expect(controls?.className).toContain("-right-8");
      expect(controls?.className).not.toContain("right-0");
      expect(previewEl?.querySelector('button[aria-label="Close preview"]')).not.toBeNull();

      expect(previewEl?.querySelector("[data-card-preview-card]")).toBeNull();

      const ptControls = previewEl?.querySelector("[data-card-preview-pt]");
      expect(ptControls).not.toBeNull();
      expect(ptControls?.className).toContain("absolute");
      expect(ptControls?.className).toContain("left-full");
      expect(ptControls?.className).toContain("ml-2");

      anchorEl.remove();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("renders one reusable preview P/T control with responsive scaling", async () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = {
      ...buildCard(cardId, "Test Card", zoneId),
      power: "2",
      toughness: "2",
      basePower: "2",
      baseToughness: "2",
      typeLine: "Creature",
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const anchorRect = {
      left: 100,
      top: 100,
      right: 180,
      bottom: 220,
      width: 80,
      height: 120,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;

    const anchorEl = document.createElement("div");
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue(anchorRect);
    document.body.appendChild(anchorEl);

    render(
      <CardPreview
        card={card}
        anchorEl={anchorEl}
        locked
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Test Card")).toBeTruthy();
    const ptControls = document.querySelector("[data-card-preview-pt]");
    expect(ptControls).not.toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-mobile]")).toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-desktop]")).toBeNull();
    expect(ptControls?.className).toContain("[--pt-button-h:1.5rem]");
    expect(ptControls?.className).toContain("lg:[--pt-button-h:1.25rem]");
    const incrementRow = ptControls?.querySelector("[data-card-preview-pt-increments]");
    const valueRow = ptControls?.querySelector("[data-card-preview-pt-values]");
    const decrementRow = ptControls?.querySelector("[data-card-preview-pt-decrements]");
    expect(incrementRow).not.toBeNull();
    expect(valueRow).not.toBeNull();
    expect(decrementRow).not.toBeNull();
    expect(incrementRow?.querySelectorAll("button")).toHaveLength(2);
    expect(decrementRow?.querySelectorAll("button")).toHaveLength(2);
    expect(ptControls?.querySelector(".opacity-0")).toBeNull();

    const orderedRows = Array.from(ptControls?.children ?? []);
    expect(orderedRows.indexOf(incrementRow as Element)).toBeLessThan(
      orderedRows.indexOf(valueRow as Element),
    );
    expect(orderedRows.indexOf(valueRow as Element)).toBeLessThan(
      orderedRows.indexOf(decrementRow as Element),
    );

    const powerNumber = valueRow?.querySelector("[data-card-preview-stat-value]");
    expect(powerNumber?.textContent).toBe("2");

    const increasePower = ptControls?.querySelector(
      'button[aria-label="Increase power"]',
    );
    expect(increasePower).not.toBeNull();
    act(() => {
      fireEvent.click(increasePower as Element);
    });

    expect(useGameStore.getState().cards[cardId]?.power).toBe("3");
    expect(powerNumber?.textContent).toBe("3");

    anchorEl.remove();
  });

  it("hides preview P/T controls for creatures in the commander zone", async () => {
    const zoneId = "me-commander";
    const cardId = "c1";
    const zone = buildZone(zoneId, "COMMANDER", "me", [cardId]);
    const card = {
      ...buildCard(cardId, "Commander Card", zoneId),
      power: "2",
      toughness: "2",
      basePower: "2",
      baseToughness: "2",
      typeLine: "Legendary Creature",
      isCommander: true,
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const anchorEl = document.createElement("div");
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      right: 180,
      bottom: 220,
      width: 80,
      height: 120,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    document.body.appendChild(anchorEl);

    render(
      <CardPreview
        card={card}
        anchorEl={anchorEl}
        locked
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Commander Card")).toBeTruthy();
    expect(document.querySelector("[data-card-preview-pt]")).toBeNull();

    anchorEl.remove();
  });

  it("hides preview P/T edit buttons until the battlefield preview is locked", async () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = {
      ...buildCard(cardId, "Test Card", zoneId),
      power: "2",
      toughness: "2",
      basePower: "2",
      baseToughness: "2",
      typeLine: "Creature",
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const anchorEl = document.createElement("div");
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      right: 180,
      bottom: 220,
      width: 80,
      height: 120,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    document.body.appendChild(anchorEl);

    render(<CardPreview card={card} anchorEl={anchorEl} locked={false} />);

    expect(await screen.findByText("Test Card")).toBeTruthy();
    const ptControls = document.querySelector("[data-card-preview-pt]");
    expect(ptControls).not.toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-values]")).not.toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-increments]")).toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-decrements]")).toBeNull();
    expect(
      ptControls?.querySelector('button[aria-label="Increase power"]'),
    ).toBeNull();

    anchorEl.remove();
  });

  it("uses the same preview P/T control structure for desktop and mobile", async () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = {
      ...buildCard(cardId, "Test Card", zoneId),
      power: "2",
      toughness: "2",
      basePower: "2",
      baseToughness: "2",
      typeLine: "Creature",
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
    }));

    const anchorEl = document.createElement("div");
    vi.spyOn(anchorEl, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      right: 180,
      bottom: 220,
      width: 80,
      height: 120,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    document.body.appendChild(anchorEl);

    render(
      <CardPreview
        card={card}
        anchorEl={anchorEl}
        locked
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Test Card")).toBeTruthy();
    const ptControls = document.querySelector("[data-card-preview-pt]");
    expect(ptControls).not.toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-mobile]")).toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-desktop]")).toBeNull();
    expect(ptControls?.querySelectorAll("[data-card-preview-stat-value]")).toHaveLength(2);
    expect(ptControls?.querySelector("[data-card-preview-pt-increments]")).not.toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-values]")).not.toBeNull();
    expect(ptControls?.querySelector("[data-card-preview-pt-decrements]")).not.toBeNull();

    anchorEl.remove();
  });

  it("shows a preview on touch tap", () => {
    vi.useFakeTimers();

    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
      viewerRole: "player",
    }));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Card card={card} />
        </CardPreviewProvider>
      </DndContext>
    );
    const cardElement = container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) {
      throw new Error("Expected card element to be present.");
    }

    act(() => {
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 30,
          clientY: 40,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 30,
          clientY: 40,
        })
      );
    });

    expect(document.querySelector("[data-card-preview]")).not.toBeNull();
  });

  it("does not show a preview when a touch gesture turns into a drag", () => {
    vi.useFakeTimers();

    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
      viewerRole: "player",
    }));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Card card={card} />
        </CardPreviewProvider>
      </DndContext>
    );
    const cardElement = container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) {
      throw new Error("Expected card element to be present.");
    }

    act(() => {
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 30,
          clientY: 40,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointermove", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 48,
          clientY: 40,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 48,
          clientY: 40,
        })
      );
    });

    expect(document.querySelector("[data-card-preview]")).toBeNull();
  });

  it("closes a touch-opened preview when dragging starts", () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
      viewerRole: "player",
    }));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Card card={card} />
        </CardPreviewProvider>
      </DndContext>
    );
    const cardElement = container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) {
      throw new Error("Expected card element to be present.");
    }

    act(() => {
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 30,
          clientY: 40,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 30,
          clientY: 40,
        })
      );
    });
    expect(document.querySelector("[data-card-preview]")).not.toBeNull();

    act(() => {
      useDragStore.setState({ activeCardId: cardId });
    });

    expect(document.querySelector("[data-card-preview]")).toBeNull();
  });

  it("opens card context menu on single touch hold", () => {
    vi.useFakeTimers();

    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);
    const onContextMenu = vi.fn();

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
      viewerRole: "player",
    }));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Card card={card} onContextMenu={onContextMenu} />
        </CardPreviewProvider>
      </DndContext>
    );
    const cardElement = container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) {
      throw new Error("Expected card element to be present.");
    }

    act(() => {
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      vi.advanceTimersByTime(500);
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
    });

    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-card-preview]")).toBeNull();
  });

  it("does not map touch double tap to card tap/untap", () => {
    const zoneId = "me-battlefield";
    const cardId = "c1";
    const zone = buildZone(zoneId, "BATTLEFIELD", "me", [cardId]);
    const card = buildCard(cardId, "Test Card", zoneId);
    const originalTapCard = useGameStore.getState().tapCard;
    const tapCard = vi.fn();

    useGameStore.setState((state) => ({
      ...state,
      zones: { [zoneId]: zone },
      cards: { [cardId]: card },
      players: { me: buildPlayer("me", "Me") },
      myPlayerId: "me",
      viewerRole: "player",
      tapCard: tapCard as any,
    }));

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Card card={card} />
        </CardPreviewProvider>
      </DndContext>
    );
    const cardElement = container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardElement) {
      throw new Error("Expected card element to be present.");
    }

    act(() => {
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 10,
          clientY: 10,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 10,
          clientY: 10,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 10,
          clientY: 10,
        })
      );
      fireEvent(
        cardElement,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 10,
          clientY: 10,
        })
      );
    });

    expect(tapCard).not.toHaveBeenCalled();
    act(() => {
      useGameStore.setState({ tapCard: originalTapCard } as any);
    });
  });
});
