import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSize = vi.hoisted(() => ({ width: 1000, height: 800 }));
const mockRef = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/shared/useElementSize", () => ({
  useElementSize: () => ({ ref: mockRef, size: mockSize }),
}));

import {
  computeSeatSizing,
  useSeatSizing,
  getLgMediaQuery,
  getPreviewMinWidthPx,
  PREVIEW_MAX_WIDTH_PX,
  PREVIEW_MIN_WIDTH_PX,
  PREVIEW_SCALE_K,
  SIDEBAR_MIN_WIDTH_PX,
  SIDEBAR_WIDTH_SCALE_K,
  BATTLEFIELD_MAX_WIDTH_SHARE,
  SIDEZONE_LABEL_OVERHANG_MIN_PX,
  SIDEZONE_TARGET_GAP_MIN_PX,
  SIDEZONE_MAX_GAP_PX,
} from "../useSeatSizing";

const setMatchMedia = (matches: boolean) => {
  const lgQuery = getLgMediaQuery();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === lgQuery ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("computeSeatSizing", () => {
  it("derives base sizing from seat height", () => {
    const result = computeSeatSizing({ seatWidth: 1000, seatHeight: 800 });
    const expectedSidebarWidth = Math.max(
      SIDEBAR_MIN_WIDTH_PX,
      Math.sqrt(1000 * 800) * SIDEBAR_WIDTH_SCALE_K,
    );

    expect(result.handHeightPx).toBeCloseTo(200);
    expect(result.battlefieldHeightPx).toBeCloseTo(600);
    expect(result.baseCardHeightPx).toBeCloseTo(150);
    expect(result.baseCardWidthPx).toBeCloseTo(100);
    expect(result.sidebarWidthPx).toBeCloseTo(expectedSidebarWidth, 6);
    expect(result.previewWidthPx).toBeCloseTo(160);
    expect(result.previewHeightPx).toBeCloseTo(240);
  });

  it("clamps hand height overrides to min/max", () => {
    const result = computeSeatSizing({
      seatWidth: 1000,
      seatHeight: 800,
      handHeightOverridePx: 50,
    });

    expect(result.handHeightPx).toBeCloseTo(120);
  });

  it("clamps preview width to the max bound", () => {
    const result = computeSeatSizing({
      seatWidth: 1600,
      seatHeight: 2000,
      previewScale: PREVIEW_SCALE_K,
      previewMinWidthPx: PREVIEW_MIN_WIDTH_PX,
      previewMaxWidthPx: PREVIEW_MAX_WIDTH_PX,
    });

    expect(result.previewWidthPx).toBe(PREVIEW_MAX_WIDTH_PX);
  });

  it("uses an 80px floor when 10vw is smaller", () => {
    const result = computeSeatSizing({
      seatWidth: 600,
      seatHeight: 400,
      previewScale: 1,
      viewportWidthPx: 600,
    });

    expect(getPreviewMinWidthPx(600)).toBe(PREVIEW_MIN_WIDTH_PX);
    expect(result.previewWidthPx).toBe(PREVIEW_MIN_WIDTH_PX);
  });

  it("uses 10vw when it exceeds the floor", () => {
    const result = computeSeatSizing({
      seatWidth: 600,
      seatHeight: 400,
      previewScale: 1,
      viewportWidthPx: 1200,
    });

    expect(getPreviewMinWidthPx(1200)).toBe(120);
    expect(result.previewWidthPx).toBe(120);
  });

  it("keeps side zones aspect-locked while fitting vertically", () => {
    const result = computeSeatSizing({ seatWidth: 1000, seatHeight: 400 });

    const sidezoneContentWidth = result.sidebarWidthPx - result.sidebarPadXPx * 2;
    expect(sidezoneContentWidth).toBeGreaterThan(0);
    expect(result.sidezoneAspect).toBeCloseTo(1.5, 6);
    expect(result.sidezoneHeightPx).toBeCloseTo(
      sidezoneContentWidth / result.sidezoneAspect,
      6,
    );
    expect(result.lifeBoxHeightPx).toBeCloseTo(result.sidezoneHeightPx, 6);

    const verticalUsed =
      result.sidebarPadYPx * 2 +
      result.sidebarSectionGapPx +
      result.lifeBoxHeightPx +
      result.sidezoneContainerPadYPx * 2 +
      result.sidezoneHeightPx * 3 +
      result.sidezoneGapPx * 2;
    expect(verticalUsed).toBeLessThanOrEqual(result.seatHeightPx + 1e-6);
  });

  it("caps sidebar by height budget to preserve non-zero side zone gaps", () => {
    const seatWidth = 4000;
    const seatHeight = 600;
    const result = computeSeatSizing({ seatWidth, seatHeight });
    const targetSidebarWidth = Math.max(
      SIDEBAR_MIN_WIDTH_PX,
      Math.sqrt(seatWidth * seatHeight) * SIDEBAR_WIDTH_SCALE_K,
    );
    const expectedMinGap = Math.min(
      SIDEZONE_MAX_GAP_PX,
      SIDEZONE_TARGET_GAP_MIN_PX + SIDEZONE_LABEL_OVERHANG_MIN_PX * 2,
    );

    expect(result.sidebarWidthPx).toBeLessThan(targetSidebarWidth);
    expect(result.sidezoneGapPx).toBeGreaterThanOrEqual(expectedMinGap);
  });

  it("caps sidebar when preserving battlefield minimum width", () => {
    const seatWidth = 600;
    const seatHeight = 1600;
    const result = computeSeatSizing({ seatWidth, seatHeight });
    const targetSidebarWidth = Math.max(
      SIDEBAR_MIN_WIDTH_PX,
      Math.sqrt(seatWidth * seatHeight) * SIDEBAR_WIDTH_SCALE_K,
    );

    expect(result.sidebarWidthPx).toBeLessThan(targetSidebarWidth);
    expect(result.sidebarWidthPx).toBeLessThanOrEqual(
      seatWidth * (1 - BATTLEFIELD_MAX_WIDTH_SHARE) + 1e-6,
    );
  });
});

describe("useSeatSizing", () => {
  beforeEach(() => {
    document.documentElement.style.setProperty("--breakpoint-lg", "1024px");
    setMatchMedia(true);
  });

  it("returns null sizing when not in lg", () => {
    setMatchMedia(false);
    const { result } = renderHook(() => useSeatSizing());
    expect(result.current.sizing).toBeNull();
    expect(result.current.cssVars).toBeUndefined();
  });

  it("returns sizing and css vars for lg", () => {
    const { result } = renderHook(() => useSeatSizing());
    expect(result.current.sizing).not.toBeNull();
    expect(result.current.cssVars).toBeDefined();
    const cssVars = result.current.cssVars as Record<string, string> | undefined;
    expect(cssVars?.["--card-h"]).toBeDefined();
    expect(cssVars?.["--preview-w"]).toBeDefined();
    expect(cssVars?.["--preview-h"]).toBeDefined();
  });
});
