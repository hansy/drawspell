import * as React from "react";
import type { BattlefieldCamera } from "@/lib/battlefieldCamera";

const ZOOM_TRANSITION_MS = 160;

// Animate the shared camera transform, so rendering and hit testing use the
// same geometry on every frame. Pan, resize, and card dragging stay immediate.
export function useSmoothBattlefieldCamera(
  target: BattlefieldCamera,
  contextKey: string,
  enabled: boolean,
) {
  const [rendered, setRendered] = React.useState(target);
  const current = React.useRef(target);
  const previousTarget = React.useRef(target);
  const context = React.useRef(contextKey);
  const active = React.useRef(false);

  React.useLayoutEffect(() => {
    const animate =
      enabled &&
      context.current === contextKey &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches &&
      (target.scale !== previousTarget.current.scale || active.current);
    previousTarget.current = target;
    context.current = contextKey;
    if (!animate) {
      active.current = false;
      current.current = target;
      setRendered(target);
      return;
    }
    active.current = true;
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(
        1,
        Math.max(0, (now - start) / ZOOM_TRANSITION_MS),
      );
      const eased = 1 - (1 - progress) ** 3;
      // Linear interpolation of scale and offset preserves the cursor anchor
      // and finite-world bounds between two valid camera endpoints.
      const next =
        progress === 1
          ? target
          : {
              reversed: target.reversed,
              scale: from.scale + (target.scale - from.scale) * eased,
              offset: {
                x: from.offset.x + (target.offset.x - from.offset.x) * eased,
                y: from.offset.y + (target.offset.y - from.offset.y) * eased,
              },
            };
      current.current = next;
      active.current = progress < 1;
      setRendered(next);
      if (active.current) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, contextKey, enabled]);

  const camera = enabled && context.current === contextKey ? rendered : target;
  return { camera, isAnimating: camera !== target };
}
