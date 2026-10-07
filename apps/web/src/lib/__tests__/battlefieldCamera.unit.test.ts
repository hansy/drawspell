import { describe, expect, it } from "vitest";
import {
  battlefieldToLocal,
  localToBattlefield,
  createBattlefieldCamera,
  fitBattlefieldCards,
  getBattlefieldZoomLimits,
  getBattlefieldWorldRect,
  getBattlefieldCameraPan,
} from "../battlefieldCamera";
import { computeBattlefieldPlacement } from "../dndBattlefield";
import { computeBattlefieldGroupGhostCards } from "@/hooks/game/dnd/model";

const rect = {
  left: 20,
  top: 30,
  width: 600,
  height: 360,
  right: 620,
  bottom: 390,
};
describe("battlefield cameras", () => {
  it.each([false, true])(
    "stops at every world edge and preserves bounded state (reversed=%s)",
    (reversed) => {
      for (const x of [-100000, 100000])
        for (const y of [-100000, 100000]) {
          const camera = createBattlefieldCamera(600, 360, 1, reversed, {
            x,
            y,
          });
          const rect = getBattlefieldWorldRect(camera);
          expect(rect.left).toBeLessThanOrEqual(0);
          expect(rect.top).toBeLessThanOrEqual(0);
          expect(rect.left + rect.width).toBeGreaterThanOrEqual(600);
          expect(rect.top + rect.height).toBeGreaterThanOrEqual(360);
          expect(
            createBattlefieldCamera(
              600,
              360,
              1,
              reversed,
              getBattlefieldCameraPan(camera, 600, 360),
            ),
          ).toEqual(camera);
        }
    },
  );
  it.each([
    [300, 600],
    [1800, 360],
  ])(
    "keeps the grid covering the viewport at minimum zoom at %s×%s",
    (width, height) => {
      const limits = getBattlefieldZoomLimits(width, height);
      const camera = createBattlefieldCamera(width, height, 0, false, {
        x: 100000,
        y: -100000,
      });
      expect(camera.scale).toBeCloseTo((height / 360) * limits.min);
      const rect = getBattlefieldWorldRect(camera);
      expect(rect.left).toBeLessThanOrEqual(0);
      expect(rect.top).toBeLessThanOrEqual(0);
      expect(rect.left + rect.width).toBeGreaterThanOrEqual(width);
      expect(rect.top + rect.height).toBeGreaterThanOrEqual(height);
      expect(
        createBattlefieldCamera(width, height, 100, false).scale,
      ).toBeCloseTo((height / 360) * 2);
    },
  );
  it("shows three card heights at default regardless of viewport height", () => {
    for (const height of [240, 360, 720]) {
      const camera = createBattlefieldCamera(900, height, 1, false);
      expect(height / (120 * camera.scale)).toBeCloseTo(3);
    }
  });
  it("reveals more columns without compressing card spacing on wider viewports", () => {
    const a = createBattlefieldCamera(600, 360, 1, false);
    const b = createBattlefieldCamera(1800, 360, 1, false);
    for (const position of [
      { x: 0, y: 0 },
      { x: 0.12, y: 0.2 },
    ]) {
      expect(battlefieldToLocal(position, a)).toEqual(
        battlefieldToLocal(position, b),
      );
    }
  });
  it("anchors the same starting card in opposite corners of rotated seats", () => {
    const owner = battlefieldToLocal(
      { x: 0, y: 0 },
      createBattlefieldCamera(1200, 360, 1, false),
    );
    const opponent = battlefieldToLocal(
      { x: 0, y: 0 },
      createBattlefieldCamera(600, 360, 1, true),
    );
    expect(opponent.x).toBeCloseTo(600 - owner.x);
    expect(opponent.y).toBeCloseTo(360 - owner.y);
  });
  it.each([false, true])(
    "round trips far-away coordinates through a panned/zoomed camera (reversed=%s)",
    (reversed) => {
      const camera = createBattlefieldCamera(600, 360, 0.5, reversed, {
        x: -2400,
        y: 800,
      });
      const position = { x: 2.4, y: -1.6 };
      const result = localToBattlefield(
        battlefieldToLocal(position, camera),
        camera,
      );
      expect(result.x).toBeCloseTo(position.x);
      expect(result.y).toBeCloseTo(position.y);
    },
  );
  it("scales gaps, cards, and snap intervals by the same factor", () => {
    const gap = (zoom: number) => {
      const camera = createBattlefieldCamera(600, 360, zoom, false);
      return (
        battlefieldToLocal({ x: 0.12, y: 0 }, camera).x -
        battlefieldToLocal({ x: 0, y: 0 }, camera).x
      );
    };
    expect(gap(0.5)).toBeCloseTo(gap(1) / 2);
    expect(gap(2)).toBeCloseTo(gap(1) * 2);
  });
  it.each([false, true])(
    "commits a drop to the same world point at different zoom levels (reversed=%s)",
    (reversed) => {
      for (const zoom of [0.25, 1, 2]) {
        const camera = createBattlefieldCamera(600, 360, zoom, reversed, {
          x: 700,
          y: -400,
        });
        const target = { x: -0.24, y: 1.2 };
        const local = battlefieldToLocal(target, camera);
        const placement = computeBattlefieldPlacement({
          camera,
          centerScreen: { x: rect.left + local.x, y: rect.top + local.y },
          overRect: rect,
          zoneScale: 1,
          viewScale: camera.scale,
          mirrorY: reversed,
          isTapped: true,
        });
        expect(placement.snappedCanonical.x).toBeCloseTo(target.x);
        expect(placement.snappedCanonical.y).toBeCloseTo(target.y);
        expect(placement.ghostPosition.x).toBeCloseTo(local.x);
        expect(placement.ghostPosition.y).toBeCloseTo(local.y);
      }
    },
  );
  it("preserves group offsets beyond the old viewport with a rotated camera", () => {
    const camera = createBattlefieldCamera(600, 360, 0.5, true, {
      x: 100,
      y: 200,
    });
    const target = { x: -2, y: 1.8 };
    const ghosts = computeBattlefieldGroupGhostCards({
      camera,
      groupCardIds: ["a", "b"],
      activeCardId: "a",
      startPositions: { a: { x: 0, y: 0 }, b: { x: 0.12, y: 0.2 } },
      cards: { a: { id: "a", tapped: false }, b: { id: "b", tapped: true } },
      targetZoneId: "bf",
      activeGhostPosition: battlefieldToLocal(target, camera),
      zoneWidth: 600,
      zoneHeight: 360,
      mirrorY: true,
      viewScale: 0.5,
    });
    const a = localToBattlefield(ghosts[0].position, camera),
      b = localToBattlefield(ghosts[1].position, camera);
    expect(a.x).toBeCloseTo(-2);
    expect(b.x - a.x).toBeCloseTo(0.12);
    expect(b.y - a.y).toBeCloseTo(0.2);
  });
  it.each([false, true])(
    "fits distant cards without rewriting positions (reversed=%s)",
    (reversed) => {
      const positions = [
        { x: -2, y: -1 },
        { x: 2, y: 1.8 },
      ];
      const { zoom, pan } = fitBattlefieldCards(positions, 800, 450, reversed);
      const camera = createBattlefieldCamera(800, 450, zoom, reversed, pan);
      for (const position of positions) {
        const p = battlefieldToLocal(position, camera);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(800);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(450);
      }
      expect(positions).toEqual([
        { x: -2, y: -1 },
        { x: 2, y: 1.8 },
      ]);
    },
  );
});
