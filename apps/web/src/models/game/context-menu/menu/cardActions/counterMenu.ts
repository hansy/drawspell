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

export const buildRecentlyUsedCounterItems = (params: {
  globalCounters: Record<string, string>;
  activeCounterTypes: ReadonlySet<string>;
  addCounter: (type: string, color: string) => void;
}): ContextMenuItem[] => {
  const recentCounterTypes = Object.keys(params.globalCounters)
    .filter(
      (counterType) =>
        !params.activeCounterTypes.has(normalizeCounterType(counterType)),
    )
    .reverse();
  if (recentCounterTypes.length === 0) return [];

  return [
    { type: "label", label: "Recently used counters:" },
    ...recentCounterTypes.map((counterType): ContextMenuItem => ({
      type: "action",
      label: counterType,
      closeOnSelect: false,
      onSelect: () =>
        params.addCounter(
          counterType,
          resolveCounterColor(counterType, params.globalCounters),
        ),
    })),
  ];
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
  const submenu: ContextMenuItem[] = [
    {
      type: "action",
      label: "Add a new counter...",
      onSelect: () => {
        openAddCounterModal([cardId]);
      },
    },
  ];

  submenu.push(
    ...buildRecentlyUsedCounterItems({
      globalCounters,
      activeCounterTypes,
      addCounter: (type, color) =>
        addCounter(cardId, { type, count: 1, color }),
    }),
  );

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
