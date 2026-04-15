import { normalizeCounterType } from "@mtg/shared/counters";
import type { Card, CardId } from "@/types";
import { resolveCounterColor } from "@/lib/counters";

import type { ContextMenuItem } from "../types";

type Counter = Card["counters"][number];

type BuildCounterMenuItemsParams = {
  cardId: CardId;
  counters: Counter[];
  globalCounters: Record<string, string>;
  openAddCounterModal: (cardIds: CardId[]) => void;
  addCounter: (
    cardId: CardId,
    counter: { type: string; count: number; color?: string }
  ) => void;
  removeCounter: (cardId: CardId, counterType: string) => void;
};

type AggregatedCounter = {
  label: string;
  normalizedType: string;
  count: number;
  color?: string;
};

export const buildCounterMenuItems = ({
  cardId,
  counters,
  globalCounters,
  openAddCounterModal,
  addCounter,
  removeCounter,
}: BuildCounterMenuItemsParams): ContextMenuItem[] => {
  const aggregatedCounters = counters.reduce<AggregatedCounter[]>((acc, counter) => {
    const normalizedType = normalizeCounterType(counter.type);
    if (!normalizedType) return acc;

    const existing = acc.find(
      (entry) => entry.normalizedType === normalizedType
    );
    if (existing) {
      existing.count += counter.count;
      if (!existing.color && counter.color) {
        existing.color = counter.color;
      }
      return acc;
    }

    acc.push({
      label: counter.type,
      normalizedType,
      count: counter.count,
      color: counter.color,
    });
    return acc;
  }, []);

  const activeCounterTypes = new Set(
    aggregatedCounters.map((counter) => counter.normalizedType)
  );
  const recentCounterTypes = Object.keys(globalCounters)
    .filter(
      (counterType) => !activeCounterTypes.has(normalizeCounterType(counterType))
    )
    .reverse();

  const submenu: ContextMenuItem[] = [
    {
      type: "action",
      label: "Add a new counter...",
      onSelect: () => {
        openAddCounterModal([cardId]);
      },
    },
  ];

  if (recentCounterTypes.length > 0) {
    submenu.push({
      type: "label",
      label: "Recently used counters:",
    });

    submenu.push(
      ...recentCounterTypes.map(
        (counterType): ContextMenuItem => ({
          type: "action",
          label: counterType,
          closeOnSelect: false,
          onSelect: () => {
            addCounter(cardId, {
              type: counterType,
              count: 1,
              color: resolveCounterColor(counterType, globalCounters),
            });
          },
        })
      )
    );
  }

  if (aggregatedCounters.length > 0) {
    submenu.push({ type: "separator", id: "counter-controls-divider" });

    submenu.push(
      ...aggregatedCounters.map(
        (counter): ContextMenuItem => ({
          type: "counter-control",
          label: counter.label,
          count: counter.count,
          onIncrement: () => {
            addCounter(cardId, {
              type: counter.normalizedType,
              count: 1,
              color:
                counter.color ??
                resolveCounterColor(counter.normalizedType, globalCounters),
            });
          },
          onDecrement: () => {
            removeCounter(cardId, counter.normalizedType);
          },
        })
      )
    );
  }

  return [
    {
      type: "action",
      label: "Add/remove counters",
      onSelect: () => {},
      submenu,
    },
  ];
};
