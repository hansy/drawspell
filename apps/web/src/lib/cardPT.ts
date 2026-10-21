import type { Card } from "@/types";

import { getCurrentFace } from "./cardDisplay";

export type CardStatKey = "power" | "toughness";

export const getNextCardStatUpdate = (
  card: Card,
  statKey: CardStatKey,
  delta: number
): Pick<Card, CardStatKey> | null => {
  const faceStatValue = getCurrentFace(card)?.[statKey];
  const currentStatValue = card[statKey] ?? faceStatValue ?? "0";
  const currentValue =
    currentStatValue === "*" ? 0 : parseInt(currentStatValue, 10);
  if (Number.isNaN(currentValue)) return null;
  return { [statKey]: (currentValue + delta).toString() } as Pick<Card, CardStatKey>;
};
