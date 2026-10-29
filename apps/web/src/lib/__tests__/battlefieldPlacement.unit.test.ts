import { describe, expect, it } from "vitest";

import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO, LEGACY_BATTLEFIELD_WIDTH } from "@mtg/shared/constants/geometry";
import { nextOpenBattlefieldPosition } from "../battlefieldPlacement";

describe("nextOpenBattlefieldPosition", () => {
  it("starts at the origin on an empty battlefield", () => {
    expect(nextOpenBattlefieldPosition([])).toEqual({ x: 0, y: 0 });
  });

  it("places the next card to the right of the front row", () => {
    const stepX = (BASE_CARD_HEIGHT * CARD_ASPECT_RATIO) / LEGACY_BATTLEFIELD_WIDTH;
    const next = nextOpenBattlefieldPosition([
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.2 },
      { x: 0.9, y: 0.6 },
    ]);
    expect(next.y).toBeCloseTo(0.2, 1);
    expect(next.x).toBeGreaterThan(0.3 + stepX * 0.9);
  });
});
