export const DEBUG_FLAGS = {
  faceDownDrag: false,
  battlefieldDnd: false,
} as const;

export type DebugFlagKey = keyof typeof DEBUG_FLAGS;

const DEBUG_STORAGE_PREFIX = "drawspell.debug.";
const DEBUG_QUERY_PREFIX = "debug";
const DEBUG_LOG_PREFIX = "[DEBUG-drawspell]";
const DEBUG_EVENT_DOM_ID = "__drawspell-debug-events";
const DEBUG_EVENT_DOM_LIMIT = 300;

declare global {
  interface Window {
    __drawspellDebugEvents?: Array<{
      key: DebugFlagKey;
      timestamp: number;
      args: unknown[];
    }>;
  }
}

const enabledValues = new Set(["1", "true", "yes", "on"]);

const toRuntimeFlagName = (key: DebugFlagKey) =>
  key ? `${key[0].toUpperCase()}${key.slice(1)}` : key;

const readDebugQueryFlag = (key: DebugFlagKey) => {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  const namedFlag = search.get(`${DEBUG_QUERY_PREFIX}${toRuntimeFlagName(key)}`);
  if (namedFlag && enabledValues.has(namedFlag.toLowerCase())) return true;

  const debugParam = search.get(DEBUG_QUERY_PREFIX);
  if (!debugParam) return false;
  return debugParam
    .split(",")
    .map((part) => part.trim())
    .includes(key);
};

const readDebugStorageFlag = (key: DebugFlagKey) => {
  if (typeof window === "undefined") return false;
  try {
    const value = window.localStorage.getItem(`${DEBUG_STORAGE_PREFIX}${key}`);
    return value ? enabledValues.has(value.toLowerCase()) : false;
  } catch (_err) {
    return false;
  }
};

export const isDebugEnabled = (key: DebugFlagKey): boolean =>
  DEBUG_FLAGS[key] || readDebugQueryFlag(key) || readDebugStorageFlag(key);

const publishDebugEventsToDom = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const events = window.__drawspellDebugEvents;
  if (!events) return;

  let node = document.getElementById(DEBUG_EVENT_DOM_ID);
  if (!node) {
    node = document.createElement("script");
    node.id = DEBUG_EVENT_DOM_ID;
    node.setAttribute("type", "application/json");
    node.setAttribute("data-drawspell-debug-events", "true");
    document.documentElement.appendChild(node);
  }
  node.textContent = JSON.stringify(events.slice(-DEBUG_EVENT_DOM_LIMIT));
  document.documentElement.setAttribute(
    "data-drawspell-debug-event-count",
    String(events.length)
  );
};

export const debugLog = (key: DebugFlagKey, ...args: unknown[]) => {
  if (!isDebugEnabled(key)) return;
  if (typeof window !== "undefined") {
    window.__drawspellDebugEvents ??= [];
    window.__drawspellDebugEvents.push({
      key,
      timestamp: Date.now(),
      args,
    });
    if (window.__drawspellDebugEvents.length > 1000) {
      window.__drawspellDebugEvents.splice(
        0,
        window.__drawspellDebugEvents.length - 1000
      );
    }
    publishDebugEventsToDom();
  }
  try {
    console.info(`${DEBUG_LOG_PREFIX}:${key}`, JSON.stringify(args));
  } catch (_err) {
    console.info(`${DEBUG_LOG_PREFIX}:${key}`, ...args);
  }
};

export type DebugRectSummary = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

export type DebugPointSummary = {
  x: number;
  y: number;
};

export type DebugPointerRelationSummary = {
  containsPointer: boolean;
  pointerLocal: DebugPointSummary;
  pointerLocalPercent: DebugPointSummary;
  centerFromPointer: DebugPointSummary & { distance: number };
  anchorPoint: DebugPointSummary | null;
  anchorError: (DebugPointSummary & { distance: number }) | null;
};

export const summarizeRect = (
  rect: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">
): DebugRectSummary => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  right: rect.right,
  bottom: rect.bottom,
  centerX: rect.left + rect.width / 2,
  centerY: rect.top + rect.height / 2,
});

const distance = (point: DebugPointSummary) => Math.hypot(point.x, point.y);

