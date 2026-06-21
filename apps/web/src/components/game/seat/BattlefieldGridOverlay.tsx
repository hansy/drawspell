import * as React from "react";

import { debugLog, isDebugEnabled, type DebugFlagKey } from "@/lib/debug";

type BattlefieldGridOverlayProps = {
  visible: boolean;
  gridStepX: number;
  gridStepY: number;
  originOffsetX?: number;
  originOffsetY?: number;
};

const GRID_COLOR = "rgba(148, 163, 184, 0.16)";
const BATTLEFIELD_DND_DEBUG_KEY: DebugFlagKey = "battlefieldDnd";

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
        backgroundImage: [
          `linear-gradient(to right, ${GRID_COLOR} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${GRID_COLOR} 1px, transparent 1px)`,
        ].join(", "),
        backgroundSize: `${gridStepX}px ${gridStepY}px`,
        backgroundPosition: `${originOffsetX}px ${originOffsetY}px`,
      }),
      [gridStepX, gridStepY, originOffsetX, originOffsetY]
    );

    React.useEffect(() => {
      if (!visible || !gridStepX || !gridStepY) return;
      if (!isDebugEnabled(BATTLEFIELD_DND_DEBUG_KEY)) return;
      debugLog(BATTLEFIELD_DND_DEBUG_KEY, "grid-overlay-rendered", {
        visible,
        gridStepX,
        gridStepY,
        originOffsetX,
        originOffsetY,
        style,
      });
    }, [gridStepX, gridStepY, originOffsetX, originOffsetY, style, visible]);

    if (!visible || !gridStepX || !gridStepY) return null;

    return (
      <div
        className="pointer-events-none absolute inset-0 z-0"
        data-battlefield-grid-overlay="true"
        style={style}
      />
    );
  }
);

BattlefieldGridOverlay.displayName = "BattlefieldGridOverlay";
