import { describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { createMoveCards } from "../moveCards";

const makeCard = (id: string, zoneId: string) => ({
  id,
  name: id,
  ownerId: "p1",
  controllerId: "p1",
  zoneId,
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
});

describe("createMoveCards", () => {
  it("dispatches one batch intent and applies every frozen move locally", () => {
    const hand = {
      id: "hand",
      type: ZONE.HAND,
      ownerId: "p1",
      cardIds: ["c1", "c2"],
    };
    const library = {
      id: "library",
      type: ZONE.LIBRARY,
      ownerId: "p1",
      cardIds: ["existing"],
    };
    const state = {
      myPlayerId: "p1",
      viewerRole: "player",
      cards: {
        c1: makeCard("c1", hand.id),
        c2: makeCard("c2", hand.id),
        existing: makeCard("existing", library.id),
      },
      zones: { hand, library },
    } as any;
    const dispatchIntent = vi.fn();
    const moveCards = createMoveCards(
      vi.fn() as any,
      (() => state) as any,
      { dispatchIntent } as any,
    );
    const moves = [
      {
        cardId: "c2",
        toZoneId: library.id,
        placement: "bottom" as const,
        opts: { random: true },
      },
      {
        cardId: "c1",
        toZoneId: library.id,
        placement: "bottom" as const,
        opts: { random: true },
      },
    ];

    moveCards(moves, "p1");

    expect(dispatchIntent).toHaveBeenCalledTimes(1);
    expect(dispatchIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "card.move.batch",
        payload: { moves, actorId: "p1" },
      }),
    );
    const applyLocal = dispatchIntent.mock.calls[0]?.[0]?.applyLocal;
    const next = applyLocal(state);
    expect(next.zones.hand.cardIds).toEqual([]);
    expect(next.zones.library.cardIds).toEqual(["c1", "c2", "existing"]);
    expect(next.cards.c1.zoneId).toBe(library.id);
    expect(next.cards.c2.zoneId).toBe(library.id);
  });
});
