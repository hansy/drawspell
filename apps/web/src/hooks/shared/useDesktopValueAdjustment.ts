import * as React from "react";

const POINTER_MOVE_TOLERANCE_PX = 6;

type DesktopMousePress = {
  pointerId: number;
  button: 0 | 2;
  startX: number;
  startY: number;
};

export type DesktopValueAdjustmentOptions = {
  enabled: boolean;
  canIncrement?: boolean;
  canDecrement?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
};

export const useDesktopValueAdjustment = ({
  enabled,
  canIncrement = true,
  canDecrement = true,
  onIncrement,
  onDecrement,
}: DesktopValueAdjustmentOptions) => {
  const pressRef = React.useRef<DesktopMousePress | null>(null);
  const lastPointerTypeRef = React.useRef<string | null>(null);
  const rightReleaseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearRightReleaseTimeout = React.useCallback(() => {
    if (rightReleaseTimeoutRef.current === null) return;
    clearTimeout(rightReleaseTimeoutRef.current);
    rightReleaseTimeoutRef.current = null;
  }, []);

  const clearPress = React.useCallback(() => {
    pressRef.current = null;
  }, []);

  const onPointerDown = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      clearRightReleaseTimeout();
      lastPointerTypeRef.current = event.pointerType;
      if (!enabled || event.pointerType !== "mouse") return;
      if (event.button !== 0 && event.button !== 2) return;

      event.stopPropagation();
      pressRef.current = {
        pointerId: event.pointerId,
        button: event.button,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    [clearRightReleaseTimeout, enabled],
  );

  const onPointerMove = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      if (
        Math.hypot(event.clientX - press.startX, event.clientY - press.startY) >
        POINTER_MOVE_TOLERANCE_PX
      ) {
        clearPress();
      }
    },
    [clearPress],
  );

  const onPointerUp = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      event.stopPropagation();
      if (press.button === 0) {
        clearPress();
        if (canIncrement) onIncrement();
        return;
      }
      rightReleaseTimeoutRef.current = setTimeout(() => {
        clearPress();
        lastPointerTypeRef.current = null;
        rightReleaseTimeoutRef.current = null;
      }, 0);
    },
    [canIncrement, clearPress, onIncrement],
  );

  const onPointerCancel = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    () => {
      clearRightReleaseTimeout();
      clearPress();
      lastPointerTypeRef.current = null;
    },
    [clearPress, clearRightReleaseTimeout],
  );

  const onPointerLeave = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    () => {
      clearRightReleaseTimeout();
      clearPress();
      lastPointerTypeRef.current = null;
    },
    [clearPress, clearRightReleaseTimeout],
  );

  const onClick = React.useCallback<React.MouseEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled || lastPointerTypeRef.current !== "mouse") return;
      lastPointerTypeRef.current = null;
      event.preventDefault();
      event.stopPropagation();
    },
    [enabled],
  );

  const onContextMenu = React.useCallback<React.MouseEventHandler<HTMLElement>>(
    (event) => {
      const press = pressRef.current;
      if (!enabled || !press || press.button !== 2) return;
      clearRightReleaseTimeout();
      clearPress();
      lastPointerTypeRef.current = null;
      event.preventDefault();
      event.stopPropagation();
      if (canDecrement) onDecrement();
    },
    [
      canDecrement,
      clearPress,
      clearRightReleaseTimeout,
      enabled,
      onDecrement,
    ],
  );

  React.useEffect(
    () => () => {
      clearRightReleaseTimeout();
    },
    [clearRightReleaseTimeout],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onClick,
    onContextMenu,
  };
};
