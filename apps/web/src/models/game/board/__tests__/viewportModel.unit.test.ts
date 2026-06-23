import { describe, expect, it } from "vitest";

import { isPortraitViewportMatch } from "../viewportModel";

describe("isPortraitViewportMatch", () => {
  it("matches real touch portrait devices", () => {
    expect(
      isPortraitViewportMatch({
        isPortrait: true,
        isTouchPointer: true,
        isNarrowViewport: false,
      }),
    ).toBe(true);
  });

  it("matches narrow portrait browser viewports for mobile QA", () => {
    expect(
      isPortraitViewportMatch({
        isPortrait: true,
        isTouchPointer: false,
        isNarrowViewport: true,
      }),
    ).toBe(true);
  });

  it("does not match narrow landscape viewports", () => {
    expect(
      isPortraitViewportMatch({
        isPortrait: false,
        isTouchPointer: false,
        isNarrowViewport: true,
      }),
    ).toBe(false);
  });

  it("does not match wide fine-pointer portrait viewports", () => {
    expect(
      isPortraitViewportMatch({
        isPortrait: true,
        isTouchPointer: false,
        isNarrowViewport: false,
      }),
    ).toBe(false);
  });
});
