import { describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { createSetCardReveal } from "../setCardReveal";

describe("createSetCardReveal", () => {
  it("preserves the acting player in a face-down exile audience", () => {
    const exile = {
      id: "exile",
      type: ZONE.EXILE,
      ownerId: "p1",
      cardIds: ["c1"],
    };
    const card = {
      id: "c1",
      name: "Secret",
      ownerId: "p1",
      controllerId: "p1",
      zoneId: exile.id,
      tapped: false,
      faceDown: true,
      revealedTo: ["p1"],
      position: { x: 0.5, y: 0.5 },
      rotation: 0,
      counters: [],
    };
    const state = {
      myPlayerId: "p1",
      viewerRole: "player",
      cards: { c1: card },
      zones: { exile },
    } as any;
    const dispatchIntent = vi.fn();
    const setCardReveal = createSetCardReveal(
      vi.fn() as any,
      (() => state) as any,
      { dispatchIntent } as any,
    );

    setCardReveal("c1", { to: ["p1", "p2"] }, "p1");

    const applyLocal = dispatchIntent.mock.calls[0]?.[0]?.applyLocal;
    expect(applyLocal(state).cards.c1.revealedTo).toEqual(["p1", "p2"]);
  });

  it("rejects face-down exile visibility changes from an unauthorized player", () => {
    const state = {
      myPlayerId: "p2",
      viewerRole: "player",
      cards: {
        c1: {
          id: "c1",
          ownerId: "p1",
          controllerId: "p1",
          zoneId: "exile",
          faceDown: true,
          revealedTo: ["p1"],
        },
      },
      zones: {
        exile: { id: "exile", type: ZONE.EXILE, ownerId: "p1", cardIds: ["c1"] },
      },
    } as any;
    const dispatchIntent = vi.fn();
    const setCardReveal = createSetCardReveal(
      vi.fn() as any,
      (() => state) as any,
      { dispatchIntent } as any,
    );

    setCardReveal("c1", { toAll: true }, "p2");

    expect(dispatchIntent).not.toHaveBeenCalled();
  });
});
