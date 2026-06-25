import { describe, expect, it } from "vitest";

import {
  getCurrentPointerScreen,
  getLivePointerCoordinates,
} from "../useGameDnD";

describe("useGameDnD pointer tracking", () => {
  it("prefers the live pointer coordinate over activator plus delta", () => {
    const activatorEvent = new MouseEvent("mousedown", {
      clientX: 300,
      clientY: 700,
    });

    const result = getCurrentPointerScreen({
      activatorEvent,
      delta: { x: -1086, y: -420 },
      livePointerScreen: { x: 250, y: 280 },
    });

    expect(result).toEqual({
      point: { x: 250, y: 280 },
      source: "live",
    });
  });

  it("falls back to activator plus delta when no live pointer is available", () => {
    const activatorEvent = new MouseEvent("mousedown", {
      clientX: 300,
      clientY: 700,
    });

    const result = getCurrentPointerScreen({
      activatorEvent,
      delta: { x: -50, y: -220 },
    });

    expect(result).toEqual({
      point: { x: 250, y: 480 },
      source: "delta",
    });
  });

  it("uses the lifted touch rather than a remaining finger on touchend", () => {
    const touchEnd = {
      type: "touchend",
      touches: [{ clientX: 40, clientY: 50 }],
      changedTouches: [{ clientX: 260, clientY: 280 }],
    } as unknown as TouchEvent;

    expect(getLivePointerCoordinates(touchEnd)).toEqual({ x: 260, y: 280 });
  });
});
