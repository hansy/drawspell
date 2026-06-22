import { describe, expect, it } from "vitest";

import { getCanonicalBattlefieldPlacementGridSteps } from "@/lib/positions";
import {
  computeAnchoredDragRect,
  computeAnchoredResizeOffset,
  computeDragOverlayBaseScale,
  computeBattlefieldPlacement,
  getEffectiveCardSize,
} from "../dndBattlefield";

const zoneRect = {
  left: 0,
  top: 0,
  right: 1000,
  bottom: 600,
  width: 1000,
  height: 600,
};

const measuredCardSizing = {
  baseCardHeight: 135,
  baseCardWidth: 90,
};
const EXPECTED_GHOST_LEAD_PX = 24;

type Point = { x: number; y: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;

const liveDraggedCenter = (params: {
  pointerScreen: Point;
  dragAnchor: Point;
  cardSize: { cardWidth: number; cardHeight: number };
  zoneScale?: number;
}) => {
  const zoneScale = params.zoneScale ?? 1;
  return {
    x:
      params.pointerScreen.x +
      (0.5 - params.dragAnchor.x) * params.cardSize.cardWidth * zoneScale,
    y:
      params.pointerScreen.y +
      (0.5 - params.dragAnchor.y) * params.cardSize.cardHeight * zoneScale,
  };
};

const placementGridPixels = (viewScale = 1) => {
  const steps = getCanonicalBattlefieldPlacementGridSteps({
    zoneWidth: zoneRect.width,
    zoneHeight: zoneRect.height,
    viewScale,
    ...measuredCardSizing,
  });
  return {
    x: steps.stepX * zoneRect.width,
    y: steps.stepY * zoneRect.height,
  };
};

const gridAlignedCenter = (params: {
  grid: Point;
  cardSize: { cardWidth: number; cardHeight: number };
  xIndex: number;
  yIndex: number;
}) => ({
  x: params.grid.x * params.xIndex + params.cardSize.cardWidth / 2,
  y: params.grid.y * params.yIndex + params.cardSize.cardHeight / 2,
});

const expectEdgesAlignedToGrid = (params: {
  placement: ReturnType<typeof computeBattlefieldPlacement>;
  viewScale: number;
}) => {
  const grid = getCanonicalBattlefieldPlacementGridSteps({
    zoneWidth: zoneRect.width,
    zoneHeight: zoneRect.height,
    viewScale: params.viewScale,
    ...measuredCardSizing,
  });
  const stepX = grid.stepX * zoneRect.width;
  const stepY = grid.stepY * zoneRect.height;
  const left = params.placement.snappedPosition.x - params.placement.cardWidth / 2;
  const right = params.placement.snappedPosition.x + params.placement.cardWidth / 2;
  const top = params.placement.snappedPosition.y - params.placement.cardHeight / 2;
  const bottom = params.placement.snappedPosition.y + params.placement.cardHeight / 2;

  expect(left / stepX).toBeCloseTo(Math.round(left / stepX), 6);
  expect(right / stepX).toBeCloseTo(Math.round(right / stepX), 6);
  expect(top / stepY).toBeCloseTo(Math.round(top / stepY), 6);
  expect(bottom / stepY).toBeCloseTo(Math.round(bottom / stepY), 6);
};

describe("battlefield placement contracts", () => {
  it("keeps the grabbed hand-card point under the cursor when the drag card resizes", () => {
    const pointerScreen = { x: 649.59375, y: 700 };
    const dragAnchor = {
      x: 0.1625434027777778,
      y: 0.6990740740740741,
    };

    const targetRect = computeAnchoredDragRect({
      pointerScreen,
      dragAnchor,
      width: 90,
      height: 135,
      scale: 1,
    });

    expect(targetRect.width).toBe(90);
    expect(targetRect.height).toBe(135);
    expect(targetRect.left).toBeCloseTo(634.96484375, 6);
    expect(targetRect.top).toBeCloseTo(605.625, 6);
    expect(targetRect.left + targetRect.width * dragAnchor.x).toBeCloseTo(
      pointerScreen.x,
      6
    );
    expect(targetRect.top + targetRect.height * dragAnchor.y).toBeCloseTo(
      pointerScreen.y,
      6
    );
    expect(targetRect.centerX).toBeCloseTo(679.96484375, 6);
    expect(targetRect.centerY).toBeCloseTo(673.125, 6);
  });

  it("computes the resize offset needed to preserve the source grab point", () => {
    const dragAnchor = {
      x: 0.1625434027777778,
      y: 0.6990740740740741,
    };

    const offset = computeAnchoredResizeOffset({
      dragAnchor,
      sourceWidth: 144,
      sourceHeight: 216,
      targetWidth: 90,
      targetHeight: 135,
    });

    expect(offset.x).toBeCloseTo(8.77734375, 6);
    expect(offset.y).toBeCloseTo(56.625, 6);
  });

  it("includes visual-source overhang when the draggable source rect is narrower than the card", () => {
    const dragAnchor = {
      x: 0.1625434027777778,
      y: 0.6990740740740741,
    };

    const offset = computeAnchoredResizeOffset({
      dragAnchor,
      sourceWidth: 144,
      sourceHeight: 216,
      sourceOffsetX: -27,
      sourceOffsetY: 0,
      targetWidth: 90,
      targetHeight: 135,
    });

    expect(offset.x).toBeCloseTo(-18.22265625, 6);
    expect(offset.y).toBeCloseTo(56.625, 6);
  });

  it("derives battlefield overlay scale before first render from source size", () => {
    const overlayBaseScale = computeDragOverlayBaseScale({
      sourceWidth: 90,
      sourceHeight: 135,
      sourceScale: 1,
      baseCardWidth: 80,
      baseCardHeight: 120,
      isTapped: false,
    });

    expect(overlayBaseScale).toBeCloseTo(1.125, 6);
  });

  it("normalizes hand source scale before deriving battlefield overlay scale", () => {
    const overlayBaseScale = computeDragOverlayBaseScale({
      sourceWidth: 144,
      sourceHeight: 216,
      sourceScale: 1.6,
      baseCardWidth: 80,
      baseCardHeight: 120,
      isTapped: false,
    });

    expect(overlayBaseScale).toBeCloseTo(1.125, 6);
  });

  it("derives tapped overlay scale from landscape source dimensions", () => {
    const overlayBaseScale = computeDragOverlayBaseScale({
      sourceWidth: 135,
      sourceHeight: 90,
      sourceScale: 1,
      baseCardWidth: 80,
      baseCardHeight: 120,
      isTapped: true,
    });

    expect(overlayBaseScale).toBeCloseTo(1.125, 6);
  });

  it("keeps a stationary grid-aligned drop preview on the dragged card center", () => {
    const grid = placementGridPixels();
    const dragAnchor = { x: 0.5, y: 0.5 };
    const cardSize = getEffectiveCardSize({
      viewScale: 1,
      isTapped: true,
      ...measuredCardSizing,
    });
    const pointerScreen = gridAlignedCenter({
      grid,
      cardSize,
      xIndex: 9,
      yIndex: 7,
    });

    const placement = computeBattlefieldPlacement({
      pointerScreen,
      dragAnchor,
      overRect: zoneRect,
      zoneScale: 1,
      viewScale: 1,
      mirrorY: false,
      isTapped: true,
      ...measuredCardSizing,
    });

    const liveCenter = liveDraggedCenter({
      pointerScreen,
      dragAnchor,
      cardSize,
    });

    expect(distance(placement.ghostPosition, liveCenter)).toBeLessThanOrEqual(2);
  });

  it("keeps a moving drop preview about 24px ahead when approaching the next grid step", () => {
    const grid = placementGridPixels();
    const dragAnchor = { x: 0.5, y: 0.5 };
    const movementUnit = { x: 1, y: 0 };
    const cardSize = getEffectiveCardSize({
      viewScale: 1,
      isTapped: true,
      ...measuredCardSizing,
    });
    const nextGridCenter = gridAlignedCenter({
      grid,
      cardSize,
      xIndex: 10,
      yIndex: 7,
    });
    const pointerScreen = { x: nextGridCenter.x - 10, y: nextGridCenter.y };

    const placement = computeBattlefieldPlacement({
      pointerScreen,
      dragAnchor,
      movementScreen: { x: 120, y: 0 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale: 1,
      mirrorY: false,
      isTapped: true,
      ...measuredCardSizing,
    });

    const liveCenter = liveDraggedCenter({
      pointerScreen,
      dragAnchor,
      cardSize,
    });
    const leadVector = {
      x: placement.ghostPosition.x - liveCenter.x,
      y: placement.ghostPosition.y - liveCenter.y,
    };

    expect(dot(leadVector, movementUnit)).toBeGreaterThanOrEqual(
      EXPECTED_GHOST_LEAD_PX - 2
    );
    expect(dot(leadVector, movementUnit)).toBeLessThanOrEqual(
      EXPECTED_GHOST_LEAD_PX + 2
    );
    expect(Math.abs(cross(leadVector, movementUnit))).toBeLessThanOrEqual(2);
    expect(distance(placement.ghostPosition, liveCenter)).toBeLessThanOrEqual(
      EXPECTED_GHOST_LEAD_PX + 2
    );
  });

  it("does not let the dragged card lead the ghost while moving across a coarse grid", () => {
    const grid = placementGridPixels();
    const dragAnchor = { x: 0.5, y: 0.5 };
    const movementUnit = { x: 1, y: 0 };
    const cardSize = getEffectiveCardSize({
      viewScale: 1,
      isTapped: true,
      ...measuredCardSizing,
    });
    const justPastGridCenter = gridAlignedCenter({
      grid,
      cardSize,
      xIndex: 10,
      yIndex: 7,
    });
    const pointerScreen = {
      x: justPastGridCenter.x + 4,
      y: justPastGridCenter.y,
    };

    const placement = computeBattlefieldPlacement({
      pointerScreen,
      dragAnchor,
      movementScreen: { x: 120, y: 0 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale: 1,
      mirrorY: false,
      isTapped: true,
      ...measuredCardSizing,
    });

    const liveCenter = liveDraggedCenter({
      pointerScreen,
      dragAnchor,
      cardSize,
    });
    const leadVector = {
      x: placement.ghostPosition.x - liveCenter.x,
      y: placement.ghostPosition.y - liveCenter.y,
    };

    expect(dot(leadVector, movementUnit)).toBeGreaterThanOrEqual(
      EXPECTED_GHOST_LEAD_PX - 2
    );
    expect(dot(leadVector, movementUnit)).toBeLessThanOrEqual(
      EXPECTED_GHOST_LEAD_PX + 2
    );
    expect(Math.abs(cross(leadVector, movementUnit))).toBeLessThanOrEqual(2);
    expect(distance(placement.ghostPosition, liveCenter)).toBeLessThanOrEqual(
      EXPECTED_GHOST_LEAD_PX + 2
    );
  });

  it("uses tapped card dimensions for the final placed preview", () => {
    const placement = computeBattlefieldPlacement({
      pointerScreen: { x: 500, y: 300 },
      dragAnchor: { x: 0.5, y: 0.5 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale: 0.9,
      mirrorY: false,
      isTapped: true,
      ...measuredCardSizing,
    });

    expect(placement.cardWidth).toBeCloseTo(121.5);
    expect(placement.cardHeight).toBeCloseTo(81);
    expect(placement.cardWidth).toBeGreaterThan(placement.cardHeight);
  });

  it("snaps final untapped drop card edges to the visible placement grid", () => {
    const placement = computeBattlefieldPlacement({
      pointerScreen: { x: 503, y: 297 },
      dragAnchor: { x: 0.5, y: 0.5 },
      movementScreen: { x: 90, y: 0 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale: 1,
      mirrorY: false,
      isTapped: false,
      ...measuredCardSizing,
    });
    const grid = getCanonicalBattlefieldPlacementGridSteps({
      zoneWidth: zoneRect.width,
      zoneHeight: zoneRect.height,
      viewScale: 1,
      ...measuredCardSizing,
    });
    const stepX = grid.stepX * zoneRect.width;
    const stepY = grid.stepY * zoneRect.height;
    const left = placement.snappedPosition.x - placement.cardWidth / 2;
    const right = placement.snappedPosition.x + placement.cardWidth / 2;
    const top = placement.snappedPosition.y - placement.cardHeight / 2;
    const bottom = placement.snappedPosition.y + placement.cardHeight / 2;

    expect(left / stepX).toBeCloseTo(
      Math.round(left / stepX),
      6
    );
    expect(right / stepX).toBeCloseTo(
      Math.round(right / stepX),
      6
    );
    expect(top / stepY).toBeCloseTo(
      Math.round(top / stepY),
      6
    );
    expect(bottom / stepY).toBeCloseTo(
      Math.round(bottom / stepY),
      6
    );
  });

  it("snaps final tapped drop card edges to the visible placement grid", () => {
    const viewScale = 0.9;
    const placement = computeBattlefieldPlacement({
      pointerScreen: { x: 503, y: 297 },
      dragAnchor: { x: 0.5, y: 0.5 },
      movementScreen: { x: 90, y: 0 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale,
      mirrorY: false,
      isTapped: true,
      ...measuredCardSizing,
    });
    const grid = getCanonicalBattlefieldPlacementGridSteps({
      zoneWidth: zoneRect.width,
      zoneHeight: zoneRect.height,
      viewScale,
      ...measuredCardSizing,
    });
    const stepX = grid.stepX * zoneRect.width;
    const stepY = grid.stepY * zoneRect.height;
    const left = placement.snappedPosition.x - placement.cardWidth / 2;
    const right = placement.snappedPosition.x + placement.cardWidth / 2;
    const top = placement.snappedPosition.y - placement.cardHeight / 2;
    const bottom = placement.snappedPosition.y + placement.cardHeight / 2;

    expect(placement.cardWidth).toBeCloseTo(stepX * 3);
    expect(placement.cardHeight).toBeCloseTo(stepY * 2);
    expect(left / stepX).toBeCloseTo(
      Math.round(left / stepX),
      6
    );
    expect(right / stepX).toBeCloseTo(
      Math.round(right / stepX),
      6
    );
    expect(top / stepY).toBeCloseTo(
      Math.round(top / stepY),
      6
    );
    expect(bottom / stepY).toBeCloseTo(
      Math.round(bottom / stepY),
      6
    );
  });

  it.each([
    { viewScale: 1, isTapped: false, expectedCellsX: 2, expectedCellsY: 3 },
    { viewScale: 1, isTapped: true, expectedCellsX: 3, expectedCellsY: 2 },
    { viewScale: 0.9, isTapped: false, expectedCellsX: 2, expectedCellsY: 3 },
    { viewScale: 0.9, isTapped: true, expectedCellsX: 3, expectedCellsY: 2 },
    { viewScale: 0.75, isTapped: false, expectedCellsX: 2, expectedCellsY: 3 },
    { viewScale: 0.75, isTapped: true, expectedCellsX: 3, expectedCellsY: 2 },
    { viewScale: 0.5, isTapped: false, expectedCellsX: 2, expectedCellsY: 3 },
    { viewScale: 0.5, isTapped: true, expectedCellsX: 3, expectedCellsY: 2 },
  ])(
    "keeps $isTapped tapped=$isTapped card edges aligned to the zoomed grid at viewScale=$viewScale",
    ({ viewScale, isTapped, expectedCellsX, expectedCellsY }) => {
      const placement = computeBattlefieldPlacement({
        pointerScreen: { x: 503, y: 297 },
        dragAnchor: { x: 0.5, y: 0.5 },
        movementScreen: { x: 90, y: 0 },
        overRect: zoneRect,
        zoneScale: 1,
        viewScale,
        mirrorY: false,
        isTapped,
        ...measuredCardSizing,
      });
      const grid = placementGridPixels(viewScale);

      expect(placement.cardWidth).toBeCloseTo(grid.x * expectedCellsX);
      expect(placement.cardHeight).toBeCloseTo(grid.y * expectedCellsY);
      expectEdgesAlignedToGrid({ placement, viewScale });
    }
  );

  it("keeps mirrored battlefield ghost geometry in view coordinates while storing canonical Y", () => {
    const viewScale = 0.9;
    const placement = computeBattlefieldPlacement({
      pointerScreen: { x: 503, y: 297 },
      dragAnchor: { x: 0.5, y: 0.5 },
      movementScreen: { x: 90, y: 0 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale,
      mirrorY: true,
      isTapped: true,
      ...measuredCardSizing,
    });
    const liveCenter = liveDraggedCenter({
      pointerScreen: { x: 503, y: 297 },
      dragAnchor: { x: 0.5, y: 0.5 },
      cardSize: {
        cardWidth: placement.cardWidth,
        cardHeight: placement.cardHeight,
      },
    });

    expect(placement.ghostPosition.x).toBeCloseTo(
      liveCenter.x + EXPECTED_GHOST_LEAD_PX,
      6
    );
    expect(placement.ghostPosition.y).toBeCloseTo(liveCenter.y, 6);
    expect(placement.snappedCanonical.y).toBeCloseTo(
      1 - placement.snappedPosition.y / zoneRect.height,
      6
    );
    expectEdgesAlignedToGrid({ placement, viewScale });
  });
});
