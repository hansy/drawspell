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

export const buildCounterMenuItems = ({
  cardId,
  counters,
  globalCounters,
  openAddCounterModal,
  addCounter,
  removeCounter,
}: BuildCounterMenuItemsParams): ContextMenuItem[] => {
  const activeCounterTypes = new Set(
    counters.map((counter) => normalizeCounterType(counter.type)).filter(Boolean)
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

  if (counters.length > 0) {
    submenu.push({ type: "separator", id: "counter-controls-divider" });

    submenu.push(
      ...counters.map(
        (counter): ContextMenuItem => ({
          type: "counter-control",
          label: counter.type,
          count: counter.count,
          onIncrement: () => {
            addCounter(cardId, {
              type: counter.type,
              count: 1,
              color: counter.color ?? resolveCounterColor(counter.type, globalCounters),
            });
          },
          onDecrement: () => {
            removeCounter(cardId, counter.type);
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
