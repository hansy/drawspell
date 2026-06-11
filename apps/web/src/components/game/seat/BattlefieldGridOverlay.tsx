import * as React from "react";

type BattlefieldGridOverlayProps = {
  visible: boolean;
  gridStepX: number;
  gridStepY: number;
  originOffsetX?: number;
  originOffsetY?: number;
};

const GRID_COLOR = "rgba(148, 163, 184, 0.3)";

export const BattlefieldGridOverlay = React.memo(
  ({
    visible,
    gridStepX,
    gridStepY,
    originOffsetX = 0,
    originOffsetY = 0,
  }: BattlefieldGridOverlayProps) => {
    const style = React.useMemo(
      () => ({
        backgroundImage: `radial-gradient(circle, ${GRID_COLOR} 2px, transparent 2px)`,
        backgroundSize: `${gridStepX}px ${gridStepY}px`,
        backgroundPosition: `${originOffsetX - gridStepX / 2}px ${originOffsetY - gridStepY / 2}px`,
      }),
      [gridStepX, gridStepY, originOffsetX, originOffsetY]
    );

    if (!visible || !gridStepX || !gridStepY) return null;

    return (
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={style}
      />
    );
  }
);

BattlefieldGridOverlay.displayName = "BattlefieldGridOverlay";