export const summarizeRectPointerRelation = (
  rect:
    | Pick<
        DebugRectSummary,
        "left" | "top" | "right" | "bottom" | "width" | "height" | "centerX" | "centerY"
      >
    | null
    | undefined,
  pointer?: DebugPointSummary | null,
  anchor?: DebugPointSummary | null,
): DebugPointerRelationSummary | null => {
  if (!rect || !pointer) return null;
  const pointerLocal = {
    x: pointer.x - rect.left,
    y: pointer.y - rect.top,
  };
  const pointerLocalPercent = {
    x: rect.width ? pointerLocal.x / rect.width : 0,
    y: rect.height ? pointerLocal.y / rect.height : 0,
  };
  const centerFromPointer = {
    x: rect.centerX - pointer.x,
    y: rect.centerY - pointer.y,
  };
  const anchorPoint =
    anchor && rect.width && rect.height
      ? {
          x: rect.left + anchor.x * rect.width,
          y: rect.top + anchor.y * rect.height,
        }
      : null;
  const anchorError = anchorPoint
    ? {
        x: anchorPoint.x - pointer.x,
        y: anchorPoint.y - pointer.y,
      }
    : null;

  return {
    containsPointer:
      pointer.x >= rect.left &&
      pointer.x <= rect.right &&
      pointer.y >= rect.top &&
      pointer.y <= rect.bottom,
    pointerLocal,
    pointerLocalPercent,
    centerFromPointer: {
      ...centerFromPointer,
      distance: distance(centerFromPointer),
    },
    anchorPoint,
    anchorError: anchorError
      ? { ...anchorError, distance: distance(anchorError) }
      : null,
  };
};

export const summarizeElement = (
  element: Element | null | undefined,
  pointer?: DebugPointSummary | null,
  anchor?: DebugPointSummary | null,
) => {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const rectSummary = summarizeRect(rect);
  return {
    rect: rectSummary,
    pointerRelation: summarizeRectPointerRelation(rectSummary, pointer, anchor),
    dataAttributes: {
      cardId: element.getAttribute("data-card-id"),
      dndGhostCardId: element.getAttribute("data-dnd-ghost-card-id"),
      dndGhostKind: element.getAttribute("data-dnd-ghost-kind"),
      dragOverlayCardId: element.getAttribute("data-dnd-drag-overlay-card-id"),
      dragOverlayCardViewId: element.getAttribute(
        "data-dnd-drag-overlay-card-view-id"
      ),
    },
    transform: style.transform,
    transformOrigin: style.transformOrigin,
    transition: style.transition,
    opacity: style.opacity,
    inlineStyle: element.getAttribute("style"),
    className: element.className,
  };
};

