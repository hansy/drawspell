import * as React from "react";

type Axis = "x" | "y" | "both";

export type UseTwoFingerScrollArgs = {
  target: HTMLElement | null;
  enabled?: boolean;
  axis?: Axis;
};

const shouldScrollX = (axis: Axis) => axis === "x" || axis === "both";
const shouldScrollY = (axis: Axis) => axis === "y" || axis === "both";

export const useTwoFingerScroll = ({
  target,
  enabled = true,
  axis = "both",
}: UseTwoFingerScrollArgs) => {
  React.useEffect(() => {
    if (!enabled || !target) return;

    const touchPoints = new Map<number, { x: number; y: number }>();
    let lastMidpoint: { x: number; y: number } | null = null;

    const getMidpoint = () => {
      if (touchPoints.size !== 2) return null;
      const [a, b] = Array.from(touchPoints.values());
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      lastMidpoint = getMidpoint();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      if (!touchPoints.has(event.pointerId)) return;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (touchPoints.size !== 2) {
        lastMidpoint = null;
        return;
      }

      const midpoint = getMidpoint();
      if (!midpoint) return;

      if (lastMidpoint) {
        const dx = midpoint.x - lastMidpoint.x;
        const dy = midpoint.y - lastMidpoint.y;
        if (shouldScrollX(axis)) {
          target.scrollLeft -= dx;
        }
        if (shouldScrollY(axis)) {
          target.scrollTop -= dy;
        }
        event.preventDefault();
      }
      lastMidpoint = midpoint;
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      touchPoints.delete(event.pointerId);
      lastMidpoint = touchPoints.size === 2 ? getMidpoint() : null;
    };

    target.addEventListener("pointerdown", handlePointerDown);
    target.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    target.addEventListener("pointerup", handlePointerEnd);
    target.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      target.removeEventListener("pointerdown", handlePointerDown);
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", handlePointerEnd);
      target.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [axis, enabled, target]);
};
