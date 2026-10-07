import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSmoothBattlefieldCamera } from "../useSmoothBattlefieldCamera";
import {
  createBattlefieldCamera,
  getBattlefieldWorldRect,
  localToBattlefield,
} from "@/lib/battlefieldCamera";

const initial = createBattlefieldCamera(600, 360, 1, false);
const target = {
  ...initial,
  scale: 2,
  offset: {
    x: 300 - (300 - initial.offset.x) * 2,
    y: 180 - (180 - initial.offset.y) * 2,
  },
};
let now = 0;
let frameId = 0;
let frames: Map<number, FrameRequestCallback>;
const advance = (time: number) =>
  act(() => {
    now = time;
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(now);
  });
describe("smooth battlefield camera", () => {
  beforeEach(() => {
    now = 0;
    frames = new Map();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("eases grid and card geometry through intermediate frames while preserving the zoom anchor and bounds", () => {
    const { result, rerender } = renderHook(
      ({ camera }) => useSmoothBattlefieldCamera(camera, "seat", true),
      { initialProps: { camera: initial } },
    );
    rerender({ camera: target });
    expect(result.current.camera).toEqual(initial);
    advance(40);
    expect(result.current.camera.scale).toBeGreaterThan(1);
    expect(result.current.camera.scale).toBeLessThan(2);
    const anchor = { x: 300, y: 180 };
    const before = localToBattlefield(anchor, initial);
    const during = localToBattlefield(anchor, result.current.camera);
    expect(during.x).toBeCloseTo(before.x);
    expect(during.y).toBeCloseTo(before.y);
    const bounds = getBattlefieldWorldRect(result.current.camera);
    expect(bounds.left).toBeLessThanOrEqual(0);
    expect(bounds.top).toBeLessThanOrEqual(0);
    expect(bounds.left + bounds.width).toBeGreaterThanOrEqual(600);
    expect(bounds.top + bounds.height).toBeGreaterThanOrEqual(360);
    advance(160);
    expect(result.current.camera).toEqual(target);
    expect(result.current.isAnimating).toBe(false);
  });
  it("retargets from the current frame and cancels pending frames on unmount", () => {
    const { result, rerender, unmount } = renderHook(
      ({ camera }) => useSmoothBattlefieldCamera(camera, "seat", true),
      { initialProps: { camera: initial } },
    );
    rerender({ camera: target });
    advance(40);
    const intermediate = result.current.camera;
    rerender({ camera: initial });
    expect(result.current.camera).toEqual(intermediate);
    advance(80);
    expect(result.current.camera.scale).toBeLessThan(intermediate.scale);
    unmount();
    expect(frames.size).toBe(0);
  });
  it("applies pan, resize, dragging, and reduced-motion changes immediately", () => {
    const { result, rerender } = renderHook(
      ({ camera, context, enabled }) =>
        useSmoothBattlefieldCamera(camera, context, enabled),
      { initialProps: { camera: initial, context: "600x360", enabled: true } },
    );
    const pan = { ...initial, offset: { x: 200, y: 200 } };
    rerender({ camera: pan, context: "600x360", enabled: true });
    expect(result.current.camera).toEqual(pan);
    rerender({ camera: target, context: "800x480", enabled: true });
    expect(result.current.camera).toEqual(target);
    rerender({ camera: initial, context: "800x480", enabled: false });
    expect(result.current.camera).toEqual(initial);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    rerender({ camera: target, context: "800x480", enabled: true });
    expect(result.current.camera).toEqual(target);
    expect(frames.size).toBe(0);
  });
});
