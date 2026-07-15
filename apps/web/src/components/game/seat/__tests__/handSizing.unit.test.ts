import { describe, expect, it } from "vitest";

import {
  COMMANDER_CARD_MIN_HEIGHT_PX,
  COMMANDER_DRAWER_MIN_HEIGHT_PX,
  COMMANDER_DRAWER_PADDING_PX,
  COMMANDER_ZONE_LABEL_HEIGHT_PX,
  COMMANDER_ZONE_LABEL_PADDING_PX,
  COMMANDER_ZONE_LABEL_TEXT_HEIGHT_PX,
  getCommanderDrawerHeight,
  getCommanderZoneLabelSizing,
  getDesktopHandHeights,
} from "../handSizing";

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

describe("getCommanderDrawerHeight", () => {
  it("scales to the seat's default battlefield card height", () => {
    expect(
      getCommanderDrawerHeight({ battlefieldCardHeight: 240, handHeight: 160 }),
    ).toBe(240);
  });

  it("keeps the label compact while protecting the minimum card canvas", () => {
    expect(
      getCommanderDrawerHeight({ battlefieldCardHeight: 40, handHeight: 40 }),
    ).toBe(COMMANDER_DRAWER_MIN_HEIGHT_PX);
    expect(
      COMMANDER_DRAWER_MIN_HEIGHT_PX - COMMANDER_DRAWER_PADDING_PX * 2,
    ).toBe(COMMANDER_CARD_MIN_HEIGHT_PX);
    expect(COMMANDER_ZONE_LABEL_HEIGHT_PX).toBeLessThan(
      COMMANDER_DRAWER_MIN_HEIGHT_PX,
    );
    expect(COMMANDER_ZONE_LABEL_HEIGHT_PX).toBe(
      COMMANDER_ZONE_LABEL_TEXT_HEIGHT_PX +
        COMMANDER_ZONE_LABEL_PADDING_PX * 2,
    );
  });
});

describe("getCommanderZoneLabelSizing", () => {
  it("preserves the visual label padding after seat scaling", () => {
    expect(getCommanderZoneLabelSizing(1)).toEqual({
      height: COMMANDER_ZONE_LABEL_HEIGHT_PX,
      padding: COMMANDER_ZONE_LABEL_PADDING_PX,
    });

    const halfScale = getCommanderZoneLabelSizing(0.5);
    expect(halfScale.padding).toBe(COMMANDER_ZONE_LABEL_PADDING_PX / 0.5);
    expect(halfScale.padding * 0.5).toBe(COMMANDER_ZONE_LABEL_PADDING_PX);
    expect(halfScale.height).toBe(
      COMMANDER_ZONE_LABEL_TEXT_HEIGHT_PX + halfScale.padding * 2,
    );
  });
});
