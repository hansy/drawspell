export const PORTRAIT_ORIENTATION_QUERY = "(orientation: portrait)";
export const COARSE_POINTER_QUERY = "(pointer: coarse)";
export const NARROW_VIEWPORT_QUERY = "(max-width: 768px)";

export type ViewportMediaMatches = {
  isPortrait: boolean;
  isTouchPointer: boolean;
  isNarrowViewport: boolean;
};

export const isPortraitViewportMatch = ({
  isPortrait,
  isTouchPointer,
  isNarrowViewport,
}: ViewportMediaMatches) => isPortrait && (isTouchPointer || isNarrowViewport);

export const getPortraitViewportMatch = (
  matchMedia: typeof window.matchMedia,
) =>
  isPortraitViewportMatch({
    isPortrait: matchMedia(PORTRAIT_ORIENTATION_QUERY).matches,
    isTouchPointer: matchMedia(COARSE_POINTER_QUERY).matches,
    isNarrowViewport: matchMedia(NARROW_VIEWPORT_QUERY).matches,
  });
