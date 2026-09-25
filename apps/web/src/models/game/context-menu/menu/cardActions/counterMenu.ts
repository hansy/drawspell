import { getNormalizedCounterTotal, normalizeCounterType } from "@mtg/shared/counters";
import type { Card } from "@/types";
import { resolveCounterColor } from "@/lib/counters";

import type { ContextMenuItem } from "../types";

type Counter = Card["counters"][number];

type BuildCounterMenuParams = {
  countersByTarget: Counter[][];
  globalCounters: Record<string, string>;
  openAddCounterModal: () => void;
  addCounter: (counter: { type: string; count: number; color?: string }) => void;
  removeCounter: (counterType: string) => void;
};

type ActiveCounter = {
  label: string;
  normalizedType: string;
  color?: string;
};

export const buildCounterMenu = ({
  countersByTarget,
  globalCounters,
  openAddCounterModal,
  addCounter,
  removeCounter,
}: BuildCounterMenuParams): ContextMenuItem => {
  const activeCounters = new Map<string, ActiveCounter>();
  for (const counters of countersByTarget) {
    for (const counter of counters) {
      const normalizedType = normalizeCounterType(counter.type);
      if (!normalizedType || counter.count <= 0) continue;

      const existing = activeCounters.get(normalizedType);
      if (existing) {
        if (!existing.color && counter.color) existing.color = counter.color;
      } else {
        activeCounters.set(normalizedType, {
          label: counter.type,
          normalizedType,
          color: counter.color,
        });
      }
    }
  }

  const submenu: ContextMenuItem[] = [
    {
      type: "action",
      label: "Add a new counter...",
      onSelect: openAddCounterModal,
    },
  ];

  const recentCounterTypes = Object.keys(globalCounters)
    .filter((type) => !activeCounters.has(normalizeCounterType(type)))
    .reverse();
  if (recentCounterTypes.length > 0) {
    submenu.push({ type: "label", label: "Recently used counters:" });
    submenu.push(
      ...recentCounterTypes.map((type): ContextMenuItem => ({
        type: "action",
        label: type,
        closeOnSelect: false,
        onSelect: () =>
          addCounter({
            type,
            count: 1,
            color: resolveCounterColor(type, globalCounters),
          }),
      })),
    );
  }

  if (activeCounters.size > 0) {
    submenu.push({ type: "separator", id: "counter-controls-divider" });
    submenu.push(
      ...Array.from(activeCounters.values(), (counter): ContextMenuItem => {
        return {
          type: "counter-control",
          label: counter.label,
          count: countersByTarget.length === 1
            ? getNormalizedCounterTotal(
                countersByTarget[0],
                counter.normalizedType,
              )
            : undefined,
          onIncrement: () =>
            addCounter({
              type: counter.normalizedType,
              count: 1,
              color:
                counter.color ??
                resolveCounterColor(counter.normalizedType, globalCounters),
            }),
          onDecrement: () => removeCounter(counter.normalizedType),
        };
      }),
    );
  }

  return {
    type: "action",
    label: "Add/remove counters",
    onSelect: () => {},
    submenu,
  };
};
