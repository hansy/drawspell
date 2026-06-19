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

export const normalizePosition = (pos: unknown) => {
  const rawPosition = pos as { x?: unknown; y?: unknown };
  if (!rawPosition || typeof rawPosition.x !== "number" || typeof rawPosition.y !== "number") {
    return { x: 0.5, y: 0.5 };
  }
  const position = rawPosition as { x: number; y: number };
  const needsMigration = position.x > 1 || position.y > 1;
  const next = needsMigration ? migratePositionToNormalized(position) : clampNormalizedPosition(position);
  return { x: next.x, y: next.y };
};

export const dedupeStrings = (values: unknown[], max: number): string[] =>
  Array.from(new Set(values.filter((value): value is string => typeof value === "string"))).slice(
    0,
    max
  );
