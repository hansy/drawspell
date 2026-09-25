import { describe, expect, it } from "vitest";

import { getCanonicalBattlefieldPlacementGridSteps } from "@/lib/positions";
import {
  distance,
  gridAlignedCenter,
  liveDraggedCenter,
  measuredCardSizing,
  placementGridPixels,
  zoneRect,
} from "@test/utils/dndGeometry";
import {
  computeAnchoredDragRect,
  computeAnchoredResizeOffset,
  computeDragOverlayBaseScale,
  computeBattlefieldPlacement,
  getEffectiveCardSize,
} from "../dndBattlefield";

const expectCenterOnGrid = (params: {
  placement: ReturnType<typeof computeBattlefieldPlacement>;
  mirrorY?: boolean;
}) => {
  const grid = getCanonicalBattlefieldPlacementGridSteps({
    zoneWidth: zoneRect.width,
    zoneHeight: zoneRect.height,
    ...measuredCardSizing,
  });
  const stepX = grid.stepX * zoneRect.width;
  const stepY = grid.stepY * zoneRect.height;
  const center = params.placement.snappedPosition;
  expect(center.x / stepX).toBeCloseTo(Math.round(center.x / stepX), 6);
  const canonicalY = params.mirrorY ? zoneRect.height - center.y : center.y;
  expect(canonicalY / stepY).toBeCloseTo(Math.round(canonicalY / stepY), 6);
};

describe("battlefield placement contracts", () => {
  it("separates the rendered card size from the logical battlefield slot", () => {
    const untapped = computeBattlefieldPlacement({
      centerScreen: { x: 500, y: 300 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale: 1,
      mirrorY: false,
      isTapped: false,
    });
    const tapped = computeBattlefieldPlacement({
      centerScreen: { x: 500, y: 300 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale: 1,
      mirrorY: false,
      isTapped: true,
    });

    expect(untapped.cardWidth).toBeCloseTo(120 * (63 / 88));
    expect(untapped.cardHeight).toBe(120);
    expect(untapped.slotWidth).toBe(80);
    expect(untapped.slotHeight).toBe(120);
    expect(tapped.cardWidth).toBe(120);
    expect(tapped.cardHeight).toBeCloseTo(120 * (63 / 88));
    expect(tapped.slotWidth).toBe(120);
    expect(tapped.slotHeight).toBe(80);
  });

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

  it("keeps a moving drop preview snapped from the live dragged center without lead bias", () => {
    const grid = placementGridPixels();
    const dragAnchor = { x: 0.5, y: 0.5 };
    const nextGridCenter = gridAlignedCenter({
      grid,
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

    expect(placement.leadScreen).toEqual({ x: 0, y: 0 });
    expect(placement.ghostPosition).toEqual(placement.snappedPosition);
    expect(placement.snappedPosition.x).toBeCloseTo(nextGridCenter.x);
    expect(placement.snappedPosition.y).toBeCloseTo(nextGridCenter.y);
    expectCenterOnGrid({ placement });
  });

  it("keeps snap displacement separate from artificial ghost lead while moving", () => {
    const grid = placementGridPixels();
    const dragAnchor = { x: 0.5, y: 0.5 };
    const justPastGridCenter = gridAlignedCenter({
      grid,
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

    expect(placement.leadScreen).toEqual({ x: 0, y: 0 });
    expect(placement.ghostPosition).toEqual(placement.snappedPosition);
    expect(placement.snappedPosition.x).toBeCloseTo(justPastGridCenter.x);
    expect(placement.snappedPosition.y).toBeCloseTo(justPastGridCenter.y);
    expectCenterOnGrid({ placement });
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

  it("snaps an untapped drop to a visible center point", () => {
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
    expectCenterOnGrid({ placement });
  });

  it("snaps a tapped drop to the same visible center lattice", () => {
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
    expect(placement.cardWidth).toBeCloseTo(measuredCardSizing.baseCardHeight * viewScale);
    expect(placement.cardHeight).toBeCloseTo(measuredCardSizing.baseCardWidth * viewScale);
    expectCenterOnGrid({ placement });
  });

  it.each([
    { viewScale: 1, isTapped: false },
    { viewScale: 1, isTapped: true },
    { viewScale: 0.9, isTapped: false },
    { viewScale: 0.9, isTapped: true },
    { viewScale: 0.75, isTapped: false },
    { viewScale: 0.75, isTapped: true },
    { viewScale: 0.5, isTapped: false },
    { viewScale: 0.5, isTapped: true },
  ])(
    "keeps the card center on a fixed grid at tapped=$isTapped and viewScale=$viewScale",
    ({ viewScale, isTapped }) => {
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
      expectCenterOnGrid({ placement });
    }
  );

  it("uses the same snap center for tapped and untapped cards at every zoom", () => {
    const positions = [false, true].flatMap((isTapped) =>
      [0.5, 0.75, 1, 1.5].map((viewScale) =>
        computeBattlefieldPlacement({
          pointerScreen: { x: 503, y: 297 },
          dragAnchor: { x: 0.5, y: 0.5 },
          overRect: zoneRect,
          zoneScale: 1,
          viewScale,
          mirrorY: false,
          isTapped,
          ...measuredCardSizing,
        }).snappedPosition
      )
    );

    for (const position of positions) {
      expect(position).toEqual(positions[0]);
    }
  });

  it("keeps the snapped center on a visible dot near the battlefield edge", () => {
    const placement = computeBattlefieldPlacement({
      pointerScreen: { x: 2, y: 2 },
      dragAnchor: { x: 0.5, y: 0.5 },
      overRect: zoneRect,
      zoneScale: 1,
      viewScale: 1,
      mirrorY: false,
      isTapped: true,
      ...measuredCardSizing,
    });

    expectCenterOnGrid({ placement });
    expect(placement.snappedPosition.x).toBeGreaterThan(0);
    expect(placement.snappedPosition.y).toBeGreaterThan(0);
  });

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
    expect(placement.ghostPosition).toEqual(placement.snappedPosition);
    expect(placement.snappedCanonical.y).toBeCloseTo(
      1 - placement.snappedPosition.y / zoneRect.height,
      6
    );
    expectCenterOnGrid({ placement, mirrorY: true });
  });
});
