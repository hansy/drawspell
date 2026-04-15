import { normalizeCounterType } from "@mtg/shared/counters";
import { ZONE } from "@/constants/zones";
import { Counter, Zone } from "@/types";

// Shared color presets so counters stay consistent across UI surfaces.
export const PRESET_COUNTERS: Array<{ type: string; color: string }> = [
  { type: "+1/+1", color: "#16a34a" }, // green-600
  { type: "-1/-1", color: "#dc2626" }, // red-600
  { type: "loyalty", color: "#ca8a04" }, // yellow-600
  { type: "charge", color: "#2563eb" }, // blue-600
];

const DEFAULT_COUNTER_COLOR = "#6366f1";
const COLOR_PALETTE = [
  "#ea580c", // orange-600
  "#9333ea", // purple-600
  "#db2777", // pink-600
  "#0891b2", // cyan-600
  "#0d9488", // teal-600
  "#65a30d", // lime-600
  "#4f46e5", // indigo-600
  "#c026d3", // fuchsia-600
];

export const isBattlefieldZone = (zone?: Zone) => zone?.type === ZONE.BATTLEFIELD;

export const enforceZoneCounterRules = (counters: Counter[], zone?: Zone): Counter[] => {
  return isBattlefieldZone(zone) ? counters : [];
};

const findCounterIndex = (existing: Counter[], type: string) => {
  const normalizedType = normalizeCounterType(type);
  if (!normalizedType) return -1;
  return existing.findIndex((counter) => normalizeCounterType(counter.type) === normalizedType);
};

const findGlobalCounterKey = (
  globalCounters: Record<string, string>,
  type: string
): string | undefined => {
  const normalizedType = normalizeCounterType(type);
  if (!normalizedType) return undefined;

  return Object.keys(globalCounters).find(
    (counterType) => normalizeCounterType(counterType) === normalizedType
  );
};

// Adds or increments a counter by type.
export const mergeCounters = (existing: Counter[], incoming: Counter): Counter[] => {
  const normalizedType = normalizeCounterType(incoming.type);
  if (!normalizedType) return existing;

  const idx = findCounterIndex(existing, normalizedType);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = {
      ...next[idx],
      type: normalizedType,
      color: incoming.color ?? next[idx].color,
      count: next[idx].count + incoming.count,
    };
    return next;
  }
  return [...existing, { ...incoming, type: normalizedType }];
};

// Decrements a counter by one; removes it if it hits zero.
export const decrementCounter = (existing: Counter[], type: string): Counter[] => {
  const normalizedType = normalizeCounterType(type);
  if (!normalizedType) return existing;

  const idx = findCounterIndex(existing, normalizedType);
  if (idx === -1) return existing;

  const next = [...existing];
  const target = next[idx];
  if (target.count > 1) {
    next[idx] = { ...target, type: normalizedType, count: target.count - 1 };
    return next;
  }

  next.splice(idx, 1);
  return next;
};

const deriveColorFromString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index] ?? DEFAULT_COUNTER_COLOR;
};

export const resolveCounterColor = (type: string, globalCounters: Record<string, string>): string => {
  const preset = PRESET_COUNTERS.find((p) => p.type === type);
  if (preset) return preset.color;
  const existingKey = findGlobalCounterKey(globalCounters, type);
  if (existingKey) return globalCounters[existingKey];
  return deriveColorFromString(type);
};
