import { describe, expect, it } from 'vitest';

import {
  computeBattlefieldCardLayout,
  computeBattlefieldGridProjection,
} from '../battlefieldModel';
import {
  fromNormalizedPosition,
  getCardPixelSize,
  snapNormalizedToCanonicalBattlefieldGrid,
} from '@/lib/positions';

const createCard = (overrides: Partial<any> = {}) =>
  ({
    id: 'c1',
    name: 'Card',
    ownerId: 'p1',
    controllerId: 'p1',
    zoneId: 'z1',
    tapped: false,
    faceDown: false,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    counters: [],
    ...overrides,
  }) as any;

const distanceToGrid = (value: number, origin: number, step: number) => {
  const remainder = ((value - origin) % step + step) % step;
  return Math.min(remainder, step - remainder);
};

describe('battlefieldModel', () => {
  it('computes left/top from normalized position', () => {
    const layout = computeBattlefieldCardLayout({
      card: createCard(),
      zoneOwnerId: 'p1',
      viewerPlayerId: 'p1',
      zoneWidth: 100,
      zoneHeight: 200,
      mirrorBattlefieldY: false,
      playerColors: {},
    });

    expect(layout.left).toBe(10);
    expect(layout.top).toBe(40);
  });

  it('uses a custom base card height when provided', () => {
    const layout = computeBattlefieldCardLayout({
      card: createCard(),
      zoneOwnerId: 'p1',
      viewerPlayerId: 'p1',
      zoneWidth: 100,
      zoneHeight: 200,
      mirrorBattlefieldY: false,
      playerColors: {},
      baseCardHeight: 160,
    });

    expect(layout.left).toBeCloseTo(-3.3333, 3);
    expect(layout.top).toBeCloseTo(20, 6);
  });

  it('mirrors Y when rendering for a mirrored seat', () => {
    const layout = computeBattlefieldCardLayout({
      card: createCard({ position: { x: 0.5, y: 0.25 } }),
      zoneOwnerId: 'p1',
      viewerPlayerId: 'p1',
      zoneWidth: 100,
      zoneHeight: 200,
      mirrorBattlefieldY: true,
      playerColors: {},
    });

    expect(layout.top).toBe(90);
  });

  it('highlights foreign-owned cards using the owner color', () => {
    const layout = computeBattlefieldCardLayout({
      card: createCard({ ownerId: 'p2' }),
      zoneOwnerId: 'p1',
      viewerPlayerId: 'p1',
      zoneWidth: 100,
      zoneHeight: 200,
      mirrorBattlefieldY: false,
      playerColors: { p2: 'red' },
    });

    expect(layout.highlightColor).toBe('red');
  });

  it('disables drag when the viewer is not the controller', () => {
    const layout = computeBattlefieldCardLayout({
      card: createCard({ ownerId: 'p2', controllerId: 'p3' }),
      zoneOwnerId: 'p1',
      viewerPlayerId: 'p1',
      zoneWidth: 100,
      zoneHeight: 200,
      mirrorBattlefieldY: false,
      playerColors: {},
    });

    expect(layout.disableDrag).toBe(true);
  });

  it('allows drag for the owner even when another player controls the card', () => {
    const layout = computeBattlefieldCardLayout({
      card: createCard({ ownerId: 'p1', controllerId: 'p2' }),
      zoneOwnerId: 'p2',
      viewerPlayerId: 'p1',
      zoneWidth: 100,
      zoneHeight: 200,
      mirrorBattlefieldY: false,
      playerColors: {},
    });

    expect(layout.disableDrag).toBe(false);
  });

  it('projects the canonical grid onto a zoomed-out narrow battlefield', () => {
    const zoneWidth = 149.328125;
    const zoneHeight = 676;
    const viewScale = 0.5;
    const snappedPosition = snapNormalizedToCanonicalBattlefieldGrid({
      x: 0.613,
      y: 0.375,
    });
    const center = fromNormalizedPosition(snappedPosition, zoneWidth, zoneHeight);
    const { cardWidth, cardHeight } = getCardPixelSize({ viewScale });
    const projection = computeBattlefieldGridProjection({
      zoneWidth,
      zoneHeight,
      viewScale,
    });

    expect(
      distanceToGrid(
        center.x - cardWidth / 2,
        projection.originOffsetX,
        projection.gridStepX
      )
    ).toBeLessThan(0.0001);
    expect(
      distanceToGrid(
        center.y - cardHeight / 2,
        projection.originOffsetY,
        projection.gridStepY
      )
    ).toBeLessThan(0.0001);
  });

  it('uses tapped dimensions when projecting the active drag grid', () => {
    const zoneWidth = 900;
    const zoneHeight = 540;
    const viewScale = 0.65;
    const snappedPosition = snapNormalizedToCanonicalBattlefieldGrid(
      { x: 0.4, y: 0.4 },
      { isTapped: true }
    );
    const center = fromNormalizedPosition(snappedPosition, zoneWidth, zoneHeight);
    const { cardWidth, cardHeight } = getCardPixelSize({
      viewScale,
      isTapped: true,
    });
    const projection = computeBattlefieldGridProjection({
      zoneWidth,
      zoneHeight,
      viewScale,
      isTapped: true,
    });

    expect(
      distanceToGrid(
        center.x - cardWidth / 2,
        projection.originOffsetX,
        projection.gridStepX
      )
    ).toBeLessThan(0.0001);
    expect(
      distanceToGrid(
        center.y - cardHeight / 2,
        projection.originOffsetY,
        projection.gridStepY
      )
    ).toBeLessThan(0.0001);
  });
});
