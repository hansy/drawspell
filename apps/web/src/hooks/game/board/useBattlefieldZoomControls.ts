import * as React from "react";

import { useGameStore } from "@/store/gameStore";
import { debugLog, type DebugFlagKey } from "@/lib/debug";
import { stepBattlefieldZoom } from "@/lib/battlefieldZoom";

export type UseBattlefieldZoomControlsArgs = {
  playerId: string;
  enabled: boolean;
  wheelTarget?: HTMLElement | null;
  isBlocked?: boolean;
  onZoomAnchor?: (point: { x: number; y: number }) => void;
  onPinch?: (gesture: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    ratio: number;
  }) => void;
  onTouchNavigation?: (active: boolean) => void;
};

const PINCH_STEP_PX = 20;
const WHEEL_STEP_PX = 60;
const WHEEL_STEP_INTERVAL_MS = 60;
const WHEEL_GESTURE_GAP_MS = 200;
const BATTLEFIELD_DND_DEBUG_KEY: DebugFlagKey = "battlefieldDnd";

export const useBattlefieldZoomControls = ({
  playerId,
  enabled,
  wheelTarget,
  isBlocked = false,
  onZoomAnchor,
  onPinch,
  onTouchNavigation,
}: UseBattlefieldZoomControlsArgs) => {
  const setBattlefieldViewScale = useGameStore(
    (state) => state.setBattlefieldViewScale,
  );

  const adjustScale = React.useCallback(
    (direction: "in" | "out") => {
      if (!enabled || isBlocked) return;

      const currentScale =
        useGameStore.getState().battlefieldViewScale[playerId] ?? 1;
      const nextScale = stepBattlefieldZoom(currentScale, direction);

      debugLog(BATTLEFIELD_DND_DEBUG_KEY, "battlefield-zoom-adjust", {
        playerId,
        direction,
        currentScale,
        requestedScale: nextScale,
        enabled,
        isBlocked,
      });

      setBattlefieldViewScale(playerId, nextScale);
    },
    [enabled, isBlocked, playerId, setBattlefieldViewScale],
  );

  React.useEffect(() => {
    if (!enabled || !wheelTarget) return;

    let accumulated = 0;
    let lastEventAt = -Infinity;
    let lastStepAt = -Infinity;
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      if (isBlocked) return;

      if (!event.deltaY) return;
      event.preventDefault();
      const now = performance.now();
      const pixels =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? Math.max(1, wheelTarget.clientHeight)
            : 1);
      if (
        now - lastEventAt > WHEEL_GESTURE_GAP_MS ||
        Math.sign(pixels) !== Math.sign(accumulated)
      )
        accumulated = 0;
      lastEventAt = now;
      accumulated += pixels;
      if (
        Math.abs(accumulated) < WHEEL_STEP_PX ||
        now - lastStepAt < WHEEL_STEP_INTERVAL_MS
      )
        return;
      // One fixed step per deliberate scroll, never one per tiny
      // trackpad event or a large jump for a high-delta mouse wheel event.
      const direction = accumulated < 0 ? "in" : "out";
      accumulated = 0;
      lastStepAt = now;
      onZoomAnchor?.({ x: event.clientX, y: event.clientY });
      adjustScale(direction);
    };

    wheelTarget.addEventListener("wheel", handleWheel, { passive: false });
    return () => wheelTarget.removeEventListener("wheel", handleWheel);
  }, [adjustScale, enabled, isBlocked, wheelTarget, onZoomAnchor]);

  React.useEffect(() => {
    if (!enabled || !wheelTarget) return;

    const touchPoints = new Map<number, { x: number; y: number }>();
    let pinchDistance: number | null = null;

    const getPinchDistance = () => {
      if (touchPoints.size !== 2) return null;
      const [a, b] = Array.from(touchPoints.values());
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const midpoint = () => {
      const [a, b] = Array.from(touchPoints.values());
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pinchDistance = getPinchDistance();
      onTouchNavigation?.(!isBlocked && touchPoints.size === 2);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      if (!touchPoints.has(event.pointerId)) return;
      const previousMidpoint = midpoint();
      const previousDistance = getPinchDistance();
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (isBlocked || touchPoints.size !== 2) return;

      const nextDistance = getPinchDistance();
      if (!nextDistance) return;
      const nextMidpoint = midpoint();
      if (onPinch && previousMidpoint && nextMidpoint && previousDistance) {
        // Accumulate half-speed pinch movement in the camera, which snaps
        // zoom to fixed levels while preserving direct two-finger panning.
        onPinch({
          from: previousMidpoint,
          to: nextMidpoint,
          ratio: Math.sqrt(nextDistance / previousDistance),
        });
        pinchDistance = nextDistance;
        event.preventDefault();
        return;
      }
      if (pinchDistance == null) {
        pinchDistance = nextDistance;
        return;
      }

      const delta = nextDistance - pinchDistance;
      if (Math.abs(delta) < PINCH_STEP_PX) return;

      const steps = Math.trunc(delta / PINCH_STEP_PX);
      if (steps === 0) return;

      const direction = steps > 0 ? "in" : "out";
      debugLog(BATTLEFIELD_DND_DEBUG_KEY, "battlefield-zoom-pinch", {
        playerId,
        previousDistance: pinchDistance,
        nextDistance,
        delta,
        steps,
        direction,
      });
      const points = Array.from(touchPoints.values());
      onZoomAnchor?.({
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      });
      for (let i = 0; i < Math.abs(steps); i += 1) {
        adjustScale(direction);
      }
      pinchDistance += steps * PINCH_STEP_PX;
      event.preventDefault();
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      touchPoints.delete(event.pointerId);
      pinchDistance = getPinchDistance();
      onTouchNavigation?.(!isBlocked && touchPoints.size === 2);
    };

    wheelTarget.addEventListener("pointerdown", handlePointerDown);
    wheelTarget.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    // Fingers can leave the battlefield before release.
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    wheelTarget.addEventListener("pointerup", handlePointerEnd);
    wheelTarget.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      wheelTarget.removeEventListener("pointerdown", handlePointerDown);
      wheelTarget.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      wheelTarget.removeEventListener("pointerup", handlePointerEnd);
      wheelTarget.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [
    adjustScale,
    enabled,
    isBlocked,
    wheelTarget,
    onZoomAnchor,
    onPinch,
    onTouchNavigation,
  ]);
};
