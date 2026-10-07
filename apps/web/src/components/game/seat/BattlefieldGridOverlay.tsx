import * as React from "react";

type BattlefieldGridOverlayProps = {
  visible: boolean;
  bounds?: { left: number; top: number; width: number; height: number };
  gridStepX: number;
  gridStepY: number;
  gridOriginX: number;
  gridOriginY: number;
};

const GRID_COLOR = "rgba(148, 163, 184, 0.16)";

export const BattlefieldGridOverlay = React.memo(
  ({
    visible,
    bounds,
    gridStepX,
    gridStepY,
    gridOriginX,
    gridOriginY,
  }: BattlefieldGridOverlayProps) => {
    if (!visible || !gridStepX || !gridStepY) return null;

    return (
      <div
        className="pointer-events-none absolute inset-0 z-0"
        data-battlefield-grid-overlay="true"
        style={{
          ...(bounds ? { ...bounds, right: "auto", bottom: "auto" } : {}),
          backgroundImage: [
            `linear-gradient(to right, ${GRID_COLOR} 1px, transparent 1px)`,
            `linear-gradient(to bottom, ${GRID_COLOR} 1px, transparent 1px)`,
          ].join(", "),
          backgroundSize: `${gridStepX}px ${gridStepY}px`,
          backgroundPosition: `${gridOriginX - (bounds?.left ?? 0)}px ${gridOriginY - (bounds?.top ?? 0)}px`,
        }}
      />
    );
  },
);

BattlefieldGridOverlay.displayName = "BattlefieldGridOverlay";
