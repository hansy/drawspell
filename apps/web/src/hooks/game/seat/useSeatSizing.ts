import * as React from "react";

import { useElementSize } from "@/hooks/shared/useElementSize";
import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from "@/lib/constants";

export const LG_BREAKPOINT_VAR = "--breakpoint-lg";
export const DEFAULT_LG_BREAKPOINT = "1024px";
export const LG_MEDIA_QUERY = `(min-width: ${DEFAULT_LG_BREAKPOINT})`;

export const SEAT_BOTTOM_BAR_PCT = 0.25;
export const SEAT_HAND_MIN_PCT = 0.15;
export const SEAT_HAND_MAX_PCT = 0.4;

export const PREVIEW_SCALE_K = 1.6;
export const PREVIEW_MIN_WIDTH_PX = 200;
export const PREVIEW_MAX_WIDTH_PX = 400;
export const MIN_CARD_HEIGHT_PX = 80;
export const SIDEBAR_MIN_WIDTH_PX = 120;
export const SIDEBAR_WIDTH_SCALE_K = 0.195;
export const SIDEBAR_PAD_X_PX = 16;
export const SIDEBAR_PAD_Y_MIN_PX = 10;
export const SIDEBAR_PAD_Y_MAX_PX = 24;
export const SIDEBAR_SECTION_GAP_MIN_PX = 8;
export const SIDEBAR_SECTION_GAP_MAX_PX = 20;
export const SIDEZONE_COUNT = 3;
export const SIDEZONE_TARGET_ASPECT = 1.5;
export const SIDEZONE_LABEL_OVERHANG_PCT = 0.012;
export const SIDEZONE_LABEL_OVERHANG_MIN_PX = 6;
export const SIDEZONE_LABEL_OVERHANG_MAX_PX = 10;
export const SIDEZONE_TARGET_GAP_PCT = 0.012;
export const SIDEZONE_TARGET_GAP_MIN_PX = 8;
export const SIDEZONE_TARGET_GAP_MAX_PX = 16;
export const SIDEZONE_MIN_GAP_PX = 0;
export const SIDEZONE_MAX_GAP_PX = 28;
// Matches the `-top-3/-bottom-3` label overhang in SideZone.
export const SIDEZONE_CONTAINER_PAD_Y_PX = 12;
export const BATTLEFIELD_MIN_WIDTH_PX = 420;
export const BATTLEFIELD_MIN_CARD_COLUMNS = 6.5;
export const BATTLEFIELD_MAX_WIDTH_SHARE = 0.9;

// DialogContent default p-6.
export const MODAL_PAD_PX = 24;

export interface SeatSizingOptions {
  handHeightOverridePx?: number;
  bottomBarPct?: number;
  handMinPct?: number;
  handMaxPct?: number;
  previewScale?: number;
  previewMinWidthPx?: number;
  previewMaxWidthPx?: number;
  modalPadPx?: number;
}