const escapeSelectorValue = (value: string) => {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

export const summarizeCardElement = (cardId: string) => {
  if (typeof document === "undefined") return null;
  return summarizeElement(
    document.querySelector(`[data-card-id="${escapeSelectorValue(cardId)}"]`)
  );
};

export const summarizeGhostElement = (cardId: string) => {
  if (typeof document === "undefined") return null;
  return summarizeElement(
    document.querySelector(
      `[data-dnd-ghost-card-id="${escapeSelectorValue(cardId)}"]`
    )
  );
};

export const summarizeDragOverlayElement = (cardId: string) => {
  if (typeof document === "undefined") return null;
  return summarizeElement(
    document.querySelector(
      `[data-dnd-drag-overlay-card-id="${escapeSelectorValue(cardId)}"]`
    )
  );
};

export const summarizeDragOverlayCardElement = (cardId: string) => {
  if (typeof document === "undefined") return null;
  return summarizeElement(
    document.querySelector(
      `[data-dnd-drag-overlay-card-view-id="${escapeSelectorValue(cardId)}"]`
    )
  );
};

export const summarizeDragOverlayFrameElement = (cardId: string) => {
  if (typeof document === "undefined") return null;
  return summarizeElement(
    document.querySelector(
      `[data-dnd-drag-overlay-card-frame-id="${escapeSelectorValue(cardId)}"]`
    )
  );
};

export const summarizeHandSortableElement = (cardId: string) => {
  if (typeof document === "undefined") return null;
  return summarizeElement(
    document.querySelector(
      `[data-dnd-hand-sortable-card-id="${escapeSelectorValue(cardId)}"]`
    )
  );
};

export const summarizeHandCardFrameElement = (cardId: string) => {
  if (typeof document === "undefined") return null;
  return summarizeElement(
    document.querySelector(
      `[data-dnd-hand-card-frame-id="${escapeSelectorValue(cardId)}"]`
    )
  );
};

export const summarizeCardPreviewElement = (cardId?: string) => {
  if (typeof document === "undefined") return null;
  const selector = cardId
    ? `[data-card-preview-card-id="${escapeSelectorValue(cardId)}"]`
    : "[data-card-preview]";
  return summarizeElement(document.querySelector(selector));
};

const centerDelta = (
  from: DebugRectSummary | null | undefined,
  to: DebugRectSummary | null | undefined,
) => {
  if (!from || !to) return null;
  const delta = {
    x: to.centerX - from.centerX,
    y: to.centerY - from.centerY,
  };
  return {
    ...delta,
    distance: distance(delta),
  };
};

export const summarizeDndCardGeometry = (
  cardId: string,
  params: {
    pointer?: DebugPointSummary | null;
    dragAnchor?: DebugPointSummary | null;
  } = {},
) => {
  if (typeof document === "undefined") return null;
  const summarize = (element: Element | null | undefined) =>
    summarizeElement(element, params.pointer, params.dragAnchor);
  const card = summarize(
    document.querySelector(`[data-card-id="${escapeSelectorValue(cardId)}"]`)
  );
  const handSortable = summarize(
    document.querySelector(
      `[data-dnd-hand-sortable-card-id="${escapeSelectorValue(cardId)}"]`
    )
  );
  const handCardFrame = summarize(
    document.querySelector(
      `[data-dnd-hand-card-frame-id="${escapeSelectorValue(cardId)}"]`
    )
  );
  const dragOverlay = summarize(
    document.querySelector(
      `[data-dnd-drag-overlay-card-id="${escapeSelectorValue(cardId)}"]`
    )
  );
  const dragOverlayCard = summarize(
    document.querySelector(
      `[data-dnd-drag-overlay-card-view-id="${escapeSelectorValue(cardId)}"]`
    )
  );
  const dragOverlayFrame = summarize(
    document.querySelector(
      `[data-dnd-drag-overlay-card-frame-id="${escapeSelectorValue(cardId)}"]`
    )
  );
  const ghost = summarize(
    document.querySelector(
      `[data-dnd-ghost-card-id="${escapeSelectorValue(cardId)}"]`
    )
  );
  const preview = summarize(
    document.querySelector(
      `[data-card-preview-card-id="${escapeSelectorValue(cardId)}"]`
    )
  );
  const overlayRect =
    dragOverlayCard?.rect ?? dragOverlayFrame?.rect ?? dragOverlay?.rect;

  return {
    pointer: params.pointer ?? null,
    dragAnchor: params.dragAnchor ?? null,
    card,
    handSortable,
    handCardFrame,
    dragOverlay,
    dragOverlayFrame,
    dragOverlayCard,
    ghost,
    preview,
    centerDeltas: {
      cardToHandSortable: centerDelta(card?.rect, handSortable?.rect),
      cardToHandFrame: centerDelta(card?.rect, handCardFrame?.rect),
      cardToOverlay: centerDelta(card?.rect, overlayRect),
      overlayToGhost: centerDelta(overlayRect, ghost?.rect),
      overlayToPreview: centerDelta(overlayRect, preview?.rect),
      previewToGhost: centerDelta(preview?.rect, ghost?.rect),
    },
  };
};

export const summarizeZoneElement = (zoneId: string) => {
  if (typeof document === "undefined") return null;
  return summarizeElement(
    document.querySelector(`[data-zone-id="${escapeSelectorValue(zoneId)}"]`)
  );
};

const summarizeToken = (token: string | undefined) => {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const suffix = trimmed.length > 6 ? trimmed.slice(-6) : trimmed;
  return { length: trimmed.length, suffix };
};

export const handoffDebugLog = (event: string, payload?: Record<string, unknown>) => {
  console.info("[handoff-debug]", event, payload ?? {});
};

export const handoffDebugTokenSummary = (token: string | undefined) =>
  summarizeToken(token);
