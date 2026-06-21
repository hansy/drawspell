import { describe, expect, it } from "vitest";

import type { Card, Zone } from "@/types";
import { ZONE } from "@/constants/zones";
import {
  fromNormalizedPosition,
  getCanonicalBattlefieldPlacementGridSteps,
  mirrorNormalizedY,
  toNormalizedPosition,
} from "@/lib/positions";
import {
  computeBattlefieldGroupGhostCards,
  computeDragEndPlan,
  computeDragMoveUiState,
} from "../model";

type Point = { x: number; y: number };

const measuredCardSizing = {
  baseCardHeight: 135,
  baseCardWidth: 90,
};

const rect = (params: {
  left: number;
  top: number;
  width: number;
  height: number;
}) => ({
  left: params.left,
  top: params.top,
  width: params.width,
  height: params.height,
  right: params.left + params.width,
  bottom: params.top + params.height,
});

const createCard = (id: string, overrides: Partial<Card> = {}): Card => ({
  id,
  name: id,
  ownerId: "p1",
  controllerId: "p1",
  zoneId: "p1-battlefield",
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
  ...overrides,
});

const createBattlefield = (ownerId = "p1"): Zone => ({
  id: `${ownerId}-battlefield`,
  type: ZONE.BATTLEFIELD,
  ownerId,
  cardIds: ["c1"],
});

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const liveDraggedCenter = (params: {
  pointerScreen: Point;
  dragAnchor: Point;
  cardSize: { width: number; height: number };
  zoneScale?: number;
}) => {
  const zoneScale = params.zoneScale ?? 1;
  return {
    x:
      params.pointerScreen.x +
      (0.5 - params.dragAnchor.x) * params.cardSize.width * zoneScale,
    y:
      params.pointerScreen.y +
      (0.5 - params.dragAnchor.y) * params.cardSize.height * zoneScale,
  };
};

const placementGridPixels = (viewScale = 1) => {
  const zoneWidth = 1000;
  const zoneHeight = 600;
  const steps = getCanonicalBattlefieldPlacementGridSteps({
    zoneWidth,
    zoneHeight,
    viewScale,
    ...measuredCardSizing,
  });
  return {
    x: steps.stepX * zoneWidth,
    y: steps.stepY * zoneHeight,
  };
};

const gridAlignedCenter = (params: {
  grid: Point;
  cardSize: { width: number; height: number };
  xIndex: number;
  yIndex: number;
}) => ({
  x: params.grid.x * params.xIndex + params.cardSize.width / 2,
  y: params.grid.y * params.yIndex + params.cardSize.height / 2,
});

