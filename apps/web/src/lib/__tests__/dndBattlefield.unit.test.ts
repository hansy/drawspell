import { describe, expect, it } from 'vitest';

import { computeBattlefieldPlacement } from '../dndBattlefield';

describe('dndBattlefield', () => {
  describe('computeBattlefieldPlacement', () => {
    it('snaps and returns ghost position in zone space', () => {
      const result = computeBattlefieldPlacement({
        centerScreen: { x: 100, y: 100 },
        overRect: {
          left: 0,
          top: 0,
          right: 600,
          bottom: 400,
          width: 600,
          height: 400,
        },
        zoneScale: 1,
        viewScale: 1,
        mirrorY: false,
        isTapped: false,
      });

      expect(result.ghostPosition.x).toBeCloseTo(120);
      expect(result.ghostPosition.y).toBeCloseTo(100);
      expect(result.previewCanonical.x).toBeCloseTo(100 / 600);
      expect(result.previewCanonical.y).toBeCloseTo(0.25);
      expect(result.snappedCanonical.x).toBeCloseTo(0.2);
      expect(result.snappedCanonical.y).toBeCloseTo(0.25);
    });

    it('keeps snapping canonical when rendering with custom base card dimensions', () => {
      const result = computeBattlefieldPlacement({
        centerScreen: { x: 100, y: 100 },
        overRect: {
          left: 0,
          top: 0,
          right: 600,
          bottom: 400,
          width: 600,
          height: 400,
        },
        zoneScale: 1,
        viewScale: 1,
        mirrorY: false,
        isTapped: false,
        baseCardHeight: 160,
        baseCardWidth: 120,
      });

      expect(result.cardWidth).toBeCloseTo(120, 3);
      expect(result.cardHeight).toBeCloseTo(160, 3);
      expect(result.ghostPosition.x).toBeCloseTo(120, 3);
      expect(result.ghostPosition.y).toBeCloseTo(100, 3);
      expect(result.previewCanonical.x).toBeCloseTo(100 / 600, 3);
      expect(result.previewCanonical.y).toBeCloseTo(0.25, 3);
      expect(result.snappedCanonical.x).toBeCloseTo(0.2, 3);
      expect(result.snappedCanonical.y).toBeCloseTo(0.25, 3);
    });

    it('clamps near the edges to canonical battlefield bounds', () => {
      const result = computeBattlefieldPlacement({
        centerScreen: { x: 5, y: 5 },
        overRect: {
          left: 0,
          top: 0,
          right: 600,
          bottom: 400,
          width: 600,
          height: 400,
        },
        zoneScale: 1,
        viewScale: 1,
        mirrorY: false,
        isTapped: false,
      });

      expect(result.snappedCanonical.x).toBeCloseTo(0.04);
      expect(result.snappedCanonical.y).toBeCloseTo(0.1);
      expect(result.ghostPosition.x).toBeCloseTo(result.zoneWidth * 0.04);
      expect(result.ghostPosition.y).toBeCloseTo(result.zoneHeight * 0.1);
    });

    it('keeps canonical snapping independent of view scale with custom base size', () => {
      const result = computeBattlefieldPlacement({
        centerScreen: { x: 100, y: 100 },
        overRect: {
          left: 0,
          top: 0,
          right: 600,
          bottom: 400,
          width: 600,
          height: 400,
        },
        zoneScale: 1,
        viewScale: 0.5,
        mirrorY: false,
        isTapped: false,
        baseCardHeight: 160,
        baseCardWidth: 120,
      });

      expect(result.snappedCanonical.x).toBeCloseTo(0.2);
      expect(result.snappedCanonical.y).toBeCloseTo(0.25);
      expect(result.ghostPosition.x).toBeCloseTo(120);
      expect(result.ghostPosition.y).toBeCloseTo(100);
    });

    it('uses the pointer anchor to place a zoom-resized battlefield preview', () => {
      const result = computeBattlefieldPlacement({
        pointerScreen: { x: 320, y: 330 },
        dragAnchor: { x: 0.25, y: 0.25 },
        overRect: {
          left: 0,
          top: 0,
          right: 1000,
          bottom: 600,
          width: 1000,
          height: 600,
        },
        zoneScale: 1,
        viewScale: 0.5,
        mirrorY: false,
        isTapped: false,
      });

      expect(result.previewCanonical.x).toBeCloseTo(0.33);
      expect(result.previewCanonical.y).toBeCloseTo(0.575);
      expect(result.snappedCanonical.x).toBeCloseTo(0.36);
      expect(result.snappedCanonical.y).toBeCloseTo(0.6);
      expect(result.ghostPosition.x).toBeCloseTo(360);
      expect(result.ghostPosition.y).toBeCloseTo(360);
    });

    it('returns the same canonical snap for equivalent pointers on different field sizes', () => {
      const small = computeBattlefieldPlacement({
        centerScreen: { x: 100, y: 100 },
        overRect: {
          left: 0,
          top: 0,
          right: 600,
          bottom: 400,
          width: 600,
          height: 400,
        },
        zoneScale: 1,
        viewScale: 1,
        mirrorY: false,
        isTapped: false,
      });

      const large = computeBattlefieldPlacement({
        centerScreen: { x: 150, y: 150 },
        overRect: {
          left: 0,
          top: 0,
          right: 900,
          bottom: 600,
          width: 900,
          height: 600,
        },
        zoneScale: 1,
        viewScale: 1,
        mirrorY: false,
        isTapped: false,
      });

      expect(large.snappedCanonical).toEqual(small.snappedCanonical);
      expect(large.ghostPosition.x / large.zoneWidth).toBeCloseTo(
        small.ghostPosition.x / small.zoneWidth
      );
      expect(large.ghostPosition.y / large.zoneHeight).toBeCloseTo(
        small.ghostPosition.y / small.zoneHeight
      );
    });

    it('returns a canonical snapped position while mirroring ghost rendering for the viewer', () => {
      const baseParams = {
        centerScreen: { x: 100, y: 100 },
        overRect: {
          left: 0,
          top: 0,
          right: 600,
          bottom: 400,
          width: 600,
          height: 400,
        },
        zoneScale: 1,
        viewScale: 1,
        isTapped: false,
      } as const;

      const normal = computeBattlefieldPlacement({ ...baseParams, mirrorY: false });
      expect(normal.ghostPosition.x / normal.zoneWidth).toBeCloseTo(normal.snappedCanonical.x);
      expect(normal.ghostPosition.y / normal.zoneHeight).toBeCloseTo(normal.snappedCanonical.y);

      const mirrored = computeBattlefieldPlacement({ ...baseParams, mirrorY: true });
      expect(mirrored.ghostPosition.x / mirrored.zoneWidth).toBeCloseTo(mirrored.snappedCanonical.x);
      expect(mirrored.ghostPosition.y / mirrored.zoneHeight).toBeCloseTo(1 - mirrored.snappedCanonical.y);
    });
  });

});
