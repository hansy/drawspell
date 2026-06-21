import { describe, expect, it } from "vitest";

import type { Card } from "@/types";
import { getCanonicalBattlefieldPlacementGridSteps, getCardPixelSize } from "@/lib/positions";
import {
  computeBattlefieldCardLayout,
  computeBattlefieldGridProjection,
} from "../battlefieldModel";

const measuredCardSizing = {
  baseCardHeight: 135,
  baseCardWidth: 90,
};

const createCard = (overrides: Partial<Card> = {}): Card => ({
  id: "c1",
  name: "Card",
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

const renderedCardGeometry = (params: {
  card: Card;
  zoneWidth: number;
  zoneHeight: number;
  viewScale: number;
}) => {
  const layout = computeBattlefieldCardLayout({
    card: params.card,
    zoneOwnerId: "p1",
    viewerPlayerId: "p1",
    zoneWidth: params.zoneWidth,
    zoneHeight: params.zoneHeight,
    mirrorBattlefieldY: false,
    playerColors: {},
    ...measuredCardSizing,
  });
  const size = getCardPixelSize({
    viewScale: params.viewScale,
    isTapped: params.card.tapped,
    ...measuredCardSizing,
  });

  // Battlefield cards are positioned as an untapped base box and then
  // transformed from their center by CardView/Card. The bounding box changes
  // when tapped or scaled, but the transform-origin center must not.
  return {
    left: layout.left,
    top: layout.top,
    boundingWidth: size.cardWidth,
    boundingHeight: size.cardHeight,
    transformCenterX: layout.left + measuredCardSizing.baseCardWidth / 2,
    transformCenterY: layout.top + measuredCardSizing.baseCardHeight / 2,
  };
};

describe("battlefield layout contracts", () => {
  it("keeps the rendered card center stable when tapping", () => {
    const zoneWidth = 1000;
    const zoneHeight = 600;
    const untapped = renderedCardGeometry({
      card: createCard({ tapped: false }),
      zoneWidth,
      zoneHeight,
      viewScale: 1,
    });
    const tapped = renderedCardGeometry({
      card: createCard({ tapped: true }),
      zoneWidth,
      zoneHeight,
      viewScale: 1,
    });

    expect(untapped.boundingWidth).toBe(90);
    expect(untapped.boundingHeight).toBe(135);
    expect(tapped.boundingWidth).toBe(135);
    expect(tapped.boundingHeight).toBe(90);
    expect(tapped.left).toBe(untapped.left);
    expect(tapped.top).toBe(untapped.top);
    expect(Math.abs(tapped.transformCenterX - untapped.transformCenterX)).toBeLessThanOrEqual(1);
    expect(Math.abs(tapped.transformCenterY - untapped.transformCenterY)).toBeLessThanOrEqual(1);
  });

  it("keeps canonical center stable while zooming a tapped card", () => {
    const zoneWidth = 1000;
    const zoneHeight = 600;
    const atFullScale = renderedCardGeometry({
      card: createCard({ tapped: true }),
      zoneWidth,
      zoneHeight,
      viewScale: 1,
    });
    const atNinetyPercent = renderedCardGeometry({
      card: createCard({ tapped: true }),
      zoneWidth,
      zoneHeight,
      viewScale: 0.9,
    });

    expect(atNinetyPercent.boundingWidth).toBeCloseTo(121.5);
    expect(atNinetyPercent.boundingHeight).toBeCloseTo(81);
    expect(atNinetyPercent.left).toBe(atFullScale.left);
    expect(atNinetyPercent.top).toBe(atFullScale.top);
    expect(Math.abs(atNinetyPercent.transformCenterX - atFullScale.transformCenterX)).toBeLessThanOrEqual(1);
    expect(Math.abs(atNinetyPercent.transformCenterY - atFullScale.transformCenterY)).toBeLessThanOrEqual(1);
  });

  it("uses half-width square grid steps independent of tapped state", () => {
    const zoneWidth = 1000;
    const zoneHeight = 600;
    const untappedFullScale = computeBattlefieldGridProjection({
      zoneWidth,
      zoneHeight,
      viewScale: 1,
      isTapped: false,
      ...measuredCardSizing,
    });
    const tappedZoomedOut = computeBattlefieldGridProjection({
      zoneWidth,
      zoneHeight,
      viewScale: 0.9,
      isTapped: true,
      ...measuredCardSizing,
    });
    const untappedZoomedOut = computeBattlefieldGridProjection({
      zoneWidth,
      zoneHeight,
      viewScale: 0.9,
      isTapped: false,
      ...measuredCardSizing,
    });
    const placementSteps = getCanonicalBattlefieldPlacementGridSteps({
      zoneWidth,
      zoneHeight,
      viewScale: 1,
      ...measuredCardSizing,
    });
    const zoomedOutSteps = getCanonicalBattlefieldPlacementGridSteps({
      zoneWidth,
      zoneHeight,
      viewScale: 0.9,
      ...measuredCardSizing,
    });

    expect(untappedFullScale.gridStepX).toBeCloseTo(zoneWidth * placementSteps.stepX);
    expect(untappedFullScale.gridStepY).toBeCloseTo(zoneHeight * placementSteps.stepY);
    expect(untappedFullScale.gridStepX).toBeCloseTo(measuredCardSizing.baseCardWidth / 2);
    expect(untappedFullScale.gridStepY).toBeCloseTo(measuredCardSizing.baseCardWidth / 2);
    expect(tappedZoomedOut.gridStepX).toBeCloseTo(zoneWidth * zoomedOutSteps.stepX);
    expect(tappedZoomedOut.gridStepY).toBeCloseTo(zoneHeight * zoomedOutSteps.stepY);
    expect(tappedZoomedOut.gridStepY).toBeCloseTo(
      (measuredCardSizing.baseCardWidth * 0.9) / 2
    );
    expect(tappedZoomedOut).toEqual(untappedZoomedOut);
  });

  it("keeps drag permission independent of visual movement state", () => {
    const ownerControlled = computeBattlefieldCardLayout({
      card: createCard({ ownerId: "p1", controllerId: "p2" }),
      zoneOwnerId: "p2",
      viewerPlayerId: "p1",
      zoneWidth: 1000,
      zoneHeight: 600,
      mirrorBattlefieldY: false,
      playerColors: {},
      ...measuredCardSizing,
    });
    const foreignControlled = computeBattlefieldCardLayout({
      card: createCard({ ownerId: "p2", controllerId: "p3" }),
      zoneOwnerId: "p1",
      viewerPlayerId: "p1",
      zoneWidth: 1000,
      zoneHeight: 600,
      mirrorBattlefieldY: false,
      playerColors: {},
      ...measuredCardSizing,
    });

    expect(ownerControlled.disableDrag).toBe(false);
    expect(foreignControlled.disableDrag).toBe(true);
  });
});
