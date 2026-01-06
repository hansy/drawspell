import * as React from "react";

type BattlefieldGridOverlayProps = {
  visible: boolean;
  viewScale: number;
};

const GRID_COLOR = "rgba(148, 163, 184, 0.3)";
const GRID_BASE_SIZE = 30;

export const BattlefieldGridOverlay = React.memo(
  ({ visible, viewScale }: BattlefieldGridOverlayProps) => {
    if (!visible) return null;
    const gridSize = GRID_BASE_SIZE * viewScale;
    const style = React.useMemo(
      () => ({
        backgroundImage: `radial-gradient(circle, ${GRID_COLOR} 2px, transparent 2px)`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `-${gridSize / 2}px -${gridSize / 2}px`,
      }),
      [gridSize]
    );

    return (
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={style}
      />
    );
  }
);

BattlefieldGridOverlay.displayName = "BattlefieldGridOverlay";
