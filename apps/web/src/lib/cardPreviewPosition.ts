export type RectLike = Pick<
  DOMRect,
  "top" | "left" | "bottom" | "width" | "height"
>;

export const computeCardPreviewPosition = (params: {
  anchorRect: RectLike;
  previewWidth: number;
  previewHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gapPx?: number;
}) => {
  const gap = params.gapPx ?? 18;

  let top = params.anchorRect.top - params.previewHeight - gap;
  let left =
    params.anchorRect.left +
    params.anchorRect.width / 2 -
    params.previewWidth / 2;

  // Viewport collision: default to above; if it doesn't fit, try below.
  if (top < gap) {
    top = params.anchorRect.bottom + gap;
  }

  // Clamp left to viewport.
  const maxLeft = params.viewportWidth - params.previewWidth - gap;
  left = Math.max(gap, Math.min(left, maxLeft));

  return { top, left };
};

