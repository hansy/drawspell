import type { Counter } from "@/types";

import { MAX_COUNTERS } from "../sanitizeLimits";
import { clampNumber } from "./utils";

export const sanitizeCounters = (value: unknown): Counter[] => {
  if (!Array.isArray(value)) return [];
  const result: Counter[] = [];
  for (const c of value) {
    const rawCounter = c as Record<string, unknown>;
    if (!rawCounter || typeof rawCounter.type !== "string") continue;
    const count = clampNumber(rawCounter.count, 0, 999, 0);
    const counter: Counter = { type: rawCounter.type.slice(0, 64), count };
    if (typeof rawCounter.color === "string") counter.color = rawCounter.color.slice(0, 32);
    result.push(counter);
    if (result.length >= MAX_COUNTERS) break;
  }
  return result;
};