export interface SeatSizing {
  seatWidthPx: number;
  seatHeightPx: number;
  handHeightPx: number;
  battlefieldHeightPx: number;
  baseCardHeightPx: number;
  baseCardWidthPx: number;
  previewWidthPx: number;
  previewHeightPx: number;
  cmdrStackOffsetPx: number;
  viewScale: number;
  modalPadPx: number;
  sidebarWidthPx: number;
  sidebarPadXPx: number;
  sidebarPadYPx: number;
  sidebarSectionGapPx: number;
  lifeBoxHeightPx: number;
  sidezoneHeightPx: number;
  sidezoneGapPx: number;
  sidezoneContainerPadYPx: number;
  sidezoneAspect: number;
  sidezoneCardScale: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const getPreviewDimensions = (
  baseCardWidthPx?: number,
  options: {
    previewScale?: number;
    previewMinWidthPx?: number;
    previewMaxWidthPx?: number;
  } = {},
) => {
  const {
    previewScale = PREVIEW_SCALE_K,
    previewMinWidthPx = PREVIEW_MIN_WIDTH_PX,
    previewMaxWidthPx = PREVIEW_MAX_WIDTH_PX,
  } = options;
  const resolvedBaseWidth =
    Number.isFinite(baseCardWidthPx) && (baseCardWidthPx ?? 0) > 0
      ? baseCardWidthPx!
      : BASE_CARD_HEIGHT * CARD_ASPECT_RATIO;
  const previewWidthPx = clamp(
    resolvedBaseWidth * previewScale,
    previewMinWidthPx,
    previewMaxWidthPx,
  );
  return {
    previewWidthPx,
    previewHeightPx: previewWidthPx / CARD_ASPECT_RATIO,
  };
};

export const computeSeatSizing = (
  params: SeatSizingOptions & {
    seatWidth: number;
    seatHeight: number;
  },
): SeatSizing => {
  const {
    seatWidth,
    seatHeight,
    handHeightOverridePx,
    bottomBarPct = SEAT_BOTTOM_BAR_PCT,
    handMinPct = SEAT_HAND_MIN_PCT,
    handMaxPct = SEAT_HAND_MAX_PCT,
    previewScale = PREVIEW_SCALE_K,
    previewMinWidthPx = PREVIEW_MIN_WIDTH_PX,
    previewMaxWidthPx = PREVIEW_MAX_WIDTH_PX,
    modalPadPx = MODAL_PAD_PX,
  } = params;

  const heightBasis = seatHeight;
  const minHandHeight = heightBasis * handMinPct;
  const maxHandHeight = heightBasis * handMaxPct;
  const baselineHandHeight = heightBasis * bottomBarPct;
  const handHeightPx = clamp(
    handHeightOverridePx ?? baselineHandHeight,
    minHandHeight,
    maxHandHeight,
  );

  const battlefieldHeightPx = seatHeight - handHeightPx;
  const baseCardHeightPx = Math.max(
    MIN_CARD_HEIGHT_PX,
    battlefieldHeightPx / 4,
  );
  const baseCardWidthPx = baseCardHeightPx * CARD_ASPECT_RATIO;
  const sidebarPadYPx = clamp(
    seatHeight * 0.03,
    SIDEBAR_PAD_Y_MIN_PX,
    SIDEBAR_PAD_Y_MAX_PX,
  );
  const sidebarSectionGapPx = 0;
  const sidebarWidthTargetPx = Math.max(
    SIDEBAR_MIN_WIDTH_PX,
    Math.sqrt(seatWidth * seatHeight) * SIDEBAR_WIDTH_SCALE_K,
  );
  const stackVerticalBudgetPx = Math.max(
    0,
    seatHeight - sidebarPadYPx * 2 - sidebarSectionGapPx,
  );
  const zonesBlockBudgetPx = Math.max(
    0,
    stackVerticalBudgetPx - SIDEZONE_CONTAINER_PAD_Y_PX * 2,
  );
  const sidezoneTargetGapPx = clamp(
    seatHeight * SIDEZONE_TARGET_GAP_PCT,
    SIDEZONE_TARGET_GAP_MIN_PX,
    SIDEZONE_TARGET_GAP_MAX_PX,
  );
  const sidezoneLabelOverhangPx = clamp(
    seatHeight * SIDEZONE_LABEL_OVERHANG_PCT,
    SIDEZONE_LABEL_OVERHANG_MIN_PX,
    SIDEZONE_LABEL_OVERHANG_MAX_PX,
  );
  const sidezoneTargetStackGapPx =
    sidezoneTargetGapPx + sidezoneLabelOverhangPx * 2;
  const zonesBlockBudgetForSizedGapsPx = Math.max(
    0,
    zonesBlockBudgetPx - (SIDEZONE_COUNT - 1) * sidezoneTargetStackGapPx,
  );
  const sidebarWidthByHeightPx =
    (zonesBlockBudgetForSizedGapsPx * SIDEZONE_TARGET_ASPECT) /
      (SIDEZONE_COUNT + 1) +
    SIDEBAR_PAD_X_PX * 2;
  const battlefieldMinWidthPx = Math.min(
    seatWidth * BATTLEFIELD_MAX_WIDTH_SHARE,
    Math.max(
      BATTLEFIELD_MIN_WIDTH_PX,
      baseCardWidthPx * BATTLEFIELD_MIN_CARD_COLUMNS,
    ),
  );
  const sidebarWidthByBattlefieldPx = Math.max(
    SIDEBAR_PAD_X_PX * 2 + 1,
    seatWidth - battlefieldMinWidthPx,
  );
  const sidebarWidthPx = Math.max(
    SIDEBAR_PAD_X_PX * 2 + 1,
    Math.min(
      sidebarWidthTargetPx,
      sidebarWidthByHeightPx,
      sidebarWidthByBattlefieldPx,
    ),
  );
  const sidebarInnerWidthPx = Math.max(
    1,
    sidebarWidthPx - SIDEBAR_PAD_X_PX * 2,
  );
  const sidezoneHeightPx = sidebarInnerWidthPx / SIDEZONE_TARGET_ASPECT;
  const lifeBoxHeightPx = sidezoneHeightPx;
  const zonesVerticalBudgetPx = Math.max(
    0,
    zonesBlockBudgetPx - lifeBoxHeightPx,
  );
  const sidezoneGapPx =
    SIDEZONE_COUNT > 1
      ? clamp(
          (zonesVerticalBudgetPx - sidezoneHeightPx * SIDEZONE_COUNT) /
            (SIDEZONE_COUNT - 1),
          SIDEZONE_MIN_GAP_PX,
          SIDEZONE_MAX_GAP_PX,
        )
      : 0;
  const sidezoneAspect = SIDEZONE_TARGET_ASPECT;
  const sidezoneCardScale = sidezoneAspect;

  const { previewWidthPx, previewHeightPx } = getPreviewDimensions(
    baseCardWidthPx,
    {
      previewScale,
      previewMinWidthPx,
      previewMaxWidthPx,
    },
  );

  const cmdrStackOffsetPx = Math.max(40, baseCardHeightPx * 0.35);

  const viewScale =
    BASE_CARD_HEIGHT > 0 ? baseCardHeightPx / BASE_CARD_HEIGHT : 1;

  return {
    seatWidthPx: seatWidth,
    seatHeightPx: seatHeight,
    handHeightPx,
    battlefieldHeightPx,
    baseCardHeightPx,
    baseCardWidthPx,
    previewWidthPx,
    previewHeightPx,
    cmdrStackOffsetPx,
    viewScale,
    modalPadPx,
    sidebarWidthPx,
    sidebarPadXPx: SIDEBAR_PAD_X_PX,
    sidebarPadYPx,
    sidebarSectionGapPx,
    lifeBoxHeightPx,
    sidezoneHeightPx,
    sidezoneGapPx,
    sidezoneContainerPadYPx: SIDEZONE_CONTAINER_PAD_Y_PX,
    sidezoneAspect,
    sidezoneCardScale,
  };
};

export const getLgMediaQuery = () => {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof getComputedStyle === "undefined"
  ) {
    return LG_MEDIA_QUERY;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(LG_BREAKPOINT_VAR)
    .trim();
  const breakpoint = value || DEFAULT_LG_BREAKPOINT;
  return `(min-width: ${breakpoint})`;
};

const useMediaQuery = (query: string) => {
  const getMatch = React.useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const [matches, setMatches] = React.useState(getMatch);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(media.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
};

export const useIsLg = () => {
  const lgQuery = React.useMemo(getLgMediaQuery, []);
  return useMediaQuery(lgQuery);
};

export const useSeatSizing = (options: SeatSizingOptions = {}) => {
  const {
    handHeightOverridePx,
    bottomBarPct = SEAT_BOTTOM_BAR_PCT,
    handMinPct = SEAT_HAND_MIN_PCT,
    handMaxPct = SEAT_HAND_MAX_PCT,
    previewScale = PREVIEW_SCALE_K,
    previewMinWidthPx = PREVIEW_MIN_WIDTH_PX,
    previewMaxWidthPx = PREVIEW_MAX_WIDTH_PX,
    modalPadPx = MODAL_PAD_PX,
  } = options;

  const { ref, size } = useElementSize<HTMLDivElement>({
    debounceMs: 16,
    thresholdPx: 1,
  });
  const lgQuery = React.useMemo(getLgMediaQuery, []);
  const isLg = useMediaQuery(lgQuery);

  const sizing = React.useMemo(() => {
    if (!isLg || size.width <= 0 || size.height <= 0) {
      return null;
    }

    return computeSeatSizing({
      seatWidth: size.width,
      seatHeight: size.height,
      handHeightOverridePx,
      bottomBarPct,
      handMinPct,
      handMaxPct,
      previewScale,
      previewMinWidthPx,
      previewMaxWidthPx,
      modalPadPx,
    });
  }, [
    isLg,
    size.width,
    size.height,
    handHeightOverridePx,
    bottomBarPct,
    handMinPct,
    handMaxPct,
    previewScale,
    previewMinWidthPx,
    previewMaxWidthPx,
    modalPadPx,
  ]);

  const cssVars = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!sizing) return undefined;
    return {
      "--seat-h": `${sizing.seatHeightPx}px`,
      "--seat-w": `${sizing.seatWidthPx}px`,
      "--hand-h": `${sizing.handHeightPx}px`,
      "--battlefield-h": `${sizing.battlefieldHeightPx}px`,
      "--card-h": `${sizing.baseCardHeightPx}px`,
      "--card-w": `${sizing.baseCardWidthPx}px`,
      "--cmdr-offset": `${sizing.cmdrStackOffsetPx}px`,
      "--preview-h": `${sizing.previewHeightPx}px`,
      "--preview-w": `${sizing.previewWidthPx}px`,
      "--modal-pad": `${sizing.modalPadPx}px`,
      "--seat-sidebar-w": `${sizing.sidebarWidthPx}px`,
      "--sidebar-pad-x": `${sizing.sidebarPadXPx}px`,
      "--sidebar-pad-y": `${sizing.sidebarPadYPx}px`,
      "--sidebar-section-gap": `${sizing.sidebarSectionGapPx}px`,
      "--lifebox-h": `${sizing.lifeBoxHeightPx}px`,
      "--sidezone-h": `${sizing.sidezoneHeightPx}px`,
      "--sidezone-gap": `${sizing.sidezoneGapPx}px`,
      "--sidezone-container-pad-y": `${sizing.sidezoneContainerPadYPx}px`,
      "--sidezone-aspect": `${sizing.sidezoneAspect}`,
      "--sidezone-card-scale": `${sizing.sidezoneCardScale}`,
    } as React.CSSProperties;
  }, [sizing]);

  return { ref, size, sizing, cssVars, isLg };
};
