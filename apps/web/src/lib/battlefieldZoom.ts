import { MAX_BATTLEFIELD_VIEW_SCALE } from "@mtg/shared/constants/geometry";

// Integer percentages keep all inputs on the same ladder without float drift.
export const ZOOM_STEP_PERCENT = 5;
export const roundZoomUp = (zoom: number) =>
  (Math.ceil((zoom * 100) / ZOOM_STEP_PERCENT - 1e-9) * ZOOM_STEP_PERCENT) /
  100;

export const snapBattlefieldZoom = (
  zoom: number,
  min = ZOOM_STEP_PERCENT / 100,
  max = MAX_BATTLEFIELD_VIEW_SCALE,
) => {
  const percent =
    Math.round(((Number.isFinite(zoom) ? zoom : 1) * 100) / ZOOM_STEP_PERCENT) *
    ZOOM_STEP_PERCENT;
  return Math.max(min, Math.min(max, percent / 100));
};

export const stepBattlefieldZoom = (zoom: number, direction: "in" | "out") => {
  const index = (zoom * 100) / ZOOM_STEP_PERCENT;
  const next =
    direction === "in"
      ? Math.floor(index + 1e-9) + 1
      : Math.ceil(index - 1e-9) - 1;
  return snapBattlefieldZoom((next * ZOOM_STEP_PERCENT) / 100);
};
