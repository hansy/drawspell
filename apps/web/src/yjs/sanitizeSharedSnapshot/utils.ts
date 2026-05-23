import { clampNormalizedPosition, migratePositionToNormalized } from "@/lib/positions";

export const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
};

export const normalizePosition = (pos: any) => {
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
    return { x: 0.5, y: 0.5 };
  }
  const needsMigration = pos.x > 1 || pos.y > 1;
  const next = needsMigration ? migratePositionToNormalized(pos) : clampNormalizedPosition(pos);
  return { x: next.x, y: next.y };
};

export const dedupeStrings = (values: unknown[], max: number): string[] =>
  Array.from(new Set(values.filter((value): value is string => typeof value === "string"))).slice(
    0,
    max
  );
