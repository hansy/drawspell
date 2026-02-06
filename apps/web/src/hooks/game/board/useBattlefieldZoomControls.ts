import * as React from "react";

import { useGameStore } from "@/store/gameStore";

export type UseBattlefieldZoomControlsArgs = {
  playerId: string;
  enabled: boolean;
  wheelTarget?: HTMLElement | null;
  isBlocked?: boolean;
};

const PINCH_STEP_PX = 20;

export const useBattlefieldZoomControls = ({
  playerId,
  enabled,
  wheelTarget,
  isBlocked = false,
}: UseBattlefieldZoomControlsArgs) => {
  const setBattlefieldViewScale = useGameStore(
    (state) => state.setBattlefieldViewScale
  );

  const adjustScale = React.useCallback(
    (direction: "in" | "out") => {
      if (!enabled || isBlocked) return;

      const currentScale =
        useGameStore.getState().battlefieldViewScale[playerId] ?? 1;
      const delta = 0.05;
      const nextScale = direction === "in"
        ? currentScale + delta
        : currentScale - delta;

      setBattlefieldViewScale(playerId, nextScale);
    },
    [enabled, isBlocked, playerId, setBattlefieldViewScale]
  );

  React.useEffect(() => {
    if (!enabled || !wheelTarget) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      if (isBlocked) return;

      const direction = event.deltaY < 0 ? "in" : "out";
      adjustScale(direction);
      event.preventDefault();
    };

    wheelTarget.addEventListener("wheel", handleWheel, { passive: false });
    return () => wheelTarget.removeEventListener("wheel", handleWheel);
  }, [adjustScale, enabled, isBlocked, wheelTarget]);

  React.useEffect(() => {
    if (!enabled || !wheelTarget) return;

    const touchPoints = new Map<number, { x: number; y: number }>();
    let pinchDistance: number | null = null;

    const getPinchDistance = () => {
      if (touchPoints.size !== 2) return null;
      const [a, b] = Array.from(touchPoints.values());
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pinchDistance = getPinchDistance();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      if (!touchPoints.has(event.pointerId)) return;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (isBlocked || touchPoints.size !== 2) return;

      const nextDistance = getPinchDistance();
      if (!nextDistance) return;
      if (pinchDistance == null) {
        pinchDistance = nextDistance;
        return;
      }

      const delta = nextDistance - pinchDistance;
      if (Math.abs(delta) < PINCH_STEP_PX) return;

      const steps = Math.trunc(delta / PINCH_STEP_PX);
      if (steps === 0) return;

      const direction = steps > 0 ? "in" : "out";
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
    };

    wheelTarget.addEventListener("pointerdown", handlePointerDown);
    wheelTarget.addEventListener("pointermove", handlePointerMove, { passive: false });
    wheelTarget.addEventListener("pointerup", handlePointerEnd);
    wheelTarget.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      wheelTarget.removeEventListener("pointerdown", handlePointerDown);
      wheelTarget.removeEventListener("pointermove", handlePointerMove);
      wheelTarget.removeEventListener("pointerup", handlePointerEnd);
      wheelTarget.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [adjustScale, enabled, isBlocked, wheelTarget]);
};
