import { BATTLEFIELD_POSITION_LIMIT } from "./constants/geometry";
import type { Position } from "./positions";

export const readBattlefieldAnchor = (value: unknown): Position | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const point = value as Record<string, unknown>;
  if (
    typeof point.x !== "number" ||
    typeof point.y !== "number" ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    Math.abs(point.x) > BATTLEFIELD_POSITION_LIMIT ||
    Math.abs(point.y) > BATTLEFIELD_POSITION_LIMIT
  )
    return undefined;
  return { x: point.x, y: point.y };
};
