import { describe, expect, it } from "vitest";

import { getDesktopHandHeights } from "../handSizing";

describe("getDesktopHandHeights", () => {
  it("maps minimum, default, and maximum heights to 50%, 75%, and 100% of a card", () => {
    const sizing = getDesktopHandHeights({
      seatWidth: 1600,
      seatHeight: 1000,
    });

    expect(sizing.cardHeight).toBeCloseTo(376);
    expect(sizing.minHeight).toBeCloseTo(188);
    expect(sizing.defaultHeight).toBeCloseTo(282);
    expect(sizing.maxHeight).toBeCloseTo(376);
    expect(sizing.minHeight / sizing.cardHeight).toBeCloseTo(0.5);
    expect(sizing.defaultHeight / sizing.cardHeight).toBeCloseTo(0.75);
  });

  it("caps full-card height to 40% of the seat", () => {
    const sizing = getDesktopHandHeights({
      seatWidth: 2400,
      seatHeight: 800,
    });

    expect(sizing.cardHeight).toBe(320);
    expect(sizing.maxHeight).toBe(320);
  });
});
