import { describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { createSetCardsReveal } from "../setCardsReveal";

describe("createSetCardsReveal", () => {
  it("dispatches one batch reveal intent and updates every selected card", () => {
    const hand = {
      id: "hand",
      type: ZONE.HAND,
      ownerId: "p1",
      cardIds: ["c1", "c2"],
    };
    const makeCard = (id: string) => ({
      id,
      name: id,
      ownerId: "p1",
      controllerId: "p1",
      zoneId: hand.id,
      tapped: false,
      faceDown: false,
      position: { x: 0.5, y: 0.5 },
      rotation: 0,
      counters: [],
    });
    const state = {
      myPlayerId: "p1",
      viewerRole: "player",
      cards: { c1: makeCard("c1"), c2: makeCard("c2") },
      zones: { hand },
    } as any;
    const dispatchIntent = vi.fn();
    const setCardsReveal = createSetCardsReveal(
      vi.fn() as any,
      (() => state) as any,
      { dispatchIntent } as any,
    );

    setCardsReveal(["c1", "c2"], { toAll: true }, "p1");

    expect(dispatchIntent).toHaveBeenCalledTimes(1);
    expect(dispatchIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "card.reveal.set.batch",
        payload: {
          cardIds: ["c1", "c2"],
          reveal: { toAll: true },
          actorId: "p1",
        },
      }),
    );
    const applyLocal = dispatchIntent.mock.calls[0]?.[0]?.applyLocal;
    const next = applyLocal(state);
    expect(next.cards.c1.revealedToAll).toBe(true);
    expect(next.cards.c2.revealedToAll).toBe(true);
  });
});
