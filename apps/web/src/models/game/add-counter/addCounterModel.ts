export { normalizeCounterType } from "@mtg/shared/counters";
import { normalizeCounterType } from "@mtg/shared/counters";
import type { Counter } from "@/types";

export const normalizeCounterCount = (raw: number): number => {
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
};

export const getAllCounterTypes = (params: {
  presetTypes: string[];
  globalCounterTypes: string[];
}): string[] => {
  return Array.from(
    new Set(
      [...params.presetTypes, ...params.globalCounterTypes]
        .map((type) => normalizeCounterType(type))
        .filter(Boolean)
    )
  ).sort();
};

const hasGlobalCounterType = (
  globalCounters: Record<string, string>,
  type: string
) =>
  Object.keys(globalCounters).some(
    (existingType) => normalizeCounterType(existingType) === type
  );

export const planAddCounter = (params: {
  rawType: string;
  rawCount: number;
  globalCounters: Record<string, string>;
  resolveColor: (type: string, globalCounters: Record<string, string>) => string;
}):
  | {
      counter: Counter;
      shouldAddGlobalCounter: boolean;
    }
  | null => {
  const type = normalizeCounterType(params.rawType);
  if (!type) return null;

  const count = normalizeCounterCount(params.rawCount);
  const color = params.resolveColor(type, params.globalCounters);

  return {
    counter: { type, count, color },
    shouldAddGlobalCounter: !hasGlobalCounterType(params.globalCounters, type),
  };
};