describe("game DnD movement contracts", () => {
  it("does not produce a battlefield preview when the drop is not valid", () => {
    const zones: Record<string, Zone> = {
      "p2-battlefield": createBattlefield("p2"),
      "p1-battlefield": createBattlefield("p1"),
    };
    const cards = {
      c1: createCard("c1", {
        ownerId: "p2",
        controllerId: "p2",
        zoneId: "p2-battlefield",
      }),
    };

    const state = computeDragMoveUiState({
      myPlayerId: "p1",
      cards,
      zones,
      activeCardId: "c1",
      activeRect: rect({ left: 455, top: 255, width: 90, height: 135 }),
      pointerScreen: { x: 500, y: 300 },
      dragAnchor: { x: 0.5, y: 0.5 },
      over: {
        id: "p1-battlefield",
        type: ZONE.BATTLEFIELD,
        rect: rect({ left: 0, top: 0, width: 1000, height: 600 }),
        scale: 1,
        cardScale: 1,
        mirrorY: false,
      },
    });

    expect(state).toEqual({ ghostCard: null, overCardScale: 1 });
  });

  it("keeps a stationary grid-aligned tapped-card preview on the dragged card center", () => {
    const zones: Record<string, Zone> = {
      "p1-battlefield": createBattlefield("p1"),
    };
    const cards = {
      c1: createCard("c1", { tapped: true }),
    };
    const grid = placementGridPixels();
    const expectedCardSize = {
      width: measuredCardSizing.baseCardHeight,
      height: measuredCardSizing.baseCardWidth,
    };
    const pointerScreen = gridAlignedCenter({
      grid,
      cardSize: expectedCardSize,
      xIndex: 9,
      yIndex: 7,
    });
    const dragAnchor = { x: 0.5, y: 0.5 };

    const state = computeDragMoveUiState({
      myPlayerId: "p1",
      cards,
      zones,
      activeCardId: "c1",
      activeRect: rect({ left: 432.5, top: 255, width: 135, height: 90 }),
      pointerScreen,
      dragAnchor,
      activeTapped: true,
      over: {
        id: "p1-battlefield",
        type: ZONE.BATTLEFIELD,
        rect: rect({ left: 0, top: 0, width: 1000, height: 600 }),
        scale: 1,
        cardScale: 1,
        cardBaseHeight: measuredCardSizing.baseCardHeight,
        cardBaseWidth: measuredCardSizing.baseCardWidth,
        mirrorY: false,
      },
    });

    expect(state.ghostCard).not.toBeNull();
    const liveCenter = liveDraggedCenter({
      pointerScreen,
      dragAnchor,
      cardSize: state.ghostCard?.size ?? { width: 0, height: 0 },
    });

    expect(distance(state.ghostCard!.position, liveCenter)).toBeLessThanOrEqual(2);
  });

  it("keeps tapped preview dimensions tied to zoomed battlefield card dimensions", () => {
    const zones: Record<string, Zone> = {
      "p1-battlefield": createBattlefield("p1"),
    };
    const cards = {
      c1: createCard("c1", { tapped: true }),
    };

    const state = computeDragMoveUiState({
      myPlayerId: "p1",
      cards,
      zones,
      activeCardId: "c1",
      activeRect: rect({ left: 439.25, top: 259.5, width: 121.5, height: 81 }),
      pointerScreen: { x: 500, y: 300 },
      dragAnchor: { x: 0.5, y: 0.5 },
      activeTapped: true,
      over: {
        id: "p1-battlefield",
        type: ZONE.BATTLEFIELD,
        rect: rect({ left: 0, top: 0, width: 1000, height: 600 }),
        scale: 1,
        cardScale: 0.9,
        cardBaseHeight: measuredCardSizing.baseCardHeight,
        cardBaseWidth: measuredCardSizing.baseCardWidth,
        mirrorY: false,
      },
    });

    expect(state.ghostCard?.size).toEqual({ width: 121.5, height: 81 });
    expect(state.ghostCard!.size!.width).toBeGreaterThan(state.ghostCard!.size!.height);
  });

  it("plans the snapped final battlefield position while the ghost remains cursor anchored", () => {
    const zones: Record<string, Zone> = {
      "p1-battlefield": createBattlefield("p1"),
    };
    const cards = {
      c1: createCard("c1", { tapped: true }),
    };
    const pointerScreen = { x: 500, y: 300 };
    const dragAnchor = { x: 0.5, y: 0.5 };
    const overRect = rect({ left: 0, top: 0, width: 1000, height: 600 });
    const activeRect = rect({ left: 432.5, top: 255, width: 135, height: 90 });

    const preview = computeDragMoveUiState({
      myPlayerId: "p1",
      cards,
      zones,
      activeCardId: "c1",
      activeRect,
      pointerScreen,
      dragAnchor,
      activeTapped: true,
      over: {
        id: "p1-battlefield",
        type: ZONE.BATTLEFIELD,
        rect: overRect,
        scale: 1,
        cardScale: 1,
        cardBaseHeight: measuredCardSizing.baseCardHeight,
        cardBaseWidth: measuredCardSizing.baseCardWidth,
        mirrorY: false,
      },
    });
    const plan = computeDragEndPlan({
      myPlayerId: "p1",
      cards,
      zones,
      cardId: "c1",
      toZoneId: "p1-battlefield",
      activeRect,
      pointerScreen,
      dragAnchor,
      overRect,
      overScale: 1,
      overCardScale: 1,
      overCardBaseHeight: measuredCardSizing.baseCardHeight,
      overCardBaseWidth: measuredCardSizing.baseCardWidth,
      mirrorY: false,
      activeTapped: true,
    });

    expect(plan.kind).toBe("moveCard");
    if (plan.kind !== "moveCard") return;
    expect(plan.position).toBeDefined();
    expect(preview.debug).toBeDefined();

    const plannedCenter = fromNormalizedPosition(
      plan.position!,
      overRect.width,
      overRect.height
    );

    expect(distance(plannedCenter, preview.debug!.placement.snappedPosition)).toBeLessThanOrEqual(1);
    expect(distance(preview.ghostCard!.position, preview.debug!.placement.livePosition)).toBeLessThanOrEqual(1);
  });

  it("uses the last rendered snapped drop position when drag-end geometry has moved farther", () => {
    const zones: Record<string, Zone> = {
      "p1-battlefield": createBattlefield("p1"),
    };
    const cards = {
      c1: createCard("c1", { tapped: true }),
    };
    const releasePreviewPosition = { x: 0.42, y: 0.61 };

    const plan = computeDragEndPlan({
      myPlayerId: "p1",
      cards,
      zones,
      cardId: "c1",
      toZoneId: "p1-battlefield",
      activeRect: rect({ left: 700, top: 400, width: 135, height: 90 }),
      pointerScreen: { x: 765, y: 445 },
      movementScreen: { x: 200, y: 0 },
      dragAnchor: { x: 0.5, y: 0.5 },
      overRect: rect({ left: 0, top: 0, width: 1000, height: 600 }),
      overScale: 1,
      overCardScale: 1,
      overCardBaseHeight: measuredCardSizing.baseCardHeight,
      overCardBaseWidth: measuredCardSizing.baseCardWidth,
      releasePreviewPosition,
      mirrorY: false,
      activeTapped: true,
    });

    expect(plan).toEqual({
      kind: "moveCard",
      cardId: "c1",
      toZoneId: "p1-battlefield",
      position: releasePreviewPosition,
    });
  });

  it("preserves selected group offsets and per-card dimensions in ghost geometry", () => {
    const zoneWidth = 1000;
    const zoneHeight = 600;
    const startPositions = {
      c1: { x: 0.4, y: 0.4 },
      c2: { x: 0.52, y: 0.46 },
    };
    const activeTarget = { x: 0.55, y: 0.5 };
    const ghostCards = computeBattlefieldGroupGhostCards({
      groupCardIds: ["c1", "c2"],
      activeCardId: "c1",
      startPositions,
      cards: {
        c1: createCard("c1", { tapped: true }),
        c2: createCard("c2", { tapped: false }),
      },
      targetZoneId: "p1-battlefield",
      activeGhostPosition: fromNormalizedPosition(activeTarget, zoneWidth, zoneHeight),
      zoneWidth,
      zoneHeight,
      mirrorY: false,
      viewScale: 0.9,
      ...measuredCardSizing,
    });
    const byId = Object.fromEntries(
      ghostCards.map((ghost) => [
        ghost.cardId,
        {
          ...ghost,
          canonical: toNormalizedPosition(ghost.position, zoneWidth, zoneHeight),
        },
      ])
    );

    expect(ghostCards).toHaveLength(2);
    expect(byId.c1.canonical).toEqual(activeTarget);
    expect(byId.c2.canonical.x - byId.c1.canonical.x).toBeCloseTo(0.12, 6);
    expect(byId.c2.canonical.y - byId.c1.canonical.y).toBeCloseTo(0.06, 6);
    expect(byId.c1.size).toEqual({ width: 121.5, height: 81 });
    expect(byId.c2.size).toEqual({ width: 81, height: 121.5 });
  });

  it("preserves selected group offsets on a mirrored battlefield", () => {
    const zoneWidth = 1000;
    const zoneHeight = 600;
    const startPositions = {
      c1: { x: 0.4, y: 0.4 },
      c2: { x: 0.52, y: 0.46 },
    };
    const activeTargetCanonical = { x: 0.55, y: 0.5 };
    const activeTargetView = mirrorNormalizedY(activeTargetCanonical);
    const ghostCards = computeBattlefieldGroupGhostCards({
      groupCardIds: ["c1", "c2"],
      activeCardId: "c1",
      startPositions,
      cards: {
        c1: createCard("c1", { tapped: true }),
        c2: createCard("c2", { tapped: false }),
      },
      targetZoneId: "p2-battlefield",
      activeGhostPosition: fromNormalizedPosition(activeTargetView, zoneWidth, zoneHeight),
      zoneWidth,
      zoneHeight,
      mirrorY: true,
      viewScale: 1,
      ...measuredCardSizing,
    });
    const canonicalById = Object.fromEntries(
      ghostCards.map((ghost) => [
        ghost.cardId,
        mirrorNormalizedY(toNormalizedPosition(ghost.position, zoneWidth, zoneHeight)),
      ])
    );

    expect(ghostCards).toHaveLength(2);
    expect(canonicalById.c1).toEqual(activeTargetCanonical);
    expect(canonicalById.c2.x - canonicalById.c1.x).toBeCloseTo(0.12, 6);
    expect(canonicalById.c2.y - canonicalById.c1.y).toBeCloseTo(0.06, 6);
    expect(ghostCards.find((ghost) => ghost.cardId === "c1")?.position.y).toBeCloseTo(
      zoneHeight * (1 - activeTargetCanonical.y),
      6
    );
  });

  it("plans mirrored battlefield drops in canonical coordinates", () => {
    const zones: Record<string, Zone> = {
      "p1-battlefield": createBattlefield("p1"),
    };
    const cards = {
      c1: createCard("c1", { tapped: true }),
    };
    const pointerScreen = { x: 500, y: 240 };
    const overRect = rect({ left: 0, top: 0, width: 1000, height: 600 });
    const plan = computeDragEndPlan({
      myPlayerId: "p1",
      cards,
      zones,
      cardId: "c1",
      toZoneId: "p1-battlefield",
      activeRect: rect({ left: 432.5, top: 195, width: 135, height: 90 }),
      pointerScreen,
      movementScreen: { x: 120, y: 0 },
      dragAnchor: { x: 0.5, y: 0.5 },
      overRect,
      overScale: 1,
      overCardScale: 1,
      overCardBaseHeight: measuredCardSizing.baseCardHeight,
      overCardBaseWidth: measuredCardSizing.baseCardWidth,
      mirrorY: true,
      activeTapped: true,
    });

    expect(plan.kind).toBe("moveCard");
    if (plan.kind !== "moveCard") return;
    expect(plan.position).toBeDefined();

    const viewPosition = mirrorNormalizedY(plan.position!);
    const plannedCenter = fromNormalizedPosition(viewPosition, overRect.width, overRect.height);

    expect(plannedCenter.y).toBeLessThan(overRect.height / 2);
    expect(plan.position!.y).toBeGreaterThan(0.5);
  });
});
