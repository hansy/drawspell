import { describe, expect, it } from "vitest";
import { stepBattlefieldZoom } from "../battlefieldZoom";
import {
  clampBattlefieldZoom,
  getBattlefieldZoomLimits,
} from "../battlefieldCamera";

describe("fixed battlefield zoom levels", () => {
  it("always reaches exact 100% from either side, including older off-step values", () => {
    expect(stepBattlefieldZoom(0.95, "in")).toBe(1);
    expect(stepBattlefieldZoom(1.05, "out")).toBe(1);
    expect(stepBattlefieldZoom(0.99, "in")).toBe(1);
    expect(stepBattlefieldZoom(1.03, "out")).toBe(1);
  });
  it("reverses every step without drift", () => {
    for (let percent = 5; percent < 200; percent += 5) {
      const zoom = percent / 100;
      expect(stepBattlefieldZoom(stepBattlefieldZoom(zoom, "in"), "out")).toBe(
        zoom,
      );
    }
  });
  it("rounds viewport minimum upward to a fixed level without exposing edges", () => {
    expect(getBattlefieldZoomLimits(1800, 360).min).toBe(0.4);
    expect(clampBattlefieldZoom(0, 1800, 360)).toBe(0.4);
    expect(clampBattlefieldZoom(0.99, 1800, 360)).toBe(1);
  });
});
