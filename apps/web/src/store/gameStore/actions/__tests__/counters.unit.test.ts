import { describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";

import { createCounterActions } from "../counters";

describe("createCounterActions", () => {
  it("computes removal delta from the total normalized counter count", () => {
    const battlefield = {
      id: "bf-me",
      type: ZONE.BATTLEFIELD,
      ownerId: "me",
      cardIds: ["c1"],
    };
    const card = {
      id: "c1",
      name: "Card",
      ownerId: "me",
      controllerId: "me",
      zoneId: battlefield.id,
      tapped: false,
      faceDown: false,
      position: { x: 0, y: 0 },
      rotation: 0,
      counters: [
        { type: "Poison", count: 1 },
        { type: "poison", count: 3 },
      ],
    };

    const state = {
      cards: { [card.id]: card },
      zones: { [battlefield.id]: battlefield },
      myPlayerId: "me",
      viewerRole: "player",
      globalCounters: {},
    } as any;
    const dispatchIntent = vi.fn();

    const actions = createCounterActions(vi.fn() as any, () => state, {
      dispatchIntent,
    });

    actions.removeCounterFromCard(card.id, " poison ", "me");

    expect(dispatchIntent).toHaveBeenCalledTimes(1);
    expect(dispatchIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "card.counter.adjust",
        payload: expect.objectContaining({
          cardId: "c1",
          counterType: "poison",
          delta: -1,
        }),
      })
    );
  });
});
